package com.example.dailyplanner.util

import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

/**
 * URL validation, ported from the original src/validation.ts.
 *
 * Returns the normalized URL on success (OkHttp canonicalizes it, much like the
 * browser URL parser did in the Electron version).
 */
sealed interface UrlValidation {
    data class Valid(val url: String) : UrlValidation
    data class Invalid(val error: String) : UrlValidation
}

fun validateUrl(raw: String?): UrlValidation {
    val value = raw?.trim().orEmpty()

    if (value.isEmpty()) {
        return UrlValidation.Invalid("URL is required.")
    }

    // Reject whitespace inside the URL (e.g. "example .com", "http://a b.com").
    if (value.any { it.isWhitespace() }) {
        return UrlValidation.Invalid("URL must not contain spaces.")
    }

    // toHttpUrlOrNull only accepts http/https and a valid absolute URL.
    val parsed = value.toHttpUrlOrNull()
        ?: return UrlValidation.Invalid("Enter a valid URL, e.g. https://example.com/page")

    val host = parsed.host
    if (host.isEmpty()) {
        return UrlValidation.Invalid("URL is missing a hostname.")
    }

    // A bare hostname like "http://example" (no dot, not localhost, not an IP)
    // is almost certainly a mistake. Allow localhost and IPv4/IPv6 literals.
    val isLocalhost = host == "localhost"
    if (!isLocalhost && !isIpLiteral(host) && !host.contains('.')) {
        return UrlValidation.Invalid("URL hostname looks invalid, e.g. https://example.com")
    }

    return UrlValidation.Valid(parsed.toString())
}

private val ipv4Pattern = Regex("""^\d{1,3}(\.\d{1,3}){3}$""")

private fun isIpLiteral(host: String): Boolean =
    ipv4Pattern.matches(host) || host.contains(':')

