package com.padel.cameraagent

enum class RecoveryAction { NONE, COLD_RESTART, REBOOT_DEVICE }

object StreamRecoveryPolicy {
    const val STALE_AFTER_MS = 90_000L
    const val FAILURES_BEFORE_REBOOT = 5
    const val REBOOT_COOLDOWN_MS = 30L * 60L * 1_000L

    fun decide(
        nowMs: Long,
        streamDesired: Boolean,
        lastProgressMs: Long,
        consecutiveFailures: Int,
        lastRebootMs: Long?,
    ): RecoveryAction {
        if (!streamDesired || nowMs - lastProgressMs < STALE_AFTER_MS) return RecoveryAction.NONE
        val rebootAllowed = consecutiveFailures >= FAILURES_BEFORE_REBOOT &&
            (lastRebootMs == null || nowMs - lastRebootMs >= REBOOT_COOLDOWN_MS)
        return if (rebootAllowed) RecoveryAction.REBOOT_DEVICE else RecoveryAction.COLD_RESTART
    }

    fun updatedFailureCount(current: Int, madeProgress: Boolean): Int =
        if (madeProgress) 0 else current.coerceAtLeast(0)
}
