package com.example.dailyplanner.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Transaction

/**
 * All queries are scoped to `user_id`, mirroring the main-process ownership
 * model of the original app: a user only ever sees/modifies their own rows.
 *
 * The shared ORDER BY keeps pinned links first, then manual position, with id
 * as a stable tiebreaker (the original LINK_ORDER constant).
 */
@Dao
interface LinkDao {

    @Query(
        """
        SELECT * FROM links WHERE user_id = :userId
        ORDER BY pinned DESC, position ASC, id ASC
        """
    )
    suspend fun listForUser(userId: Long): List<LinkEntity>

    @Query("SELECT * FROM links WHERE id = :id AND user_id = :userId LIMIT 1")
    suspend fun getForUser(userId: Long, id: Long): LinkEntity?

    @Query("SELECT id FROM links WHERE user_id = :userId")
    suspend fun idsForUser(userId: Long): List<Long>

    @Query("SELECT COALESCE(MAX(position), -1) + 1 AS next FROM links WHERE user_id = :userId")
    suspend fun nextPosition(userId: Long): Int

    @Query("SELECT id FROM links WHERE user_id = :userId ORDER BY pinned DESC, position ASC, id ASC")
    suspend fun orderedIdsForUser(userId: Long): List<Long>

    @Insert
    suspend fun insert(link: LinkEntity): Long

    @Query(
        """
        UPDATE links
        SET url = :url, name = :name, http_status = :httpStatus,
            last_check = :lastCheck, updated_at = :now
        WHERE id = :id AND user_id = :userId
        """
    )
    suspend fun update(
        userId: Long,
        id: Long,
        url: String,
        name: String?,
        httpStatus: Int?,
        lastCheck: String?,
        now: String
    ): Int

    @Query(
        """
        UPDATE links
        SET http_status = :httpStatus, last_check = :now, updated_at = :now
        WHERE id = :id AND user_id = :userId
        """
    )
    suspend fun recordCheck(userId: Long, id: Long, httpStatus: Int?, now: String): Int

    @Query(
        """
        UPDATE links SET last_check = :now, updated_at = :now
        WHERE id = :id AND user_id = :userId
        """
    )
    suspend fun touchLastCheck(userId: Long, id: Long, now: String): Int

    @Query("UPDATE links SET pinned = :pinned, updated_at = :now WHERE id = :id AND user_id = :userId")
    suspend fun setPinned(userId: Long, id: Long, pinned: Int, now: String): Int

    @Query("UPDATE links SET pinned = :pinned, position = :position WHERE id = :id AND user_id = :userId")
    suspend fun setPinnedAndPosition(userId: Long, id: Long, pinned: Int, position: Int): Int

    @Query("UPDATE links SET position = :position WHERE id = :id AND user_id = :userId")
    suspend fun setPosition(userId: Long, id: Long, position: Int): Int

    @Query("DELETE FROM links WHERE id = :id AND user_id = :userId")
    suspend fun delete(userId: Long, id: Long): Int

    /**
     * Persists a new manual order in one transaction, deriving each link's
     * pinned flag from its index (the first [pinnedCount] are pinned).
     */
    @Transaction
    suspend fun reorder(userId: Long, orderedIds: List<Long>, pinnedCount: Int) {
        orderedIds.forEachIndexed { index, id ->
            val pinned = if (index < pinnedCount) 1 else 0
            setPinnedAndPosition(userId, id, pinned, index)
        }
    }

    /**
     * Rewrites every position for a user as 0..n-1 in the current display
     * order, keeping the two groups (pinned first) contiguous.
     */
    @Transaction
    suspend fun normalisePositions(userId: Long) {
        orderedIdsForUser(userId).forEachIndexed { index, id ->
            setPosition(userId, id, index)
        }
    }
}
