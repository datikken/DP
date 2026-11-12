package com.example.dailyplanner.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

/**
 * Performs an HTTP(S) request against a URL and returns the final status code
 * (following redirects). Ported from the original src/checker.ts.
 *
 * A realistic desktop Chrome User-Agent is sent so sites answer as they would
 * to a real browser instead of serving a bot page.
 */
class LinkChecker(
    private val client: OkHttpClient = defaultClient()
) {

    /** Resolves (never throws) so the caller can always record an outcome. */
    suspend fun check(url: String, timeoutMs: Long = 15_000): CheckOutcome {
        val request = runCatching {
            Request.Builder()
                .url(url)
                .header("User-Agent", BROWSER_USER_AGENT)
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .header("Accept-Language", "en-US,en;q=0.9")
                .header("Cache-Control", "no-cache")
                .get()
                .build()
        }.getOrElse { err ->
            return CheckOutcome(status = 0, error = err.message ?: "Invalid request URL.")
        }

        return withContext(Dispatchers.IO) {
            withTimeoutOrNull(timeoutMs) {
                runCatching {
                    client.newCall(request).execute().use { response ->
                        // We only need the status; the body is discarded.
                        CheckOutcome(status = response.code, error = null)
                    }
                }.getOrElse { err ->
                    CheckOutcome(status = 0, error = err.message ?: "Network error.")
                }
            } ?: CheckOutcome(status = 0, error = "Request timed out.")
        }
    }

    private companion object {
        // A realistic desktop Chrome User-Agent.
        const val BROWSER_USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"

        fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            .followRedirects(true)
            .followSslRedirects(true)
            .callTimeout(20, TimeUnit.SECONDS)
            .build()
    }
}
