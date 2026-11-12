import { app } from 'electron';

import * as fs from 'fs';
import * as path from 'path';
import { Database } from 'node-sqlite3-wasm';
import bcrypt from 'bcryptjs';
import type {
  AuthResult,
  Link,
  LinkCreateInput,
  LinkDeleteResult,
  LinkListResult,
  LinkResult,
  LinkUpdateInput,
} from './types';
import { validateUrl } from './validation';

let db: Database | null = null;

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
}

const LINK_COLUMNS =
  'id, user_id, url, name, http_status, last_check, created_at, updated_at, pinned, position';

/**
 * Ordering used everywhere a list of links is returned: pinned links first,
 * then by manual position, with id as a stable tiebreaker.
 */
const LINK_ORDER = 'pinned DESC, position ASC, id ASC';

export function initDatabase(): Database {
  const dbPath = path.join(app.getPath('userData'), 'app.db');
  db = new Database(dbPath);

  db.exec(`
    PRAGMA foreign_keys = ON;

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
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id);
  `);

  migrateLinksUrlShortNullable();
  migrateLinksPinnedAndPosition();
  migrateLinksRenameShortUrlToName();

  return db;
}

/**
 * Recovers from an orphaned `app.db.lock`.
 *
 * node-sqlite3-wasm creates `app.db.lock` as a directory while a database is
 * open. A previous process that was killed abruptly (crash, task manager, a
 * forced shutdown) can leave that marker behind with no process holding it.
 * Every later query then fails with "database is locked", which surfaced to the
 * user as a generic "Something went wrong" on login. Clearing an orphaned
 * marker here turns a permanently broken install into a recoverable one.
 *
 * @returns true when a stale marker was removed.
 */
