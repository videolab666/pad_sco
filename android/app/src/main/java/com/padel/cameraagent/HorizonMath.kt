package com.padel.cameraagent

import kotlin.math.atan2
import kotlin.math.hypot
import kotlin.math.sqrt

data class HorizonReading(
    val valid: Boolean,
    val rollDegrees: Float,
)

object HorizonMath {
    private const val MIN_SCREEN_PROJECTION_RATIO = 0.25f

    /** displayRotation uses the Surface.ROTATION_* integer values 0..3. */
    fun fromGravity(gx: Float, gy: Float, gz: Float, displayRotation: Int): HorizonReading {
        val (screenX, screenDown) = when (displayRotation) {
            1 -> gy to gx
            2 -> -gx to gy
            3 -> -gy to -gx
            else -> gx to -gy
        }
        val magnitude = sqrt(gx * gx + gy * gy + gz * gz)
        val projected = hypot(screenX, screenDown)
        val valid = magnitude > 0.01f && projected / magnitude >= MIN_SCREEN_PROJECTION_RATIO
        val roll = if (valid) Math.toDegrees(atan2(screenX, screenDown).toDouble()).toFloat() else 0f
        return HorizonReading(valid = valid, rollDegrees = roll)
    }
}
