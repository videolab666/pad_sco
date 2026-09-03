package com.padel.cameraagent

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class StreamConfigTest {
    @Test
    fun `camera warmup requires running selected camera before SRT`() {
        assertFalse(CameraWarmupPolicy.isTargetReady(false, "2", "2"))
        assertFalse(CameraWarmupPolicy.isTargetReady(true, "0", "2"))
        assertTrue(CameraWarmupPolicy.isTargetReady(true, "2", "2"))
    }

    @Test
    fun `builds MediaMTX publish endpoint for selected court`() {
        val config = StreamConfig.create(
            courtCode = " 7dkrYGs ",
            gatewayHost = " 192.168.31.142 ",
            platformUrl = " http://192.168.31.142:3000/ ",
            resolution = "1920x1080",
            srtPort = 8890,
        )

        assertEquals("7dkrYGs", config.courtCode)
        assertEquals("court-7dkrYGs-main", config.streamKey)
        assertEquals(
            "srt://192.168.31.142:8890?streamid=publish:court-7dkrYGs-main&pkt_size=1316",
            config.srtEndpoint,
        )
        assertEquals("http://192.168.31.142:3000", config.platformUrl)
        assertEquals(1920, config.width)
        assertEquals(1080, config.height)
    }

    @Test
    fun `rejects malformed provisioning values`() {
        assertThrows(IllegalArgumentException::class.java) {
            StreamConfig.create("x", "192.168.31.142", "http://host:3000", "1920x1080", 8890)
        }
        assertThrows(IllegalArgumentException::class.java) {
            StreamConfig.create("7dkrYGs", "", "http://host:3000", "1920x1080", 8890)
        }
        assertThrows(IllegalArgumentException::class.java) {
            StreamConfig.create("7dkrYGs", "host", "ftp://host", "not-a-size", 8890)
        }
    }
}
