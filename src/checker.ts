import { net } from 'electron';

export interface CheckOutcome {
  /** HTTP status code, or 0 when the request failed (DNS/connection/timeout). */
  status: number;
  /** Human-readable error for failures, otherwise null. */
  error: string | null;
}

/**
 * A realistic desktop Chrome User-Agent. Electron's default ("... Electron/xx")
 * is recognised by many sites, which then answer 403/404 or serve a bot page -
 * the status we recorded then disagreed with what a real browser sees.
 */
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';

/** Headers a normal browser navigation sends, so responses match it. */
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': BROWSER_USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
};

/**
 * Performs an HTTP(S) request against the given URL and resolves with the
 * final status code (following redirects). Uses Electron's `net` module so the
 * request goes through Chromium's network stack in the main process — no CORS,
 * no renderer CSP, and no need to bundle an HTTP client.
 *
 * Resolves (never rejects) so the caller can always record an outcome.
 */
export function checkUrlStatus(url: string, timeoutMs = 15000): Promise<CheckOutcome> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (outcome: CheckOutcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(outcome);
    };

    const timer = setTimeout(() => {
      finish({ status: 0, error: 'Request timed out.' });
      try {
        request.abort();
      } catch {
        /* ignore */
      }
    }, timeoutMs);

    let request: Electron.ClientRequest;
    try {
      request = net.request({ method: 'GET', url, redirect: 'follow' });
    } catch (err) {
      finish({
        status: 0,
        error: err instanceof Error ? err.message : 'Invalid request URL.',
      });
      return;
    }

    for (const [name, value] of Object.entries(BROWSER_HEADERS)) {
      try {
        request.setHeader(name, value);
      } catch {
        /* a rejected header is not fatal */
      }
    }

    request.on('response', (response) => {
      // We only need the status; drain and discard any body.
      response.on('data', () => {
        /* discard */
      });
      response.on('end', () => {
        finish({ status: response.statusCode, error: null });
      });
      response.on('error', (err: Error) => {
        finish({ status: 0, error: err?.message || 'Response error.' });
      });
    });

    request.on('error', (err: Error) => {
      finish({ status: 0, error: err?.message || 'Network error.' });
    });

    try {
      request.end();
    } catch (err) {
      finish({
        status: 0,
        error: err instanceof Error ? err.message : 'Request failed to start.',
      });
    }
  });
}
