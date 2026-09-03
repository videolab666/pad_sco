package com.padel.cameraagent

import android.content.Context
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CameraMetadata
import android.util.Log

data class CameraInfo(
    val cameraId: String,
    val facing: String, // back | front
    val focal35mm: Float?, // эквивалент 35мм основного фокусного
    val isLogical: Boolean, // мульти-камера (сток-пайплайн + zoom <1)
    val physicalIds: List<String>, // физические подкамеры логической
    val pixelArray: String, // "4096x3072"
    val isUltraWide: Boolean,
    val maxFps: Int?,
    val hasManualControls: Boolean,
    val aperture: Float?,
) {
    /** Человекочитаемое имя для UI/логов. */
    val label: String
        get() = when {
            isLogical -> "$cameraId · логическая мульти-камера (${physicalIds.joinToString("+")})"
            focal35mm != null && focal35mm <= 16f -> "$cameraId · ультраширик ${focal35mm.toInt()}мм"
            focal35mm != null && focal35mm >= 60f -> "$cameraId · теле ${focal35mm.toInt()}мм"
            else -> "$cameraId · камера ${focal35mm?.toInt()?.toString() ?: ""}мм"
        }
}

class CameraProbe(private val context: Context) {
    companion object {
        private const val TAG = "CameraProbe"
        private const val ULTRA_WIDE_THRESHOLD_MM = 16.0f
        private const val TELE_THRESHOLD_MM = 60.0f
    }

    fun probe(): List<CameraInfo> {
        val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val results = mutableListOf<CameraInfo>()
        for (cameraId in manager.cameraIdList) {
            try {
                results.add(infoFor(manager, cameraId))
            } catch (e: Exception) {
                Log.w(TAG, "camera $cameraId: ${e.message}")
            }
        }
        results.forEach { Log.i(TAG, "lens ${it.label} array=${it.pixelArray} fps=${it.maxFps ?: "?"}") }
        return results
    }

    private fun infoFor(manager: CameraManager, cameraId: String): CameraInfo {
        val chars = manager.getCameraCharacteristics(cameraId)
        val facing = when (chars.get(CameraCharacteristics.LENS_FACING)) {
            CameraCharacteristics.LENS_FACING_BACK -> "back"
            CameraCharacteristics.LENS_FACING_FRONT -> "front"
            else -> "external"
        }
        val focalLengths = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS) ?: floatArrayOf()
        val physicalSize = chars.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE)
        val focal35mm = if (focalLengths.isNotEmpty() && physicalSize != null && physicalSize.width > 0) {
            focalLengths[0] * (36.0f / physicalSize.width)
        } else null
        val map = chars.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
            as? android.hardware.camera2.params.StreamConfigurationMap
        var maxRes = 0
        if (map != null) {
            for (size in map.getOutputSizes(android.graphics.ImageFormat.YUV_420_888)) {
                if (size.width > maxRes) maxRes = size.width
            }
        }
        var maxFps: Int? = null
        val fpsRanges = chars.get(CameraCharacteristics.CONTROL_AE_AVAILABLE_TARGET_FPS_RANGES)
        for (range in fpsRanges ?: arrayOf()) {
            if (maxFps == null || range.upper > maxFps) maxFps = range.upper
        }
        val capabilities = chars.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES)
        val isLogical = capabilities?.contains(
            CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA,
        ) == true
        val physicalIds = if (isLogical) {
            chars.physicalCameraIds.toList()
        } else emptyList()
        val sensor = chars.get(CameraCharacteristics.SENSOR_INFO_PIXEL_ARRAY_SIZE)
        return CameraInfo(
            cameraId = cameraId,
            facing = facing,
            focal35mm = focal35mm,
            isLogical = isLogical,
            physicalIds = physicalIds,
            pixelArray = sensor?.let { "${it.width}x${it.height}" } ?: "?",
            isUltraWide = focal35mm != null && focal35mm <= ULTRA_WIDE_THRESHOLD_MM,
            maxFps = maxFps,
            hasManualControls = chars.get(CameraCharacteristics.SENSOR_INFO_SENSITIVITY_RANGE) != null,
            aperture = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_APERTURES)?.firstOrNull(),
        )
    }

    /** Прежняя логика авто-выбора: ультраширик с максимальным разрешением. */
    fun selectBestCamera(): String? {
        val cameras = probe().filter { it.facing == "back" }
        val uw = cameras.filter { it.isUltraWide }
        return (if (uw.isNotEmpty()) uw else cameras).maxByOrNull { it.pixelArray.substringBefore("x").toIntOrNull() ?: 0 }?.cameraId
    }

    /**
     * Резолв желаемого id: "auto" → прежний авто-выбор; точный id валидируется
     * по фактическому списку устройства (id меняются между прошивками —
     * невалидный откатывается на auto с журналом).
     */
    fun selectCamera(requested: String): String? {
        if (requested == "auto" || requested.isBlank()) return selectBestCamera()
        val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val exists = try {
            manager.cameraIdList.contains(requested)
        } catch (e: Exception) {
            Log.w(TAG, "selectCamera: ${e.message}")
            false
        }
        if (!exists) {
            Log.w(TAG, "Камера id=$requested не найдена на устройстве — откат на auto")
            return selectBestCamera()
        }
        return requested
    }

    /** Логическая мульти-камера (задняя) — сток-пайплайн Oplus. */
    fun selectLogicalBackCamera(): String? {
        val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
        for (cameraId in manager.cameraIdList) {
            try {
                val chars = manager.getCameraCharacteristics(cameraId)
                if ((chars.get(CameraCharacteristics.LENS_FACING) ?: -1) != CameraMetadata.LENS_FACING_BACK) continue
                val caps = chars.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES) ?: continue
                if (caps.contains(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_LOGICAL_MULTI_CAMERA)) {
                    return cameraId
                }
            } catch (e: Exception) {
                Log.w(TAG, "logical probe $cameraId: ${e.message}")
            }
        }
        return null
    }
}
