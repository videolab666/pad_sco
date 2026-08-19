package com.padel.cameraagent

import android.hardware.camera2.*
import android.content.Context
import android.util.Log
import android.util.Range

/**
 * Camera2 probe (§166): обнаружение физических камер и их возможностей.
 *
 * ГЛАВНЫЙ РИСК Sprint A: поддержка 4K50/60 ультрашириком для стороннего
 * приложения НЕ ГАРАНТИРОВАНА даже если штатная камера это умеет.
 * Этот класс отвечает на вопрос «что реально доступно».
 *
 * Результат сохраняется в лог + отображается в MainActivity.
 */
data class CameraInfo(
    val cameraId: String,
    val physicalId: String?,
    val facing: Int,
    val focalLength: Float?,       // мм (35mm equiv)
    val isUltraWide: Boolean,      // ≤ 16mm эквивалент
    val supportedResolutions: List<Size>,
    val maxFps: Int?,
    val hasManualControls: Boolean, // ISO/exposure/WB lock
    val sensorInfo: String,         // для отладки
)

data class Size(val width: Int, val height: Int) {
    override fun toString() = "${width}x${height}"
}

class CameraProbe(private val context: Context) {

    companion object {
        private const val TAG = "CameraProbe"
        private const val ULTRA_WIDE_THRESHOLD_MM = 16.0f
    }

    fun probe(): List<CameraInfo> {
        val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val results = mutableListOf<CameraInfo>()

        for (cameraId in manager.cameraIdList) {
            val chars = manager.getCameraCharacteristics(cameraId)
            val facing = chars.get(CameraCharacteristics.LENS_FACING) ?: -1
            if (facing != CameraCharacteristics.LENS_FACING_BACK) continue

            // Физические суб-камеры (multi-camera)
            val physicalIds = chars.physicalCameraIds ?: setOf()

            if (physicalIds.isNotEmpty()) {
                // Multi-camera: проверяем каждую физическую линзу
                for (physId in physicalIds) {
                    val physChars = chars.getPhysicalCameraCharacteristics(physId)
                    val info = extractInfo(cameraId, physId, physChars, facing)
                    results.add(info)
                    logCamera(info)
                }
            } else {
                // Single camera
                val info = extractInfo(cameraId, null, chars, facing)
                results.add(info)
                logCamera(info)
            }
        }

        return results
    }

    private fun extractInfo(
        logicalId: String,
        physicalId: String?,
        chars: CameraCharacteristics,
        facing: Int,
    ): CameraInfo {
        // Фокусное расстояние → ultra-wide detection
        val focalLengths = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS) ?: floatArrayOf()
        val sensorWidth = chars.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE_WIDTH) ?: 0f
        val focal35mm = if (focalLengths.isNotEmpty() && sensorWidth > 0) {
            // Approximate 35mm equivalent: focal * (36 / sensorWidth)
            focalLengths[0] * (36.0f / sensorWidth)
        } else null

        val isUltraWide = focal35mm != null && focal35mm <= ULTRA_WIDE_THRESHOLD_MM

        // Поддерживаемые разрешения + FPS
        val map = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
        val resolutions = mutableListOf<Size>()
        var maxFps: Int? = null

        if (map != null) {
            for (format in intArrayOf(ImageFormat.YUV_420_888, ImageFormat.JPEG)) {
                for (size in map.getOutputSizes(format)) {
                    resolutions.add(Size(size.width, size.height))
                }
            }
            // High-speed (для 4K50/60)
            val highSpeed = map.highSpeedVideoSizes
            for (size in highSpeed) {
                val ranges = map.getHighSpeedVideoFpsRangesFor(size)
                for (range in ranges) {
                    val fps = range.upper
                    if (maxFps == null || fps > maxFps) maxFps = fps
                }
            }
            // Обычные FPS ranges
            val fpsRanges = chars.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES)
            for (range in fpsRanges ?: arrayOf()) {
                val fps = range.upper
                if (maxFps == null || fps > maxFps) maxFps = fps
            }
        }

        // Manual controls
        val hasManualSensor = chars.get(CameraCharacteristics.SENSOR_INFO_SENSITIVITY_RANGE) != null
        val hasManualExposure = chars.get(CameraCharacteristics.SENSOR_INFO_EXPOSURE_TIME_RANGE) != null
        val wbModes = chars.get(CameraCharacteristics.CONTROL_AWB_AVAILABLE_MODES) ?: intArrayOf()
        val hasManualWb = wbModes.contains(CameraCharacteristics.CONTROL_AWB_MODE_OFF)

        val sensor = chars.get(CameraCharacteristics.SENSOR_INFO_PIXEL_ARRAY_SIZE)
        val sensorStr = sensor?.let { "${it.width}x${it.height}" } ?: "?"

        return CameraInfo(
            cameraId = logicalId,
            physicalId = physicalId,
            facing = facing,
            focalLength = focal35mm,
            isUltraWide = isUltraWide,
            supportedResolutions = resolutions.sortedByDescending { it.width * it.height }.distinct().take(10),
            maxFps = maxFps,
            hasManualControls = hasManualSensor && hasManualExposure,
            sensorInfo = sensorStr,
        )
    }

    private fun logCamera(info: CameraInfo) {
        val tag = if (info.isUltraWide) "★ ULTRA-WIDE" else "  lens"
        Log.i(TAG, "$tag id=${info.cameraId}/${info.phicalOrLogical()} " +
                "focal=${info.focalLength?.let { "%.1f".format(it) } ?: "?"}mm " +
                "4K=${info.supportedResolutions.any { it.width >= 3840 }} " +
                "maxFps=${info.maxFps ?: "?"} " +
                "manual=${info.hasManualControls} " +
                "sensor=${info.sensorInfo}")
    }

    private fun CameraInfo.phicalOrLogical(): String {
        return physicalId ?: "logical"
    }

    /**
     * Выбор лучшей камеры для корта: ультраширик с максимальным разрешением.
     * Возвращает (cameraId, physicalId?) для открытия Camera2 сессии.
     */
    fun selectBestCamera(): Pair<String, String?>? {
        val cameras = probe()
        val ultraWide = cameras.filter { it.isUltraWide }
        val best = (if (ultraWide.isNotEmpty()) ultraWide else cameras)
            .maxByOrNull { c ->
                c.supportedResolutions.maxOfOrNull { it.width * it.height } ?: 0
            }
        return best?.let { Pair(it.cameraId, it.physicalId) }
    }
}
