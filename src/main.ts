import { app, BrowserWindow, dialog, ipcMain, Menu, shell, Tray } from 'electron';
import * as path from 'path';
import {
  initDatabase,
  clearStaleLock,
  registerUser,
  loginUser,
  listLinks,
  reorderLinks,
  setLinkPinned,
  getLink,
  createLink,
  updateLink,
  deleteLink,
  recordLinkCheck,
  touchLastCheck,
} from './database';
import { checkUrlStatus } from './checker';
import { importLegacyData } from './migrate-legacy';
import { clearSession, loadSession, saveSession } from './session';
import { createTrayIcon } from './tray-icon';
import type { AuthResult, LinkCreateInput, LinkCheckResult, LinkUpdateInput } from './types';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

/**
 * Set once the user asks to quit (tray menu "Quit" / macOS Cmd+Q). Closing the
 * window only hides it, so this flag distinguishes a real shutdown from the
 * close-to-tray behaviour.
 */
let isQuitting = false;

/**
 * The currently authenticated user's id, held in the main process only.
 * The renderer never supplies user_id — every link operation is attributed
 * to this session value, so a user can only ever see/modify their own rows.
 *
 * This is runtime state; the *remembered* session (so the app can reopen the
 * last account while sitting in the tray) lives in session.json via session.ts.
 */
let currentUserId: number 
| null = null;
let currentUsername: string | null = null;

function setCurrentUser(user: { id: number; username: string } | null): void {
  currentUserId = user ? user.id : null;
  currentUsername = user ? user.username : null;
  updateTrayMenu();
}

/** Restores the remembered session from disk (called once at startup). */
function restoreSession(): void {
  const saved = loadSession();
  if (!saved) return;
  currentUserId = saved.userId;
  currentUsername = saved.username;
}

// ---- Window & tray ----

function createWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    focusWindow();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 640,
    minHeight: 520,
    autoHideMenuBar: true, // hide the default File/Edit/View/Window/Help bar
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Fully remove the application menu (File/Edit/View/Window/Help) so it does
  // not appear even when Alt is pressed.
  mainWindow.setMenuBarVisibility(false);
  mainWindow.setMenu(null);

  // Closing the window keeps the app alive in the tray, until the user quits.
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      updateTrayMenu();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Remove the native menu bar (File/Edit/View/Window/Help).
  mainWindow.removeMenu();

  loadLandingPage(mainWindow);
}

/**
 * Loads the page matching the current session: the links view when a session
 * is remembered, the sign-in page otherwise.
 */
function loadLandingPage(win: BrowserWindow): void {
  if (currentUserId !== null && currentUsername !== null) {
    win.loadFile(path.join(__dirname, 'renderer', 'links.html'), {
      query: { user: currentUsername },
    });
  } else {
    win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  }
}

function focusWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
  mainWindow.moveTop();
}

function sendToRenderer(channel: string): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel);
  }
}

function createTray(): void {
  tray = new Tray(createTrayIcon());
  // Windows/Linux: a left click on the tray icon brings the window back.
  tray.on('click', () => focusWindow());
  updateTrayMenu();
}

function updateTrayMenu(): void {
  if (!tray) return;

  const signedIn = currentUserId !== null;
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label:
        signedIn && currentUsername ? `Open (${currentUsername})` : 'Open',
      click: () => focusWindow(),
    },
    { type: 'separator' },
  ];

  if (signedIn) {
    template.push({ label: 'Log out', click: () => logout() });
  }

  template.push(
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    }
  );

  tray.setContextMenu(Menu.buildFromTemplate(template));
  tray.setToolTip(
    signedIn && currentUsername ? `DailyPlanner — ${currentUsername}` : 'DailyPlanner'
  );
}

/**
 * Ends the session: clears both the runtime and the remembered (persisted)
 * user, then sends the window back to the sign-in page.
 */
function logout(): void {
  setCurrentUser(null);
  clearSession();

  if (mainWindow && !mainWindow.isDestroyed()) {
    sendToRenderer('session:logged-out');
    mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
    focusWindow();
  } else {
    createWindow();
  }
}

// ---- IPC handlers for authentication ----

/** Applies the outcome of a login/registration and remembers the session. */
function finishAuth(result: AuthResult): AuthResult {
  if (result.ok) {
    setCurrentUser(result.user);
    saveSession({ userId: result.user.id, username: result.user.username });
  }
  return result;
}

/**
 * Wraps a database call so an unexpected failure is reported as a normal
 * `{ ok: false, error }` result. Without this an exception rejects the IPC
 * promise and the renderer can only show its generic fallback message.
 */
function safeAuth(run: () => AuthResult): AuthResult {
  try {
    return finishAuth(run());
  } catch (err) {
    console.error('Authentication failed:', err);
    return {
      ok: false,
      error: 'Could not access the database. Close any other copy of the app and try again.',
    };
  }
}

ipcMain.handle(
  'auth:register',
  (_event, { username, password }: { username: string; password: string }) =>
    safeAuth(() => registerUser(username, password))
);

ipcMain.handle(
  'auth:login',
  (_event, { username, password }: { username: string; password: string }) =>
    safeAuth(() => loginUser(username, password))
);

// Explicit log-out is the only thing that forgets the remembered session.
ipcMain.handle('auth:logout', () => {
  logout();
  return { ok: true };
});

ipcMain.handle('auth:current', () => currentUserId);

ipcMain.handle('auth:session', () => {
  if (currentUserId === null || currentUsername === null) return null;
  return { id: currentUserId, username: currentUsername };
});

// ---- IPC handlers for link CRUD ----

function requireUser() {
  return currentUserId;
}

