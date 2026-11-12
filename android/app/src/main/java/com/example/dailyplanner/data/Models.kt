package com.example.dailyplanner.data

// Domain models, mirroring the original src/types.ts.

data class AuthUser(
    val id: Long,
    val username: String
)

sealed interface AuthResult {
    data class Success(val user: AuthUser) : AuthResult
    data class Failure(val error: String) : AuthResult
}

/**
 * A saved link. `pinned` replaces the original 0/1 integer; `name` is null
 * when the user gave none; status fields are filled in by the checker.
 */
data class Link(
    val id: Long,
    val userId: Long,
    val url: String,
    val name: String?,
    val httpStatus: Int?,
    val lastCheck: String?,
    val createdAt: String?,
    val updatedAt: String?,
    val pinned: Boolean,
    val position: Int
)

/** Fields required to create a link: only a URL; the name is optional. */
data class LinkCreateInput(
    val url: String,
    val name: String?
)

/** Fields a user may set when updating a link. */
data class LinkUpdateInput(
    val url: String,
    val name: String?,
    val httpStatus: Int?,
    val lastCheck: String?
)

sealed interface LinkResult {
    data class Success(val link: Link) : LinkResult
    data class Failure(val error: String) : LinkResult
}

sealed interface LinkListResult {
    data class Success(val links: List<Link>) : LinkListResult
    data class Failure(val error: String) : LinkListResult
}

sealed interface LinkDeleteResult {
    data class Success(val id: Long) : LinkDeleteResult
    data class Failure(val error: String) : LinkDeleteResult
}

/** Outcome of an HTTP status check. status == 0 means the request failed. */
data class CheckOutcome(
    val status: Int,
    val error: String?
)
