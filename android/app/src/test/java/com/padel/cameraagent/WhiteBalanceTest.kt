package com.padel.cameraagent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WhiteBalanceTest {
    @Test
    fun gainsAreFiniteAndPositiveAcrossSupportedTemperatureRange() {
        listOf(2_000, 5_000, 10_000).forEach { kelvin ->
            val gains = WhiteBalanceConverter.fromKelvin(kelvin)
            listOf(gains.red, gains.greenEven, gains.greenOdd, gains.blue).forEach {
                assertTrue("gain for $kelvin K must be finite", it.isFinite())
                assertTrue("gain for $kelvin K must be positive", it > 0f)
            }
        }
    }

    @Test
    fun coolerLightNeedsMoreBlueGainAndWarmerLightNeedsMoreRedGain() {
        val warmLight = WhiteBalanceConverter.fromKelvin(2_000)
        val coolLight = WhiteBalanceConverter.fromKelvin(10_000)

        assertTrue(warmLight.blue > coolLight.blue)
        assertTrue(coolLight.red > warmLight.red)
    }

    @Test
    fun adjustmentAtAnchorTemperaturePreservesCapturedAutoGains() {
        val captured = WhiteBalanceGains(1.48f, 1f, 1f, 2.72f)

        val adjusted = WhiteBalanceConverter.adjustFromAnchor(captured, 5_270, 5_270)

        assertEquals(captured.red, adjusted.red, 0.0001f)
        assertEquals(captured.greenEven, adjusted.greenEven, 0.0001f)
        assertEquals(captured.greenOdd, adjusted.greenOdd, 0.0001f)
        assertEquals(captured.blue, adjusted.blue, 0.0001f)
    }

    @Test
    fun settingsUsePersistedAnchorForManualWhiteBalance() {
        val settings = ManualCameraSettings.defaults().copy(
            autoWhiteBalance = false,
            whiteBalanceKelvin = 4_300,
            whiteBalanceAnchorKelvin = 5_270,
            whiteBalanceAnchorRedGain = 1.48f,
            whiteBalanceAnchorGreenEvenGain = 1f,
            whiteBalanceAnchorGreenOddGain = 1f,
            whiteBalanceAnchorBlueGain = 2.72f,
        )

        val actual = settings.manualWhiteBalanceGains()
        val warm = settings.copy(whiteBalanceKelvin = 3_200).manualWhiteBalanceGains()

        assertTrue(actual.red.isFinite())
        assertTrue(actual.blue.isFinite())
        assertTrue(warm.blue > actual.blue)
    }
}
