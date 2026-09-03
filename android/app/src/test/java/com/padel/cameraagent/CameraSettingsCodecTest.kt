package com.padel.cameraagent

import org.junit.Assert.assertEquals
import org.junit.Test

class CameraSettingsCodecTest {
    @Test
    fun roundTripsEverySavedManualValue() {
        val expected = ManualCameraSettings(
            exposureMode = ExposureMode.MANUAL,
            iso = 1_250,
            exposureTimeNs = 10_000_000L,
            autoFocus = false,
            focusDistanceDiopters = 0.75f,
            autoWhiteBalance = false,
            whiteBalanceKelvin = 4_600,
            whiteBalanceAnchorKelvin = 5_270,
            whiteBalanceAnchorRedGain = 1.48f,
            whiteBalanceAnchorGreenEvenGain = 1f,
            whiteBalanceAnchorGreenOddGain = 1f,
            whiteBalanceAnchorBlueGain = 2.72f,
        )

        assertEquals(expected, CameraSettingsCodec.decode(CameraSettingsCodec.encode(expected)))
    }

    @Test
    fun missingOrInvalidValuesFallBackToSafeAutomaticDefaults() {
        val decoded = CameraSettingsCodec.decode(
            mapOf(
                CameraSettingsCodec.KEY_EXPOSURE_MODE to "garbage",
                CameraSettingsCodec.KEY_ISO to "broken",
                CameraSettingsCodec.KEY_EXPOSURE_NS to -5L,
                CameraSettingsCodec.KEY_FOCUS_DIOPTERS to Float.NaN,
                CameraSettingsCodec.KEY_WB_KELVIN to 0,
            ),
        )

        assertEquals(ManualCameraSettings.defaults(), decoded)
    }
}

class ExposureModeCodecTest {
    @Test
    fun legacyBooleanKeyMapsToAutoAndManual() {
        assertEquals(
            ExposureMode.AUTO,
            CameraSettingsCodec.decodeExposureMode(mapOf(CameraSettingsCodec.KEY_AUTO_EXPOSURE_LEGACY to true)),
        )
        assertEquals(
            ExposureMode.MANUAL,
            CameraSettingsCodec.decodeExposureMode(mapOf(CameraSettingsCodec.KEY_AUTO_EXPOSURE_LEGACY to false)),
        )
    }

    @Test
    fun stringKeyRoundTripsAllFourModes() {
        for (mode in ExposureMode.entries) {
            assertEquals(mode, CameraSettingsCodec.decodeExposureMode(mapOf(CameraSettingsCodec.KEY_EXPOSURE_MODE to mode.key)))
        }
    }

    @Test
    fun unknownOrMissingModeFallsBackToAuto() {
        assertEquals(ExposureMode.AUTO, CameraSettingsCodec.decodeExposureMode(mapOf(CameraSettingsCodec.KEY_EXPOSURE_MODE to "cinema")))
        assertEquals(ExposureMode.AUTO, CameraSettingsCodec.decodeExposureMode(emptyMap()))
    }
}