ipcMain.handle('link:list', () => {
  const userId = requireUser();
  if (userId === null) {
    return { ok: false, error: 'Not authenticated.' };
  }
  return listLinks(userId);
});

ipcMain.handle('link:get', (_event, { id }: { id: number }) => {
  const userId = requireUser();
  if (userId === null) {
    return { ok: false, error: 'Not authenticated.' };
  }
  return getLink(userId, Number(id));
});

ipcMain.handle('link:create', (_event, { input }: { input: LinkCreateInput }) => {
  const userId = requireUser();
  if (userId === null) {
    return { ok: false, error: 'Not authenticated.' };
  }
  return createLink(userId, input);
});

ipcMain.handle(
  'link:update',
  (_event, { id, input }: { id: number; input: LinkUpdateInput }) => {
    const userId = requireUser();
    if (userId === null) {
      return { ok: false, error: 'Not authenticated.' };
    }
    return updateLink(userId, Number(id), input);
  }
);

ipcMain.handle('link:delete', (_event, { id }: { id: number }) => {
  const userId = requireUser();
  if (userId === null) {
    return { ok: false, error: 'Not authenticated.' };
  }
  return deleteLink(userId, Number(id));
});

/**
 * Persists a manual drag-and-drop order. `orderedIds` lists every link the user
 * owns in its new display order; the first `pinnedCount` of them are pinned.
 */
ipcMain.handle(
  'link:reorder',
  (_event, { orderedIds, pinnedCount }: { orderedIds: number[]; pinnedCount: number }) => {
    const userId = requireUser();
    if (userId === null) {
      return { ok: false, error: 'Not authenticated.' };
    }
    if (!Array.isArray(orderedIds)) {
      return { ok: false, error: 'Invalid order.' };
    }
    return reorderLinks(
      userId,
      orderedIds.map((id) => Number(id)),
      Number(pinnedCount)
    );
  }
);

ipcMain.handle(
  'link:pin',
  (_event, { id, pinned }: { id: number; pinned: boolean }) => {
    const userId = requireUser();
    if (userId === null) {
      return { ok: false, error: 'Not authenticated.' };
    }
    return setLinkPinned(userId, Number(id), Boolean(pinned));
  }
);

ipcMain.handle('link:check', async (_event, { id }: { id: number }): Promise<LinkCheckResult> => {
  const userId = requireUser();
  if (userId === null) {
    return { ok: false, error: 'Not authenticated.' };
  }

  const linkId = Number(id);
  const existing = getLink(userId, linkId);
  if (!existing.ok) {
    return existing;
  }

  // Perform the request in the main process, then persist the outcome.
  const outcome = await checkUrlStatus(existing.link.url);
  if (outcome.status === 0) {
    // A failed attempt (DNS, timeout, refused connection) says nothing about
    // the link's real health - the site may be fine and the network flaky.
    // Record only the check time, leaving the previously known status intact,
    // so one bad attempt does not overwrite a good result with "failed".
    touchLastCheck(userId, linkId);
    return { ok: false, error: outcome.error || 'Request failed.' };
  }

  return recordLinkCheck(userId, linkId, outcome.status);
});

ipcMain.handle('link:openExternal', async (_event, { url }: { url: string }) => {
  let parsed: URL;
  try {
    parsed = new URL(String(url));
  } catch {
    return { ok: false, error: 'That link is not a valid URL.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only http and https links can be opened.' };
  }
  try {
    await shell.openExternal(parsed.toString());
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not open the browser.' };
  }
});

// ---- App lifecycle ----
/**
 * Only one instance of the app may run: a second launch must not create a
 * second tray icon or open the SQLite database twice (which fails with
 * "database is locked"). The lock is taken *before* anything else starts;
 * the second instance asks the first to show itself, then exits immediately.
 */
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  // Nothing below this point runs in the second instance.
  app.quit();
} else {
  app.on('second-instance', () => {
    // Someone launched the app again: surface the running instance instead.
    focusWindow();
  });

  app.whenReady().then(() => {
    let database: ReturnType<typeof initDatabase>;
    try {
      database = initDatabase();
    } catch (err) {
      // A leftover lock from a crashed process is the usual cause. Clear it and
      // retry once before giving up.
      console.error('Database open failed, attempting lock recovery:', err);
      if (clearStaleLock()) {
        database = initDatabase();
      } else {
        throw err;
      }
    }

    // Import any data left behind by the previous "My Links" app. Runs on every
    // startup; it is a safe no-op once imported or when no legacy data exists.
    try {
      importLegacyData(database);
    } catch (err) {
      // A failed import must never stop the app from starting: the user's own
      // DailyPlanner data is untouched, so log and continue.
      console.error('Legacy data import skipped due to an unexpected error:', err);
    }

    restoreSession();
    createWindow();
    createTray();

    app.on('activate', () => focusWindow());
  }).catch((err) => {
    // Without a database the app cannot authenticate anyone; failing silently
    // here is what turned a lock error into an unexplained "Something went
    // wrong" in the UI.
    console.error('Fatal: failed to initialise the database.', err);
    dialog.showErrorBox(
      'Cannot open the database',
      `The app could not open its database file.\n\n${String(err)}\n\n` +
        'Close any other running copy of the app and try again.'
    );
    app.exit(1);
  });

  // Closing the window hides it to the tray (see the 'close' handler), so the
  // app keeps running after the last window is gone - hence no app.quit() here.
  app.on('window-all-closed', () => {
    // Intentionally empty: the tray keeps the app alive until "Quit".
  });

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('will-quit', () => {
    tray?.destroy();
    tray = null;
  });
}
