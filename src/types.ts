export interface AuthUser {
  id: number;
  username: string;
}

export type AuthResult =
  | { ok: true; user: AuthUser }
  | { ok: false; error: string };

export interface Link {
  id: number;
  user_id: number;
  url: string;
  /** Display name for the link; null when the user gave none. */
  name: string | null;
  http_status: number | null;
  last_check: string | null;
  created_at: string;
  updated_at: string;
  /** 1 when the link is pinned, 0 otherwise. Pinned links sort first. */
  pinned: number;
  /** Manual sort order within the pinned/unpinned group. Lower comes first. */
  position: number;
}

/**
 * Fields required to create a link. Only a URL is needed; the name is optional
 * (it can be added later), and http_status / last_check are not set on creation
 * (they are populated by the checker).
 */
export interface LinkCreateInput {
  url: string;
  name?: string | null;
}

/** Fields a user may set when updating a link. */
export interface LinkUpdateInput {
  url: string;
  name?: string | null;
  http_status?: number | null;
  last_check?: string | null;
}

export type LinkResult =
  | { ok: true; link: Link }
  | { ok: false; error: string };

export type LinkListResult =
  | { ok: true; links: Link[] }
  | { ok: false; error: string };

/**
 * Result of a reorder operation: the full, freshly ordered list so the renderer
 * can trust the server's ordering instead of guessing.
 */
export type LinkReorderResult =
  | { ok: true; links: Link[] }
  | { ok: false; error: string };

/** Result of checking a link's URL: the updated link (with fresh status). */
export type LinkCheckResult =
  | { ok: true; link: Link }
  | { ok: false; error: string };

export type LinkDeleteResult =
  | { ok: true; id: number }
  | { ok: false; error: string };

/** Result of asking the OS to open a link in the default browser. */
export type OpenExternalResult =
  | { ok: true }
  | { ok: false; error: string };

