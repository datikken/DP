/**
 * URL validation shared by the main process (authoritative) and the renderer
 * (for instant feedback). The main-process check in database.ts is the source
 * of truth; the renderer copy just avoids a round-trip for obvious mistakes.
 */

export type UrlValidation =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Validates and normalizes a URL string.
 * - Must be non-empty.
 * - Must parse as an absolute URL with an `http:` or `https:` scheme.
 * - Must have a non-empty hostname (e.g. "example.com", not just "http://").
 *
 * Returns the trimmed, normalized URL on success.
 */
export function validateUrl(raw: string | null | undefined): UrlValidation {
  const value = (raw ?? '').trim();

  if (!value) {
    return { ok: false, error: 'URL is required.' };
  }

  // Reject whitespace inside the URL (e.g. "example .com", "http://a b.com").
  if (/\s/.test(value)) {
    return { ok: false, error: 'URL must not contain spaces.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return {
      ok: false,
      error: 'Enter a valid URL, e.g. https://example.com/page',
    };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'URL must start with http:// or https://' };
  }

  if (!parsed.hostname) {
    return { ok: false, error: 'URL is missing a hostname.' };
  }

  // A bare hostname like "http://" or "https://example" (no dot, not localhost)
  // is almost certainly a mistake. Allow localhost and IP addresses.
  const host = parsed.hostname;
  const isLocalhost = host === 'localhost';
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':');
  if (!isLocalhost && !isIp && !host.includes('.')) {
    return {
      ok: false,
      error: 'URL hostname looks invalid, e.g. https://example.com',
    };
  }

  // Return the normalized URL (WHATWG parser canonicalizes it).
  return { ok: true, url: parsed.toString() };
}
