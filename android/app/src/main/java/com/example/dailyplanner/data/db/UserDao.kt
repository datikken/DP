package com.example.dailyplanner.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query

@Dao
interface UserDao {

    @Query("SELECT id FROM users WHERE username = :username LIMIT 1")
    suspend fun findIdByUsername(username: String): Long?

    @Query("SELECT * FROM users WHERE username = :username LIMIT 1")
    suspend fun findByUsername(username: String): UserEntity?

    @Insert
    suspend fun insert(user: UserEntity): Long
}
