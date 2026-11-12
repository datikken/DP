package com.example.dailyplanner.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

/** Persisted "last logged-in user" record (replaces session.json). */
data class StoredSession(
    val userId: Long,
    val username: String
)

private val Context.sessionDataStore by preferencesDataStore(name = "session")

/**
 * Remembers the last account so reopening the app restores the session without
 * a password prompt. Only an explicit log-out clears it.
 */
class SessionStore(private val context: Context) {

    private object Keys {
        val userId = longPreferencesKey("last_user_id")
        val username = stringPreferencesKey("last_username")
    }

    suspend fun load(): StoredSession? {
        val prefs = context.sessionDataStore.data.first()
        val id = prefs[Keys.userId] ?: return null
        val name = prefs[Keys.username] ?: return null
        return StoredSession(userId = id, username = name)
    }

    suspend fun save(session: StoredSession) {
        context.sessionDataStore.edit { prefs ->
            prefs[Keys.userId] = session.userId
            prefs[Keys.username] = session.username
        }
    }

    suspend fun clear() {
        context.sessionDataStore.edit { prefs ->
            prefs.remove(Keys.userId)
            prefs.remove(Keys.username)
        }
    }
}
