package com.padel.cameraagent

import org.junit.Assert.assertEquals
import org.junit.Test

class ImageAdjustmentsTest {
    @Test fun defaultsAreNeutral() {
        assertEquals(ImageAdjustments(0f, 1f, 1f), ImageAdjustments.defaults())
    }

    @Test fun valuesAreClampedToSafeFilterRanges() {
        assertEquals(
            ImageAdjustments(-1f, 2f, 0.5f),
            ImageAdjustments(-4f, 9f, 0.01f).clamped(),
        )
    }

    @Test fun cameraSettingsClampEvAndImageControls() {
        val capabilities = CameraCapabilitiesSnapshot(
            isoRange = 100..6400,
            exposureTimeRangeNs = 100_000L..100_000_000L,
            minimumFocusDistanceDiopters = 10f,
            apertures = listOf(2.2f),
            supportsManualSensor = true,
            supportsManualPostProcessing = true,
            exposureCompensationRange = -18..18,
            exposureCompensationStepEv = 1f / 6f,
        )
        val clamped = ManualCameraSettings.defaults().copy(
            exposureCompensationSteps = 99,
            imageAdjustments = ImageAdjustments(2f, -2f, 8f),
        ).clampedTo(capabilities, 30)
        assertEquals(18, clamped.exposureCompensationSteps)
        assertEquals(ImageAdjustments(1f, 0.5f, 2f), clamped.imageAdjustments)
    }

    @Test fun codecRoundTripsEvAndImageControls() {
        val settings = ManualCameraSettings.defaults().copy(
            exposureCompensationSteps = -7,
            imageAdjustments = ImageAdjustments(0.25f, 1.2f, 0.9f),
        )
        assertEquals(settings, CameraSettingsCodec.decode(CameraSettingsCodec.encode(settings)))
    }
}
