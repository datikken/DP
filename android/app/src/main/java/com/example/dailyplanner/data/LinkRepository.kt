package com.example.dailyplanner.data

import at.favre.lib.crypto.bcrypt.BCrypt
import com.example.dailyplanner.data.db.AppDatabase
import com.example.dailyplanner.data.db.LinkEntity
import com.example.dailyplanner.data.db.UserEntity
import com.example.dailyplanner.data.db.toDomain
import com.example.dailyplanner.util.UrlValidation
import com.example.dailyplanner.util.validateUrl
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Business logic for authentication and link CRUD, ported from the original
 * src/database.ts (and the ownership checks that lived in the IPC handlers).
 */
class LinkRepository(
    private val db: AppDatabase,
    private val checker: LinkChecker = LinkChecker()
) {
    private val userDao = db.userDao()
    private val linkDao = db.linkDao()

    private val timestampFormat =
        SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)

    private fun now(): String = timestampFormat.format(Date())

    // ---- Authentication ----

    suspend fun register(username: String, password: String): AuthResult =
        withContext(Dispatchers.IO) {
            val trimmed = username.trim()
            if (trimmed.isEmpty() || password.isEmpty()) {
                return@withContext AuthResult.Failure("Username and password are required.")
            }
            if (trimmed.length < 3) {
                return@withContext AuthResult.Failure("Username must be at least 3 characters.")
            }
            if (password.length < 4) {
                return@withContext AuthResult.Failure("Password must be at least 4 characters.")
            }
            if (userDao.findIdByUsername(trimmed) != null) {
                return@withContext AuthResult.Failure("That username is already taken.")
            }

            val hash = BCrypt.withDefaults().hashToString(10, password.toCharArray())
            val id = userDao.insert(
                UserEntity(
                    username = trimmed,
                    passwordHash = hash,
                    createdAt = now()
                )
            )
            AuthResult.Success(AuthUser(id = id, username = trimmed))
        }

    suspend fun login(username: String, password: String): AuthResult =
        withContext(Dispatchers.IO) {
            val trimmed = username.trim()
            if (trimmed.isEmpty() || password.isEmpty()) {
                return@withContext AuthResult.Failure("Username and password are required.")
            }

            val row = userDao.findByUsername(trimmed)
                ?: return@withContext AuthResult.Failure("Invalid username or password.")

            val valid = BCrypt.verifyer()
                .verify(password.toCharArray(), row.passwordHash)
                .verified
            if (!valid) {
                return@withContext AuthResult.Failure("Invalid username or password.")
            }
            AuthResult.Success(AuthUser(id = row.id, username = row.username))
        }

    // ---- Link CRUD (all scoped to the owning user) ----

    suspend fun listLinks(userId: Long): LinkListResult =
        withContext(Dispatchers.IO) {
            val rows = linkDao.listForUser(userId).map { it.toDomain() }
            LinkListResult.Success(rows)
        }

    suspend fun getLink(userId: Long, id: Long): LinkResult =
        withContext(Dispatchers.IO) {
            val row = linkDao.getForUser(userId, id)
                ?: return@withContext LinkResult.Failure("Link not found.")
            LinkResult.Success(row.toDomain())
        }

    suspend fun createLink(userId: Long, input: LinkCreateInput): LinkResult =
        withContext(Dispatchers.IO) {
            val validation = validateUrl(input.url)
            if (validation !is UrlValidation.Valid) {
                return@withContext LinkResult.Failure(
                    (validation as UrlValidation.Invalid).error
                )
            }

            val ts = now()
            val id = linkDao.insert(
                LinkEntity(
                    userId = userId,
                    url = validation.url,
                    name = normalizeNullableText(input.name),
                    httpStatus = null,
                    lastCheck = null,
                    createdAt = ts,
                    updatedAt = ts,
                    pinned = 0,
                    position = linkDao.nextPosition(userId)
                )
            )
            val created = linkDao.getForUser(userId, id)
                ?: return@withContext LinkResult.Failure("Link not found.")
            LinkResult.Success(created.toDomain())
        }

    suspend fun updateLink(userId: Long, id: Long, input: LinkUpdateInput): LinkResult =
        withContext(Dispatchers.IO) {
            if (linkDao.getForUser(userId, id) == null) {
                return@withContext LinkResult.Failure("Link not found.")
            }
            val validation = validateUrl(input.url)
            if (validation !is UrlValidation.Valid) {
                return@withContext LinkResult.Failure(
                    (validation as UrlValidation.Invalid).error
                )
            }

            val changed = linkDao.update(
                userId = userId,
                id = id,
                url = validation.url,
                name = normalizeNullableText(input.name),
                httpStatus = input.httpStatus,
                lastCheck = normalizeNullableText(input.lastCheck),
                now = now()
            )
            if (changed == 0) return@withContext LinkResult.Failure("Link not found.")

            val row = linkDao.getForUser(userId, id)
                ?: return@withContext LinkResult.Failure("Link not found.")
            LinkResult.Success(row.toDomain())
        }

    suspend fun deleteLink(userId: Long, id: Long): LinkDeleteResult =
        withContext(Dispatchers.IO) {
            val changed = linkDao.delete(userId, id)
            if (changed == 0) LinkDeleteResult.Failure("Link not found.")
            else LinkDeleteResult.Success(id)
        }

    /**
     * Persists a manual drag-and-drop order. `orderedIds` must list every link
     * the user owns exactly once; the first `pinnedCount` are pinned.
     */
    suspend fun reorderLinks(
        userId: Long,
        orderedIds: List<Long>,
        pinnedCount: Int
    ): LinkListResult = withContext(Dispatchers.IO) {
        val ownedIds = linkDao.idsForUser(userId).toSet()

        if (orderedIds.size != ownedIds.size) {
            return@withContext LinkListResult.Failure(
                "Order does not match the number of stored links."
            )
        }
        if (orderedIds.toSet().size != orderedIds.size) {
            return@withContext LinkListResult.Failure("Order contains a duplicate link.")
        }
        if (!ownedIds.containsAll(orderedIds)) {
            return@withContext LinkListResult.Failure("Order contains an unknown link.")
        }
        if (pinnedCount < 0 || pinnedCount > orderedIds.size) {
            return@withContext LinkListResult.Failure("Invalid pinned count.")
        }

        linkDao.reorder(userId, orderedIds, pinnedCount)
        listLinks(userId)
    }

    /**
     * Pins or unpins a single link, then normalises positions so the two groups
     * stay contiguous.
     */
    suspend fun setLinkPinned(userId: Long, id: Long, pinned: Boolean): LinkResult =
        withContext(Dispatchers.IO) {
            if (linkDao.getForUser(userId, id) == null) {
                return@withContext LinkResult.Failure("Link not found.")
            }
            linkDao.setPinned(userId, id, if (pinned) 1 else 0, now())
            linkDao.normalisePositions(userId)

            val row = linkDao.getForUser(userId, id)
                ?: return@withContext LinkResult.Failure("Link not found.")
            LinkResult.Success(row.toDomain())
        }

    /**
     * Runs an HTTP check for a link and persists the result.
     *
     * A failed request (status 0: DNS/timeout/refused) records only last_check,
     * leaving the previously known status intact, so one flaky attempt does not
     * overwrite a good result with "failed".
     */
    suspend fun checkLink(userId: Long, id: Long): LinkResult = withContext(Dispatchers.IO) {
        val existing = linkDao.getForUser(userId, id)
            ?: return@withContext LinkResult.Failure("Link not found.")

        val outcome = checker.check(existing.url)

        if (outcome.status == 0) {
            linkDao.touchLastCheck(userId, id, now())
            return@withContext LinkResult.Failure(outcome.error ?: "Request failed.")
        }

        linkDao.recordCheck(userId, id, outcome.status, now())
        val row = linkDao.getForUser(userId, id)
            ?: return@withContext LinkResult.Failure("Link not found.")
        LinkResult.Success(row.toDomain())
    }

    private fun normalizeNullableText(value: String?): String? {
        val trimmed = value?.trim()
        return if (trimmed.isNullOrEmpty()) null else trimmed
    }
}
