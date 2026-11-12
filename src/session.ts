import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Persisted "last logged-in user" record.
 *
 * This is what lets the app remember the session while it runs in the tray:
 * closing the window does not log the user out, so reopening the app restores
 * the previous session without a password prompt. Only an explicit
 * "Log out" clears it.
 */
export interface StoredSession {
  userId: number;
  username: string;
}

interface SessionFile {
  lastSession: StoredSession | null;
}

function sessionPath(): string {
  return path.join(app.getPath('userData'), 'session.json');
}

function readFile(): SessionFile {
  try {
    const raw = fs.readFileSync(sessionPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<SessionFile> | null;
    const last = parsed?.lastSession ?? null;
    if (!last || typeof last.userId !== 'number' || typeof last.username !== 'string') {
      return { lastSession: null };
    }
    return { lastSession: { userId: last.userId, username: last.username } };
  } catch {
    // Missing or corrupt file: no remembered session.
    return { lastSession: null };
  }
}

function writeFile(data: SessionFile): void {
  try {
    fs.mkdirSync(path.dirname(sessionPath()), { recursive: true });
    fs.writeFileSync(sessionPath(), JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    // Losing the remembered session is not fatal - the user can log in again.
    console.error('Failed to persist session:', err);
  }
}

export function loadSession(): StoredSession | null {
  return readFile().lastSession;
}

export function saveSession(session: StoredSession): void {
  writeFile({ lastSession: session });
}

export function clearSession(): void {
  writeFile({ lastSession: null });
}
