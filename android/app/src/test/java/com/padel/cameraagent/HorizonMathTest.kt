package com.padel.cameraagent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HorizonMathTest {
    @Test fun portraitAndBothLandscapeRotationsReportLevel() {
        assertEquals(0f, HorizonMath.fromGravity(0f, -9.81f, 0f, 0).rollDegrees, 0.1f)
        assertEquals(0f, HorizonMath.fromGravity(9.81f, 0f, 0f, 1).rollDegrees, 0.1f)
        assertEquals(0f, HorizonMath.fromGravity(-9.81f, 0f, 0f, 3).rollDegrees, 0.1f)
    }

    @Test fun landscapeTiltUsesGravityProjectedIntoTheScreen() {
        val reading = HorizonMath.fromGravity(6.936f, 6.936f, 0f, 1)
        assertTrue(reading.valid)
        assertEquals(45f, reading.rollDegrees, 0.2f)
    }

    @Test fun faceUpPhoneIsInvalidButUprightCameraIsValid() {
        assertFalse(HorizonMath.fromGravity(0f, 0f, 9.81f, 1).valid)
        assertTrue(HorizonMath.fromGravity(9.81f, 0f, 0f, 1).valid)
    }
}
