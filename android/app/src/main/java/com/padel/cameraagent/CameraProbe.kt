package com.padel.cameraagent

import android.hardware.camera2.*
import android.content.Context
import android.graphics.ImageFormat
import android.util.Log

data class CameraInfo(
    val cameraId: String,
    val isUltraWide: Boolean,
    val supportedResolutions: List<String>,
    val maxFps: Int?,
    val hasManualControls: Boolean,
    val sensorInfo: String,
)

class CameraProbe(private val context: Context) {
    companion object {
        private const val TAG = "CameraProbe"
        private const val ULTRA_WIDE_THRESHOLD_MM = 16.0f
    }

    fun probe(): List<CameraInfo> {
        val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val results = mutableListOf<CameraInfo>()
        for (cameraId in manager.cameraIdList) {
            try {
                val chars = manager.getCameraCharacteristics(cameraId)
                val facing = chars.get(CameraCharacteristics.LENS_FACING) ?: -1
                if (facing != CameraCharacteristics.LENS_FACING_BACK) continue
                val focalLengths = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS) ?: floatArrayOf()
                val physicalSize = chars.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE)
                val focal35mm = if (focalLengths.isNotEmpty() && physicalSize != null && physicalSize.width > 0) {
                    focalLengths[0] * (36.0f / physicalSize.width)
                } else null
                val isUltraWide = focal35mm != null && focal35mm <= ULTRA_WIDE_THRESHOLD_MM
                val map = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
                val resolutions = mutableListOf<String>()
                if (map != null) {
                    for (size in map.getOutputSizes(ImageFormat.YUV_420_888)) {
                        resolutions.add("${size.width}x${size.height}")
                    }
                }
                var maxFps: Int? = null
                val fpsRanges = chars.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES)
                for (range in fpsRanges ?: arrayOf()) {
                    if (maxFps == null || range.upper > maxFps) maxFps = range.upper
                }
                val hasManual = chars.get(CameraCharacteristics.SENSOR_INFO_SENSITIVITY_RANGE) != null
                val sensor = chars.get(CameraCharacteristics.SENSOR_INFO_PIXEL_ARRAY_SIZE)
                val sensorStr = sensor?.let { "${it.width}x${it.height}" } ?: "?"
                results.add(CameraInfo(cameraId, isUltraWide, resolutions.sortedByDescending { it.split("x")[0].toInt() }.take(5), maxFps, hasManual, sensorStr))
                Log.i(TAG, "${if (isUltraWide) "★ UW" else "  lens"} id=$cameraId focal=${focal35mm?.let { "%.1f".format(it) } ?: "?"}mm max=${resolutions.firstOrNull() ?: "?"} fps=${maxFps ?: "?"}")
            } catch (e: Exception) {
                Log.w(TAG, "camera $cameraId: ${e.message}")
            }
        }
        return results
    }

    fun selectBestCamera(): String? {
        val cameras = probe()
        val uw = cameras.filter { it.isUltraWide }
        return (if (uw.isNotEmpty()) uw else cameras)
            .maxByOrNull { c -> c.supportedResolutions.firstOrNull()?.split("x")?.get(0)?.toInt() ?: 0 }
            ?.cameraId
    }
}
