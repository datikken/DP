import { contextBridge, ipcRenderer } from 'electron';
import type {
  AuthResult,
  LinkCheckResult,
  LinkCreateInput,
  LinkDeleteResult,
  LinkListResult,
  LinkResult,
  LinkUpdateInput,
  OpenExternalResult,
} from './types';

const authApi = {
  register: (username: string, password: string): Promise<AuthResult> =>
    ipcRenderer.invoke('auth:register', { username, password }),
  login: (username: string, password: string): Promise<AuthResult> =>
    ipcRenderer.invoke('auth:login', { username, password }),
  logout: (): Promise<{ ok: true }> => ipcRenderer.invoke('auth:logout'),
  current: (): Promise<number | null> => ipcRenderer.invoke('auth:current'),
  /** The remembered session (id + username), or null when signed out. */
  session: (): Promise<{ id: number; username: string } | null> =>
    ipcRenderer.invoke('auth:session'),
  /** Fires when the session is ended from the main process (tray "Log out"). */
  onLoggedOut: (callback: () => void): void => {
    ipcRenderer.on('session:logged-out', () => callback());
  },
};

const linksApi = {
  list: (): Promise<LinkListResult> => ipcRenderer.invoke('link:list'),
  get: (id: number): Promise<LinkResult> =>
    ipcRenderer.invoke('link:get', { id }),
  create: (input: LinkCreateInput): Promise<LinkResult> =>
    ipcRenderer.invoke('link:create', { input }),
  update: (id: number, input: LinkUpdateInput): Promise<LinkResult> =>
    ipcRenderer.invoke('link:update', { id, input }),
  remove: (id: number): Promise<LinkDeleteResult> =>
    ipcRenderer.invoke('link:delete', { id }),
  check: (id: number): Promise<LinkCheckResult> =>
    ipcRenderer.invoke('link:check', { id }),
  /** Persists a drag-and-drop order; the first `pinnedCount` ids are pinned. */
  reorder: (orderedIds: number[], pinnedCount: number): Promise<LinkListResult> =>
    ipcRenderer.invoke('link:reorder', { orderedIds, pinnedCount }),
  /** Pins or unpins a single link. */
  pin: (id: number, pinned: boolean): Promise<LinkResult> =>
    ipcRenderer.invoke('link:pin', { id, pinned }),
  /** Opens a saved link in the operating system's default browser. */
  openExternal: (url: string): Promise<OpenExternalResult> =>
    ipcRenderer.invoke('link:openExternal', { url }),
};

contextBridge.exposeInMainWorld('auth', authApi);
contextBridge.exposeInMainWorld('links', linksApi);

export type AuthApi = typeof authApi;
export type LinksApi = typeof linksApi;
