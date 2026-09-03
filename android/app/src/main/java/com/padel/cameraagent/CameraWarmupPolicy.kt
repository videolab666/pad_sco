package com.padel.cameraagent

/** Preconditions for opening SRT with a stable Camera2 source. */
object CameraWarmupPolicy {
    const val OPEN_TIMEOUT_MS = 2_500L
    const val SETTLE_MS = 500L

    fun isTargetReady(isRunning: Boolean, currentCameraId: String?, targetCameraId: String): Boolean =
        isRunning && currentCameraId == targetCameraId
}
