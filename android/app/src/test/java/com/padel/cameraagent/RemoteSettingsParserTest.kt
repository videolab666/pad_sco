package com.padel.cameraagent

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class RemoteSettingsParserTest {

    @Test
    fun parsesFullConfigWithCameraAndStream() {
        val payload = JSONObject(
            """
            {
              "version": 7,
              "camera": {
                "camera_exposure_mode": "manualShutter",
                "camera_exposure_ns": 20000000,
                "camera_exposure_compensation_steps": -1
              },
              "stream": { "resolution": "1280x720", "courtCode": "nivki01" }
            }
            """.trimIndent(),
        )

        val config = RemoteSettingsParser.parse(payload)

        assertNotNull(config)
        assertEquals(7L, config!!.version)
        assertEquals(
            ExposureMode.MANUAL_SHUTTER,
            CameraSettingsCodec.decodeExposureMode(config.cameraValues!!),
        )
        assertEquals(20_000_000L, config.cameraValues[CameraSettingsCodec.KEY_EXPOSURE_NS])
        assertEquals("1280x720", config.stream?.resolution)
        assertEquals("nivki01", config.stream?.courtCode)
    }

    @Test
    fun partialCameraMapDecodesThroughCodec() {
        val payload = JSONObject(
            """{ "version": 3, "camera": { "camera_iso": 1600 } }""".trimIndent(),
        )

        val decoded = CameraSettingsCodec.decode(RemoteSettingsParser.parse(payload)!!.cameraValues!!)

        assertEquals(1_600, decoded.iso)
        assertEquals(ExposureMode.AUTO, decoded.exposureMode) // остальное — дефолты
    }

    @Test
    fun nullOrNonPositiveVersionIsIgnored() {
        assertNull(RemoteSettingsParser.parse(null))
        assertNull(RemoteSettingsParser.parse(JSONObject("""{ "version": 0 }""")))
        assertNull(RemoteSettingsParser.parse(JSONObject("""{ "version": -3 }""")))
        assertNull(RemoteSettingsParser.parse(JSONObject("""{}""")))
    }

    @Test
    fun streamFieldsAreOptionalAndBlankIsTreatedAsAbsent() {
        val config = RemoteSettingsParser.parse(JSONObject("""{ "version": 5, "stream": {} }"""))
        assertTrue(config!!.stream?.resolution == null && config.stream?.courtCode == null)

        val blank = RemoteSettingsParser.parse(
            JSONObject("""{ "version": 6, "stream": { "resolution": "  " } }"""),
        )
        assertNull(blank!!.stream?.resolution)
    }

    @Test
    fun brokenTypesFallBackToDefaultsInsteadOfCrash() {
        val payload = JSONObject(
            """
            { "version": 9, "camera": { "camera_iso": "not-a-number", "camera_exposure_mode": 42 } }
            """.trimIndent(),
        )

        val decoded = CameraSettingsCodec.decode(RemoteSettingsParser.parse(payload)!!.cameraValues!!)

        assertEquals(ManualCameraSettings.defaults().iso, decoded.iso)
        assertEquals(ExposureMode.AUTO, decoded.exposureMode)
    }
}