export function clearStaleLock(): boolean {
  const lockPath = path.join(app.getPath('userData'), 'app.db.lock');
  if (!fs.existsSync(lockPath)) return false;

  // If a live process holds the database, an exclusive open will fail and we
  // must not delete the marker.
  const dbPath = path.join(app.getPath('userData'), 'app.db');
  try {
    if (fs.existsSync(dbPath)) {
      const fd = fs.openSync(dbPath, 'r+');
      fs.closeSync(fd);
    }
  } catch {
    return false; // really in use, leave the lock alone
  }

  try {
    fs.rmSync(lockPath, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Older databases created links.url_short as NOT NULL. Since the short URL is
 * now optional, rebuild the table once so existing installs can store NULLs.
 * SQLite cannot drop a NOT NULL constraint in place, hence the rebuild.
 */
function migrateLinksUrlShortNullable(): void {
  const database = getDb();
  const columns = database
    .prepare('PRAGMA table_info(links)')
    .all() as unknown as Array<{ name: string; notnull: number }>;

  const urlShort = columns.find((c) => c.name === 'url_short');
  if (!urlShort || urlShort.notnull === 0) {
    return; // already nullable (or table absent)
  }

  database.exec(`
    PRAGMA foreign_keys = OFF;
    BEGIN TRANSACTION;
    CREATE TABLE links_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      url_short TEXT,
      http_status INTEGER,
      last_check TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    INSERT INTO links_new (id, user_id, url, url_short, http_status, last_check, created_at, updated_at)
      SELECT id, user_id, url, url_short, http_status, last_check, created_at, updated_at FROM links;
    DROP TABLE links;
    ALTER TABLE links_new RENAME TO links;
    CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id);
    COMMIT;
    PRAGMA foreign_keys = ON;
  `);
}

/**
 * Renames the `url_short` column to `name`.
 *
 * The field holds a label for the link, not a short URL, and every layer now
 * calls it `name`. Renaming in place keeps existing data and is cheap: SQLite
 * rewrites only the schema. Runs after the other migrations, so the column is
 * always present (possibly created by an older table rebuild).
 */
function migrateLinksRenameShortUrlToName(): void {
  const database = getDb();
  const columns = database
    .prepare('PRAGMA table_info(links)')
    .all() as unknown as Array<{ name: string }>;
  const names = new Set(columns.map((c) => c.name));

  if (names.has('name') || !names.has('url_short')) {
    return; // already renamed (or table absent)
  }

  database.exec('ALTER TABLE links RENAME COLUMN url_short TO name');
}

/**
 * Adds the `pinned` and `position` columns used for manual ordering, backfilling
 * existing rows with pinned = 0 and a position based on the current id order so
 * the list does not jump around after upgrading.
 */
function migrateLinksPinnedAndPosition(): void {
  const database = getDb();
  const columns = database
    .prepare('PRAGMA table_info(links)')
    .all() as unknown as Array<{ name: string }>;
  const names = new Set(columns.map((c) => c.name));

  if (!names.has('pinned')) {
    database.exec('ALTER TABLE links ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0');
  }
  if (!names.has('position')) {
    database.exec('ALTER TABLE links ADD COLUMN position INTEGER NOT NULL DEFAULT 0');

    // Backfill: give every user's existing links distinct consecutive positions
    // in their current display order, so nothing reorders on first launch.
    const users = database
      .prepare('SELECT DISTINCT user_id FROM links')
      .all() as unknown as Array<{ user_id: number }>;

    for (const { user_id: userId } of users) {
      const rows = database
        .prepare('SELECT id FROM links WHERE user_id = ? ORDER BY created_at DESC, id DESC')
        .all([userId]) as unknown as Array<{ id: number }>;
      rows.forEach((row, index) => {
        database
          .prepare('UPDATE links SET position = ? WHERE id = ?')
          .run([index, row.id]);
      });
    }

    database.exec('CREATE INDEX IF NOT EXISTS idx_links_user_order ON links(user_id, pinned, position)');
  }
}

function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

// ---- Authentication ----

export function registerUser(username: string, password: string): AuthResult {
  if (!username || !password) {
    return { ok: false, error: 'Username and password are required.' };
  }

  const trimmed = String(username).trim();
  if (trimmed.length < 3) {
    return { ok: false, error: 'Username must be at least 3 characters.' };
  }
  if (String(password).length < 4) {
    return { ok: false, error: 'Password must be at least 4 characters.' };
  }

  const database = getDb();
  const existing = database
    .prepare('SELECT id FROM users WHERE username = ?')
    .get([trimmed]);
  if (existing) {
    return { ok: false, error: 'That username is already taken.' };
  }

  const hash = bcrypt.hashSync(String(password), 10);
  const info = database
    .prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)')
    .run([trimmed, hash]);

  return { ok: true, user: { id: Number(info.lastInsertRowid), username: trimmed } };
}

export function loginUser(username: string, password: string): AuthResult {
  if (!username || !password) {
    return { ok: false, error: 'Username and password are required.' };
  }

  const trimmed = String(username).trim();
  const database = getDb();
  const row = database
    .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
    .get([trimmed]) as UserRow | null;

  if (!row) {
    return { ok: false, error: 'Invalid username or password.' };
  }

  const valid = bcrypt.compareSync(String(password), row.password_hash);
  if (!valid) {
    return { ok: false, error: 'Invalid username or password.' };
  }

  return { ok: true, user: { id: row.id, username: row.username } };
}

// ---- Link CRUD (all scoped to the owning user) ----

function normalizeNullableInt(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function normalizeNullableText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed === '' ? null : trimmed;
}

export function listLinks(userId: number): LinkListResult {
  const database = getDb();
  const rows = database
    .prepare(`SELECT ${LINK_COLUMNS} FROM links WHERE user_id = ? ORDER BY ${LINK_ORDER}`)
    .all([userId]) as unknown as Link[];
  return { ok: true, links: rows };
}

/**
 * Persists a new manual order for a user's links.
 *
 * `orderedIds` must contain every link the user owns, exactly once, in the order
 * they should appear. A link's `pinned` flag is derived from where it sits in
 * that list: the renderer sends pinned links first, so the first `pinnedCount`
 * ids are marked pinned. `pinnedCount` is passed explicitly rather than guessed
 * so an all-unpinned reorder keeps everything unpinned.
 *
 * The whole update runs in one transaction: either the new order is stored
 * completely or not at all.
 */
export function reorderLinks(
  userId: number,
  orderedIds: number[],
  pinnedCount: number
): LinkListResult {
  const database = getDb();

  const owned = database
    .prepare('SELECT id FROM links WHERE user_id = ?')
    .all([userId]) as unknown as Array<{ id: number }>;
  const ownedIds = new Set(owned.map((r) => r.id));

  // Reject anything that does not describe exactly this user's links.
  if (orderedIds.length !== ownedIds.size) {
    return { ok: false, error: 'Order does not match the number of stored links.' };
  }
  const seen = new Set<number>();
  for (const id of orderedIds) {
    if (!ownedIds.has(id) || seen.has(id)) {
      return { ok: false, error: 'Order contains an unknown or duplicate link.' };
    }
    seen.add(id);
  }
  if (pinnedCount < 0 || pinnedCount > orderedIds.length) {
    return { ok: false, error: 'Invalid pinned count.' };
  }

  database.exec('BEGIN TRANSACTION');
  try {
    const statement = database.prepare(
      'UPDATE links SET pinned = ?, position = ? WHERE id = ? AND user_id = ?'
    );
    orderedIds.forEach((id, index) => {
      const pinned = index < pinnedCount ? 1 : 0;
      statement.run([pinned, index, id, userId]);
    });
    database.exec('COMMIT');
  } catch (err) {
    database.exec('ROLLBACK');
    return { ok: false, error: `Could not save the new order: ${String(err)}` };
  }

  return listLinks(userId);
}

/**
 * Pins or unpins a single link.
 *
 * A newly pinned link is placed at the end of the pinned group (so it appears
 * last among pinned links); an unpinned one goes to the end of the unpinned
 * group. Positions of all links are then normalised to stay consecutive.
 */
export function setLinkPinned(
  userId: number,
  id: number,
  pinned: boolean
): LinkResult {
  const existing = getLink(userId, id);
  if (!existing.ok) {
    return existing;
  }

  const database = getDb();
  database.exec('BEGIN TRANSACTION');
  try {
    database
      .prepare('UPDATE links SET pinned = ?, updated_at = datetime(\'now\') WHERE id = ? AND user_id = ?')
      .run([pinned ? 1 : 0, id, userId]);
    normalisePositions(userId);
    database.exec('COMMIT');
  } catch (err) {
    database.exec('ROLLBACK');
    return { ok: false, error: `Could not update the pinned state: ${String(err)}` };
  }

  return getLink(userId, id);
}

/**
 * Rewrites every position for a user as 0..n-1 in the current display order,
 * keeping the two groups (pinned first) contiguous.
 */
function normalisePositions(userId: number): void {
  const database = getDb();
  const rows = database
    .prepare(`SELECT id FROM links WHERE user_id = ? ORDER BY ${LINK_ORDER}`)
    .all([userId]) as unknown as Array<{ id: number }>;

  const statement = database.prepare(
    'UPDATE links SET position = ? WHERE id = ? AND user_id = ?'
  );
  rows.forEach((row, index) => statement.run([index, row.id, userId]));
}

/** Next free position for a new link, keeping it at the end of its group. */
function nextPosition(userId: number): number {
  const database = getDb();
  const row = database
    .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM links WHERE user_id = ?')
    .get([userId]) as unknown as { next: number };
  return Number(row.next);
}

export function getLink(userId: number, id: number): LinkResult {
  const database = getDb();
  const row = database
    .prepare(`SELECT ${LINK_COLUMNS} FROM links WHERE id = ? AND user_id = ?`)
    .get([id, userId]) as unknown as Link | null;
  if (!row) {
    return { ok: false, error: 'Link not found.' };
  }
  return { ok: true, link: row };
}

export function createLink(userId: number, input: LinkCreateInput): LinkResult {
  // Validate the URL before touching the database.
  const validation = validateUrl(input?.url);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }
  const url = validation.url;

  const name = normalizeNullableText(input?.name);

  const database = getDb();
  const info = database
    .prepare('INSERT INTO links (user_id, url, name, position) VALUES (?, ?, ?, ?)')
    .run([userId, url, name, nextPosition(userId)]);

  const id = Number(info.lastInsertRowid);
  return getLink(userId, id);
}

export function updateLink(
  userId: number,
  id: number,
  input: LinkUpdateInput
): LinkResult {
  const existing = getLink(userId, id);
  if (!existing.ok) {
    return existing;
  }

  // Validate the URL before touching the database.
  const validation = validateUrl(input?.url);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }
  const url = validation.url;

    const name = normalizeNullableText(input?.name);
  const httpStatus = normalizeNullableInt(input.http_status);
  const lastCheck = normalizeNullableText(input.last_check);

  const database = getDb();
  database
    .prepare(
      `UPDATE links
         SET url = ?, name = ?, http_status = ?, last_check = ?,
             updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`
    )
    .run([url, name, httpStatus, lastCheck, id, userId]);

  return getLink(userId, id);
}

/**
 * Records the outcome of an HTTP check on a link: stores the status code and
 * sets last_check to the current time. Scoped to the owning user.
 */
export function recordLinkCheck(
  userId: number,
  id: number,
  httpStatus: number | null
): LinkResult {
  const database = getDb();
  const info = database
    .prepare(
      `UPDATE links
         SET http_status = ?, last_check = datetime('now'), updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`
    )
    .run([httpStatus, id, userId]);

  if (Number(info.changes) === 0) {
    return { ok: false, error: 'Link not found.' };
  }
  return getLink(userId, id);
}

/**
 * Updates only last_check for a link, leaving http_status untouched. Used when
 * an attempt failed for network reasons and we have no new status to record.
 */
export function touchLastCheck(userId: number, id: number): void {
  const database = getDb();
  database
    .prepare(
      `UPDATE links SET last_check = datetime('now'), updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`
    )
    .run([id, userId]);
}

export function deleteLink(userId: number, id: number): LinkDeleteResult {
  const database = getDb();
  const info = database
    .prepare('DELETE FROM links WHERE id = ? AND user_id = ?')
    .run([id, userId]);

  if (Number(info.changes) === 0) {
    return { ok: false, error: 'Link not found.' };
  }
  return { ok: true, id };
}
