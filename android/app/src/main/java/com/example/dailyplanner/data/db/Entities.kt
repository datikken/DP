package com.example.dailyplanner.data.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import com.example.dailyplanner.data.Link

@Entity(
    tableName = "users",
    indices = [Index(value = ["username"], unique = true)]
)
data class UserEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "username") val username: String,
    @ColumnInfo(name = "password_hash") val passwordHash: String,
    @ColumnInfo(name = "created_at") val createdAt: String
)

@Entity(
    tableName = "links",
    foreignKeys = [
        ForeignKey(
            entity = UserEntity::class,
            parentColumns = ["id"],
            childColumns = ["user_id"],
            onDelete = ForeignKey.CASCADE
        )
    ],
    indices = [
        Index(value = ["user_id"]),
        Index(value = ["user_id", "pinned", "position"])
    ]
)
data class LinkEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "user_id") val userId: Long,
    val url: String,
    val name: String?,
    @ColumnInfo(name = "http_status") val httpStatus: Int?,
    @ColumnInfo(name = "last_check") val lastCheck: String?,
    @ColumnInfo(name = "created_at") val createdAt: String,
    @ColumnInfo(name = "updated_at") val updatedAt: String,
    /** 1 when pinned, 0 otherwise. SQLite-friendly integer form. */
    val pinned: Int,
    /** Manual sort order within the pinned/unpinned group. Lower comes first. */
    val position: Int
)

/** Maps the persisted row to the domain model. */
fun LinkEntity.toDomain(): Link = Link(
    id = id,
    userId = userId,
    url = url,
    name = name,
    httpStatus = httpStatus,
    lastCheck = lastCheck,
    createdAt = createdAt,
    updatedAt = updatedAt,
    pinned = pinned == 1,
    position = position
)
