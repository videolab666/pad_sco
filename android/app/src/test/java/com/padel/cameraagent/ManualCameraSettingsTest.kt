package com.padel.cameraagent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ManualCameraSettingsTest {
    private val onePlusUltraWide = CameraCapabilitiesSnapshot(
        isoRange = 100..6400,
        exposureTimeRangeNs = 100_549L..32_000_004_227L,
        minimumFocusDistanceDiopters = 25f,
        apertures = listOf(2.2f),
        supportsManualSensor = true,
        supportsManualPostProcessing = true,
    )

    @Test
    fun defaultsKeepEveryCameraAlgorithmAutomatic() {
        val settings = ManualCameraSettings.defaults()

        assertTrue(settings.autoExposure)
        assertTrue(settings.autoFocus)
        assertTrue(settings.autoWhiteBalance)
        assertEquals(400, settings.iso)
        assertEquals(10_000_000L, settings.exposureTimeNs)
        assertEquals(0f, settings.focusDistanceDiopters)
        assertEquals(5_000, settings.whiteBalanceKelvin)
    }

    @Test
    fun clampUsesCameraRangesAndThirtyFpsExposureCeiling() {
        val clamped = ManualCameraSettings(
            exposureMode = ExposureMode.MANUAL,
            iso = 12_800,
            exposureTimeNs = 1_000_000_000L,
            autoFocus = false,
            focusDistanceDiopters = 99f,
            autoWhiteBalance = false,
            whiteBalanceKelvin = 15_000,
        ).clampedTo(onePlusUltraWide, fps = 30)

        assertEquals(6_400, clamped.iso)
        assertEquals(33_333_333L, clamped.exposureTimeNs)
        assertEquals(25f, clamped.focusDistanceDiopters)
        assertEquals(10_000, clamped.whiteBalanceKelvin)
    }

    @Test
    fun allAutoPreservesLastManualValuesForNextSwitch() {
        val manual = ManualCameraSettings(
            exposureMode = ExposureMode.MANUAL,
            iso = 800,
            exposureTimeNs = 8_333_333L,
            autoFocus = false,
            focusDistanceDiopters = 0.5f,
            autoWhiteBalance = false,
            whiteBalanceKelvin = 4_300,
        )

        val automatic = manual.allAuto()

        assertTrue(automatic.autoExposure)
        assertTrue(automatic.autoFocus)
        assertTrue(automatic.autoWhiteBalance)
        assertEquals(800, automatic.iso)
        assertEquals(8_333_333L, automatic.exposureTimeNs)
        assertEquals(0.5f, automatic.focusDistanceDiopters)
        assertEquals(4_300, automatic.whiteBalanceKelvin)
    }

    @Test
    fun reportsFixedApertureOnThisLens() {
        assertFalse(onePlusUltraWide.isApertureAdjustable)
        assertEquals(2.2f, onePlusUltraWide.apertures.single())
    }
}

