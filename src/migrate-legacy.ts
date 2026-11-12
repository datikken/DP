import { app } from 'electron';

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Database } from 'node-sqlite3-wasm';

/**
 * Import of data from the previous "My Links" desktop app into DailyPlanner.
 *
 * DailyPlanner is a rebrand/continuation of the earlier "My Links" app. Both
 * store the same SQLite schema (`users` + `links`) in `app.db`, but each app
 * keeps its database in its *own* per-app userData folder. So a user upgrading
 * from My Links would otherwise start DailyPlanner empty, even though their
 * data is still on disk under the old app's folder.
 *
 * This module **merges** the old database into DailyPlanner's database. It is
 * meant to run on every startup (install, launch, whenever): it looks up the
 * legacy database, and if found copies its users and links into the live
 * database. The operation is idempotent and non-destructive:
 *   - existing DailyPlanner rows are never modified or deleted;
 *   - a user is imported only if no user with the same username exists;
 *   - a link is imported only if the target user does not already have a link
 *     with the same URL and name;
 *   - re-running after a successful import adds nothing new.
 */

/** File name of the database inside a userData folder (shared by both apps). */
const DB_FILE = 'app.db';
/** The remembered "last logged-in user" file (same format in both apps). */
const SESSION_FILE = 'session.json';

/**
 * Folder names the previous "My Links" app may have used for its userData dir.
 *
 * Electron derives `userData` from the app name: the packaged app used
 * `productName` ("My Links"), while a development run (`electron .`) used the
 * package.json `name` ("electron-sqlite-auth"). Both are listed so the import
 * works regardless of how the old app was run; "MyLinks" is a harmless extra.
 */
const LEGACY_APP_DIR_NAMES = ['My Links', 'MyLinks', 'electron-sqlite-auth'];

export interface LegacyImportResult {
  /** True when at least one legacy row was brought across this run. */
  imported: boolean;
  usersImported: number;
  linksImported: number;
  /** Where the old database was found, when one was used. */
  sourcePath?: string;
  /** Human-readable reason the import did nothing, when applicable. */
  reason?: string;
}

