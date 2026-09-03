package com.padel.cameraagent

import android.content.Context
import android.content.SharedPreferences
import android.os.SystemClock
import java.io.File

/** Root-readable progress contract for the Magisk watchdog. */
class StreamHealthStore(
    context: Context,
    private val preferences: SharedPreferences,
) {
    private val healthFile = File(context.filesDir, FILE_NAME)
    private var lastFrames = 0L
    private var lastProgressMs = SystemClock.elapsedRealtime()
    private var connection = "idle"

    fun isDesired(): Boolean = preferences.getBoolean(KEY_STREAM_DESIRED, true)

    @Synchronized
    fun setDesired(desired: Boolean) {
        preferences.edit().putBoolean(KEY_STREAM_DESIRED, desired).commit()
        write(desired)
    }

    @Synchronized
    fun markAttempt(nextConnection: String) {
        connection = nextConnection
        lastFrames = 0L
        lastProgressMs = SystemClock.elapsedRealtime()
        write(isDesired())
    }

    @Synchronized
    fun record(frames: Long, nextConnection: String) {
        connection = nextConnection
        if (frames > lastFrames) lastProgressMs = SystemClock.elapsedRealtime()
        lastFrames = frames.coerceAtLeast(lastFrames)
        write(isDesired())
    }

    @Synchronized
    fun markConnection(nextConnection: String) {
        connection = nextConnection
        write(isDesired())
    }

    private fun write(desired: Boolean) {
        val contents = buildString {
            append("desired=").append(if (desired) 1 else 0).append('\n')
            append("updated_elapsed_ms=").append(lastProgressMs).append('\n')
            append("frames=").append(lastFrames).append('\n')
            append("connection=").append(connection.replace(Regex("[^a-zA-Z0-9_-]"), "_")).append('\n')
        }
        val temporary = File(healthFile.parentFile, "$FILE_NAME.tmp")
        temporary.writeText(contents)
        if (!temporary.renameTo(healthFile)) {
            healthFile.writeText(contents)
            temporary.delete()
        }
    }

    companion object {
        const val KEY_STREAM_DESIRED = "stream_desired"
        const val EXTRA_OPERATOR_DESIRED = "operator_desired"
        const val FILE_NAME = "stream-health.properties"
    }
}
