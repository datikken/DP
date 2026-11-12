package com.example.dailyplanner.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [UserEntity::class, LinkEntity::class],
    version = 3,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun userDao(): UserDao
    abstract fun linkDao(): LinkDao

    companion object {
        @Volatile
        private var instance: AppDatabase? = null

        fun get(context: Context): AppDatabase =
            instance ?: synchronized(this) {
                instance ?: build(context.applicationContext).also { instance = it }
            }

        private fun build(context: Context): AppDatabase =
            Room.databaseBuilder(context, AppDatabase::class.java, "app.db")
                // Replicate the original migration chain:
                //  v1: url_short NOT NULL
                //  v2: url_short nullable, added pinned + position
                //  v3: url_short renamed to name
                .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                .build()
    }
}

/**
 * v1 -> v2: the short URL became optional (nullable) and manual ordering was
 * introduced. SQLite cannot drop a NOT NULL constraint in place, so the table
 * is rebuilt once; existing rows get pinned = 0 and a position backfilled from
 * their current id order.
 */
private val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE links_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              url TEXT NOT NULL,
              url_short TEXT,
              http_status INTEGER,
              last_check TEXT,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            INSERT INTO links_new (id, user_id, url, url_short, http_status, last_check, created_at, updated_at)
            SELECT id, user_id, url, url_short, http_status, last_check, created_at, updated_at FROM links
            """.trimIndent()
        )
        db.execSQL("DROP TABLE links")
        db.execSQL("ALTER TABLE links_new RENAME TO links")
        db.execSQL("CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id)")

        db.execSQL("ALTER TABLE links ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0")
        db.execSQL("ALTER TABLE links ADD COLUMN position INTEGER NOT NULL DEFAULT 0")

        // Backfill distinct consecutive positions in the current display order.
        val cursor = db.query(
            "SELECT id FROM links ORDER BY created_at DESC, id DESC"
        )
        val ids = mutableListOf<Long>()
        cursor.use {
            while (it.moveToNext()) ids.add(it.getLong(0))
        }
        ids.forEachIndexed { index, id ->
            db.execSQL("UPDATE links SET position = ? WHERE id = ?", arrayOf<Any>(index, id))
        }
        db.execSQL(
            "CREATE INDEX IF NOT EXISTS idx_links_user_order ON links(user_id, pinned, position)"
        )
    }
}

/** v2 -> v3: rename the `url_short` column to `name`. */
private val MIGRATION_2_3 = object : Migration(2, 3) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE links RENAME COLUMN url_short TO name")
    }
}