/** True when `file` exists and is a regular file. */
function isFile(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

/**
 * Returns candidate absolute paths to the previous app's `app.db`, checked in
 * order. `appData` is the platform's "Application Data" root (`%APPDATA%` /
 * Roaming on Windows); userData folders live directly underneath it.
 */
function legacyDatabaseCandidates(appData: string): string[] {
  return LEGACY_APP_DIR_NAMES.map((dir) => path.join(appData, dir, DB_FILE));
}

/** A user row read from the legacy database. */
interface LegacyUser {
  id: number;
  username: string;
  password_hash: string;
  created_at: string | null;
}

/** A link row read from the legacy database. */
interface LegacyLink {
  user_id: number;
  url: string;
  name: string | null;
  http_status: number | null;
  last_check: string | null;
  created_at: string | null;
  updated_at: string | null;
  pinned: number | null;
  position: number | null;
}

/** True when `v` is a finite number (SQLite may hand back numbers or bigints). */
function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Reads the legacy database into plain objects. A fresh private copy is opened
 * read-only so this never modifies the user's old file and never needs a
 * write-lock: a previously crashed My Links run may have left a stale
 * `<db>.lock` directory behind, which would block a writable open.
 */
function readLegacyData(legacyPath: string): { users: LegacyUser[]; links: LegacyLink[] } {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dailyplanner-legacy-'));
  const tmpDb = path.join(tmpDir, DB_FILE);
  let legacy: Database | null = null;
  try {
    fs.copyFileSync(legacyPath, tmpDb);
    legacy = new Database(tmpDb, { readOnly: true });

    const users = (legacy.prepare('SELECT * FROM users').all() as unknown[]).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        id: Number(r.id),
        username: String(r.username),
        password_hash: String(r.password_hash),
        created_at: (r.created_at as string | null) ?? null,
      } satisfies LegacyUser;
    });

    const links = (legacy.prepare('SELECT * FROM links').all() as unknown[]).map((row) => {
      const r = row as Record<string, unknown>;
      return {
        user_id: Number(r.user_id),
        url: String(r.url),
        name: (r.name as string | null) ?? null,
        http_status: toNumberOrNull(r.http_status),
        last_check: (r.last_check as string | null) ?? null,
        created_at: (r.created_at as string | null) ?? null,
        updated_at: (r.updated_at as string | null) ?? null,
        pinned: toNumberOrNull(r.pinned),
        position: toNumberOrNull(r.position),
      } satisfies LegacyLink;
    });

    return { users, links };
  } finally {
    try {
      legacy?.close();
    } catch {
      /* ignore */
    }
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

/**
 * Inserts the read legacy data into the target database inside one transaction.
 * Rows already present (same username / same user+url+name) are skipped, so the
 * merge is idempotent. Returns how many users and links were actually added.
 */
function applyLegacyData(
  target: Database,
  data: { users: LegacyUser[]; links: LegacyLink[] }
): { usersImported: number; linksImported: number } {
  let usersImported = 0;
  let linksImported = 0;

  target.exec('BEGIN TRANSACTION;');
  try {
    // ---- Users ----
    const findUserByName = target.prepare('SELECT id FROM users WHERE username = ?');
    const insertUser = target.prepare(
      'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)'
    );
    const lastId = target.prepare('SELECT last_insert_rowid() AS id');

    // Legacy id -> new DailyPlanner id, so links can be re-pointed.
    const idMap = new Map<number, number>();

    for (const u of data.users) {
      const existing = findUserByName.get([u.username]) as { id: number } | undefined;
      if (existing) {
        // Keep the existing account, but still map the legacy id to it so that
        // user's links can be merged in below.
        idMap.set(u.id, Number(existing.id));
        continue;
      }
      insertUser.run([u.username, u.password_hash, u.created_at]);
      const row = lastId.get() as { id: number };
      idMap.set(u.id, Number(row.id));
      usersImported += 1;
    }

    // ---- Links ----
    const linkExists = target.prepare(
      "SELECT 1 FROM links WHERE user_id = ? AND url = ? AND COALESCE(name, '') = COALESCE(?, '')"
    );
    const maxPosition = target.prepare('SELECT MAX(position) AS m FROM links WHERE user_id = ?');
    const insertLink = target.prepare(
      `INSERT INTO links
        (user_id, url, name, http_status, last_check, created_at, updated_at, pinned, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    // Track the next free position per target user so imported links appear
    // after existing ones without all colliding on the same value.
    const nextPosition = new Map<number, number>();
    const nextPosFor = (userId: number): number => {
      if (!nextPosition.has(userId)) {
        const row = maxPosition.get([userId]) as { m: number | null } | undefined;
        nextPosition.set(userId, (row?.m ?? -1) + 1);
      }
      const p = nextPosition.get(userId)!;
      nextPosition.set(userId, p + 1);
      return p;
    };

    for (const l of data.links) {
      const targetUserId = idMap.get(l.user_id);
      if (targetUserId === undefined) continue; // orphaned link, no matching user

      if (linkExists.get([targetUserId, l.url, l.name])) continue;

      insertLink.run([
        targetUserId,
        l.url,
        l.name,
        l.http_status,
        l.last_check,
        l.created_at,
        l.updated_at,
        l.pinned ?? 0,
        nextPosFor(targetUserId),
      ]);
      linksImported += 1;
    }

    target.exec('COMMIT;');
  } catch (err) {
    try {
      target.exec('ROLLBACK;');
    } catch {
      /* ignore rollback failure */
    }
    throw err;
  }

  return { usersImported, linksImported };
}

/**
 * True when a SQLite file opens read-only and has the expected `users` and
 * `links` tables, so we never act on a stray, empty or corrupt file.
 */
function isUsableLegacyDb(file: string): boolean {
  let db: Database | null = null;
  try {
    db = new Database(file, { readOnly: true });
    const tables = new Set(
      (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as unknown[]).map(
        (r) => String((r as { name: unknown }).name)
      )
    );
    return tables.has('users') && tables.has('links');
  } catch {
    return false;
  } finally {
    try {
      db?.close();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Looks up the previous My Links database and merges it into DailyPlanner's
 * already-open `target` database. Intended to run on every startup; it is a
 * no-op when no legacy database exists or when everything is already imported.
 *
 * Must be called **after** `initDatabase()` (target is open + migrated) so the
 * merge runs against a schema that already has every column.
 */
export function importLegacyData(target: Database): LegacyImportResult {
  const appData = app.getPath('appData'); // %APPDATA% / Roaming (or platform equivalent)
  const userData = app.getPath('userData');

  const candidates = legacyDatabaseCandidates(appData);
  const sourceDb = candidates.find((p) => isFile(p));

  if (!sourceDb) {
    return {
      imported: false,
      usersImported: 0,
      linksImported: 0,
      reason: 'No previous My Links database found.',
    };
  }

  // Never try to merge the live database into itself.
  if (path.resolve(sourceDb) === path.resolve(path.join(userData, DB_FILE))) {
    return {
      imported: false,
      usersImported: 0,
      linksImported: 0,
      reason: 'Legacy database path equals the current database.',
    };
  }

  if (!isUsableLegacyDb(sourceDb)) {
    return {
      imported: false,
      usersImported: 0,
      linksImported: 0,
      sourcePath: sourceDb,
      reason: 'Legacy file is not a usable My Links database.',
    };
  }

  try {
    const data = readLegacyData(sourceDb);
    const { usersImported, linksImported } = applyLegacyData(target, data);

    // Carry the remembered session across only on a first, successful import,
    // and only if DailyPlanner has no session of its own yet.
    if (usersImported > 0 || linksImported > 0) {
      copyLegacySessionIfAbsent(userData, sourceDb);
    }

    const imported = usersImported > 0 || linksImported > 0;
    if (imported) {
      console.log(
        `Imported from legacy My Links database (${sourceDb}): ` +
          `${usersImported} user(s), ${linksImported} link(s).`
      );
    }
    return { imported, usersImported, linksImported, sourcePath: sourceDb };
  } catch (err) {
    console.error('Failed to import the legacy My Links database:', err);
    return {
      imported: false,
      usersImported: 0,
      linksImported: 0,
      sourcePath: sourceDb,
      reason: `Import failed: ${String(err)}`,
    };
  }
}

/** Copies the legacy session.json into userData when DailyPlanner has none. */
function copyLegacySessionIfAbsent(userData: string, sourceDb: string): void {
  const sourceSession = path.join(path.dirname(sourceDb), SESSION_FILE);
  const targetSession = path.join(userData, SESSION_FILE);
  if (!isFile(sourceSession) || fs.existsSync(targetSession)) return;
  try {
    fs.copyFileSync(sourceSession, targetSession);
  } catch (err) {
    // Losing the remembered session is not fatal; the user can log in again.
    console.error('Imported data but failed to copy the session:', err);
  }
}
