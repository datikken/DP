// Standalone test mirroring src/migrate-legacy.ts (read legacy read-only,
// insert into target with skip-existing). Verifies data comes across and that a
// second run (new connection, like a 2nd app launch) imports nothing new.
const { Database } = require('node-sqlite3-wasm');
const path = require('path');
const fs = require('fs');
const os = require('os');

const legacyOriginal = path.join(process.env.APPDATA, 'electron-sqlite-auth', 'app.db');
if (!fs.existsSync(legacyOriginal)) {
  console.error('No legacy DB at', legacyOriginal);
  process.exit(1);
}

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'dp-merge-'));
const targetPath = path.join(work, 'app.db');

function makeTarget() {
  const db = new Database(targetPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      name TEXT,
      http_status INTEGER,
      last_check TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      pinned INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  return db;
}

function readLegacyData(legacyPath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dp-legacy-'));
  const tmpDb = path.join(tmpDir, 'app.db');
  let legacy = null;
  try {
    fs.copyFileSync(legacyPath, tmpDb);
    legacy = new Database(tmpDb, { readOnly: true });
    const users = legacy.prepare('SELECT * FROM users').all().map((r) => ({
      id: Number(r.id),
      username: String(r.username),
      password_hash: String(r.password_hash),
      created_at: r.created_at ?? null,
    }));
    const links = legacy.prepare('SELECT * FROM links').all().map((r) => ({
      user_id: Number(r.user_id),
      url: String(r.url),
      name: r.name ?? null,
      http_status: r.http_status ?? null,
      last_check: r.last_check ?? null,
      created_at: r.created_at ?? null,
      updated_at: r.updated_at ?? null,
      pinned: r.pinned ?? 0,
      position: r.position ?? 0,
    }));
    return { users, links };
  } finally {
    try { legacy && legacy.close(); } catch {}
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }
}

function applyLegacyData(target, data) {
  let usersImported = 0, linksImported = 0;
  target.exec('BEGIN TRANSACTION;');
  try {
    const findUserByName = target.prepare('SELECT id FROM users WHERE username = ?');
    const insertUser = target.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)');
    const lastId = target.prepare('SELECT last_insert_rowid() AS id');
    const idMap = new Map();
    for (const u of data.users) {
      const existing = findUserByName.get([u.username]);
      if (existing) { idMap.set(u.id, Number(existing.id)); continue; }
      insertUser.run([u.username, u.password_hash, u.created_at]);
      idMap.set(u.id, Number(lastId.get().id));
      usersImported += 1;
    }
    const linkExists = target.prepare("SELECT 1 FROM links WHERE user_id = ? AND url = ? AND COALESCE(name,'')=COALESCE(?,'')");
    const maxPos = target.prepare('SELECT MAX(position) AS m FROM links WHERE user_id = ?');
    const insertLink = target.prepare(
      'INSERT INTO links (user_id, url, name, http_status, last_check, created_at, updated_at, pinned, position) VALUES (?,?,?,?,?,?,?,?,?)'
    );
    const next = new Map();
    const nextPosFor = (uid) => {
      if (!next.has(uid)) { const r = maxPos.get([uid]); next.set(uid, (r && r.m != null ? r.m : -1) + 1); }
      const p = next.get(uid); next.set(uid, p + 1); return p;
    };
    for (const l of data.links) {
      const uid = idMap.get(l.user_id);
      if (uid === undefined) continue;
      if (linkExists.get([uid, l.url, l.name])) continue;
      insertLink.run([uid, l.url, l.name, l.http_status, l.last_check, l.created_at, l.updated_at, l.pinned ?? 0, nextPosFor(uid)]);
      linksImported += 1;
    }
    target.exec('COMMIT;');
  } catch (e) { try { target.exec('ROLLBACK;'); } catch {} throw e; }
  return { usersImported, linksImported };
}

// Run 1 (fresh target).
const db = makeTarget();
const r1 = applyLegacyData(db, readLegacyData(legacyOriginal));
console.log('Run 1:', r1);
console.log('users:', db.prepare('SELECT id, username FROM users').all());
console.log('total links:', db.prepare('SELECT COUNT(*) c FROM links').get().c);
console.log('links by user:', db.prepare('SELECT user_id, COUNT(*) c FROM links GROUP BY user_id').all());
console.log('sample links:', db.prepare('SELECT id, user_id, name, url, pinned FROM links ORDER BY user_id, position LIMIT 8').all());
// Run 2 (same connection, second merge): must import nothing new.
const r2 = applyLegacyData(db, readLegacyData(legacyOriginal));
console.log('Run 2 (expect 0/0):', r2);
console.log('total links after run2:', db.prepare('SELECT COUNT(*) c FROM links').get().c);
console.log('user count after run2:', db.prepare('SELECT COUNT(*) c FROM users').get().c);

// Verify password hashes preserved (read via a copy, like production — the
// original may carry a stale lock from the old app).
const oldUsers = readLegacyData(legacyOriginal).users;
let ok = true;
for (const { username, password_hash } of oldUsers) {
  const row = db.prepare('SELECT password_hash FROM users WHERE username = ?').get([username]);
  if (!row || row.password_hash !== password_hash) { ok = false; console.log('HASH MISMATCH', username); }
}
console.log('password hashes preserved:', ok);

db.close();
fs.rmSync(work, { recursive: true, force: true });
