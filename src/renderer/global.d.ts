import type {
  AuthResult,
  LinkCheckResult,
  LinkCreateInput,
  LinkDeleteResult,
  LinkListResult,
  LinkResult,
  LinkUpdateInput,
  OpenExternalResult,
} from '../types';

declare global {
  interface Window {
    auth: {
      register: (username: string, password: string) => Promise<AuthResult>;
      login: (username: string, password: string) => Promise<AuthResult>;
      logout: () => Promise<{ ok: true }>;
      current: () => Promise<number | null>;
      session: () => Promise<{ id: number; username: string } | null>;
      onLoggedOut: (callback: () => void) => void;
    };
    links: {
      list: () => Promise<LinkListResult>;
      get: (id: number) => Promise<LinkResult>;
      create: (input: LinkCreateInput) => Promise<LinkResult>;
      update: (id: number, input: LinkUpdateInput) => Promise<LinkResult>;
      remove: (id: number) => Promise<LinkDeleteResult>;
      check: (id: number) => Promise<LinkCheckResult>;
      reorder: (orderedIds: number[], pinnedCount: number) => Promise<LinkListResult>;
      pin: (id: number, pinned: boolean) => Promise<LinkResult>;
      openExternal: (url: string) => Promise<OpenExternalResult>;
    };
  }
}

export {};
