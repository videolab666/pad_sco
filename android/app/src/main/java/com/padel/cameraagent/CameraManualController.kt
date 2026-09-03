package com.padel.cameraagent

import android.content.Context
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraMetadata
import android.hardware.camera2.CaptureRequest
import android.hardware.camera2.CaptureResult
import android.hardware.camera2.params.ColorSpaceTransform
import android.hardware.camera2.params.RggbChannelVector
import android.os.SystemClock
import android.util.Range
import com.pedro.encoder.input.sources.video.Camera2Source
import java.util.concurrent.atomic.AtomicLong

data class ActualCameraValues(
    val iso: Int? = null,
    /** Детектированная частота сети (STATISTICS_SCENE_FLICKER). */
    val sceneFlicker: String? = null,
    val exposureTimeNs: Long? = null,
    val focusDistanceDiopters: Float? = null,
    val aperture: Float? = null,
    val whiteBalanceGains: WhiteBalanceGains? = null,
    val exposureCompensationSteps: Int? = null,
)

data class CameraOperatorState(
    val serviceRunning: Boolean,
    val streamStatus: String,
    val settings: ManualCameraSettings,
    val capabilities: CameraCapabilitiesSnapshot?,
    val actual: ActualCameraValues,
)

class CameraManualController(
    context: Context,
    private val cameraId: String,
    private val fps: Int,
    private val store: CameraSettingsStore,
    private val onActualValues: (ActualCameraValues) -> Unit,
) {
    private val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as android.hardware.camera2.CameraManager
    private val characteristics = cameraManager.getCameraCharacteristics(cameraId)
    private val lastResultDispatchMs = AtomicLong(0L)
    private var latestColorTransform: ColorSpaceTransform? = null
    @Volatile
    private var latestAutoWhiteBalanceGains: WhiteBalanceGains? = null

    val capabilities: CameraCapabilitiesSnapshot = readCapabilities(characteristics)
    var settings: ManualCameraSettings = store.load().clampedTo(capabilities, fps)
        private set

    fun installCaptureCallback(source: Camera2Source) {
        source.setCustomOnCaptureCompletedCallback { _, _, result ->
            latestColorTransform = result.get(CaptureResult.COLOR_CORRECTION_TRANSFORM) ?: latestColorTransform
            val captureGains = result.get(CaptureResult.COLOR_CORRECTION_GAINS)?.let {
                WhiteBalanceGains(it.red, it.greenEven, it.greenOdd, it.blue)
            }
            if (result.get(CaptureResult.CONTROL_AWB_MODE) == CameraMetadata.CONTROL_AWB_MODE_AUTO) {
                latestAutoWhiteBalanceGains = captureGains ?: latestAutoWhiteBalanceGains
            }
            val now = SystemClock.elapsedRealtime()
            val previous = lastResultDispatchMs.get()
            if (now - previous < RESULT_UPDATE_INTERVAL_MS || !lastResultDispatchMs.compareAndSet(previous, now)) {
                return@setCustomOnCaptureCompletedCallback
            }
            val flicker = when (result.get(CaptureResult.STATISTICS_SCENE_FLICKER)) {
                CameraMetadata.STATISTICS_SCENE_FLICKER_50HZ -> "50hz"
                CameraMetadata.STATISTICS_SCENE_FLICKER_60HZ -> "60hz"
                else -> null
            }
            onActualValues(
                ActualCameraValues(
                    iso = result.get(CaptureResult.SENSOR_SENSITIVITY),
                    sceneFlicker = flicker,
                    exposureTimeNs = result.get(CaptureResult.SENSOR_EXPOSURE_TIME),
                    focusDistanceDiopters = result.get(CaptureResult.LENS_FOCUS_DISTANCE),
                    aperture = result.get(CaptureResult.LENS_APERTURE),
                    whiteBalanceGains = captureGains,
                    exposureCompensationSteps = result.get(CaptureResult.CONTROL_AE_EXPOSURE_COMPENSATION),
                ),
            )
        }
    }

    fun update(source: Camera2Source?, requested: ManualCameraSettings, fromRemote: Boolean = false): ManualCameraSettings {
        val anchoredRequest = if (settings.autoWhiteBalance && !requested.autoWhiteBalance) {
            latestAutoWhiteBalanceGains?.let {
                requested.withWhiteBalanceAnchor(requested.whiteBalanceKelvin, it)
            } ?: requested
        } else {
            requested
        }
        settings = anchoredRequest.clampedTo(capabilities, fps)
        store.save(settings, local = !fromRemote)
        source?.takeIf { it.isRunning() }?.let(::applyTo)
        return settings
    }

    fun applyTo(source: Camera2Source): Boolean {
        val current = settings.clampedTo(capabilities, fps)
        val frameDurationNs = 1_000_000_000L / fps.coerceAtLeast(1)
        return source.setCustomRequest { builder ->
            builder.set(CaptureRequest.CONTROL_MODE, CameraMetadata.CONTROL_MODE_AUTO)
            builder.set(CaptureRequest.CONTROL_AE_TARGET_FPS_RANGE, Range(fps, fps))
            // Анти-бэндинг из настроек (удалённо; дефолт 50Гц — прежнее поведение)
            builder.set(
                CaptureRequest.CONTROL_AE_ANTIBANDING_MODE,
                when (current.antibanding) {
                    AntibandingMode.OFF -> CameraMetadata.CONTROL_AE_ANTIBANDING_MODE_OFF
                    AntibandingMode.HZ50 -> CameraMetadata.CONTROL_AE_ANTIBANDING_MODE_50HZ
                    AntibandingMode.HZ60 -> CameraMetadata.CONTROL_AE_ANTIBANDING_MODE_60HZ
                    AntibandingMode.AUTO -> CameraMetadata.CONTROL_AE_ANTIBANDING_MODE_AUTO
                },
            )

            when {
                // Приоритет выдержки: аппаратный shutter-priority Qualcomm
                // (ру-дамп стока OnePlus 9 Pro 2026-09-02: AE ON + фикс
                // выдержки + сентинел ISO -1 — HAL ведёт ISO сам, EV нативно)
                current.exposureMode == ExposureMode.MANUAL_SHUTTER && capabilities.supportsManualSensor -> {
                    builder.set(CaptureRequest.CONTROL_AE_MODE, CameraMetadata.CONTROL_AE_MODE_ON)
                    builder.set(CaptureRequest.CONTROL_AE_LOCK, false)
                    builder.set(CaptureRequest.SENSOR_EXPOSURE_TIME, current.exposureTimeNs)
                    builder.set(CaptureRequest.SENSOR_SENSITIVITY, -1)
                    builder.set(
                        CaptureRequest.CONTROL_AE_EXPOSURE_COMPENSATION,
                        current.exposureCompensationSteps,
                    )
                }

                // Зеркальный паттерн: ISO фикс, выдержку ведёт HAL (эксперимент)
                current.exposureMode == ExposureMode.MANUAL_ISO && capabilities.supportsManualSensor -> {
                    builder.set(CaptureRequest.CONTROL_AE_MODE, CameraMetadata.CONTROL_AE_MODE_ON)
                    builder.set(CaptureRequest.CONTROL_AE_LOCK, false)
                    builder.set(CaptureRequest.SENSOR_SENSITIVITY, current.iso)
                    builder.set(CaptureRequest.SENSOR_EXPOSURE_TIME, -1L)
                    builder.set(
                        CaptureRequest.CONTROL_AE_EXPOSURE_COMPENSATION,
                        current.exposureCompensationSteps,
                    )
                }

                current.autoExposure || !capabilities.supportsManualSensor -> {
                    builder.set(CaptureRequest.CONTROL_AE_MODE, CameraMetadata.CONTROL_AE_MODE_ON)
                    builder.set(CaptureRequest.CONTROL_AE_LOCK, false)
                    builder.set(
                        CaptureRequest.CONTROL_AE_EXPOSURE_COMPENSATION,
                        current.exposureCompensationSteps,
                    )
                }

                else -> {
                    builder.set(CaptureRequest.CONTROL_AE_MODE, CameraMetadata.CONTROL_AE_MODE_OFF)
                    builder.set(CaptureRequest.CONTROL_AE_LOCK, false)
                    builder.set(CaptureRequest.SENSOR_SENSITIVITY, current.iso)
                    builder.set(CaptureRequest.SENSOR_EXPOSURE_TIME, current.exposureTimeNs)
                    builder.set(CaptureRequest.SENSOR_FRAME_DURATION, frameDurationNs)
                    builder.set(CaptureRequest.CONTROL_AE_EXPOSURE_COMPENSATION, 0)
                }
            }

            if (current.autoFocus || capabilities.minimumFocusDistanceDiopters <= 0f) {
                builder.set(CaptureRequest.CONTROL_AF_MODE, CameraMetadata.CONTROL_AF_MODE_CONTINUOUS_VIDEO)
            } else {
                builder.set(CaptureRequest.CONTROL_AF_MODE, CameraMetadata.CONTROL_AF_MODE_OFF)
                builder.set(CaptureRequest.LENS_FOCUS_DISTANCE, current.focusDistanceDiopters)
            }

            if (current.autoWhiteBalance || !capabilities.supportsManualPostProcessing) {
                builder.set(CaptureRequest.CONTROL_AWB_MODE, CameraMetadata.CONTROL_AWB_MODE_AUTO)
                builder.set(CaptureRequest.CONTROL_AWB_LOCK, false)
            } else {
                val gains = current.manualWhiteBalanceGains()
                builder.set(CaptureRequest.CONTROL_AWB_MODE, CameraMetadata.CONTROL_AWB_MODE_OFF)
                builder.set(CaptureRequest.CONTROL_AWB_LOCK, false)
                builder.set(CaptureRequest.COLOR_CORRECTION_MODE, CameraMetadata.COLOR_CORRECTION_MODE_TRANSFORM_MATRIX)
                latestColorTransform?.let { builder.set(CaptureRequest.COLOR_CORRECTION_TRANSFORM, it) }
                builder.set(
                    CaptureRequest.COLOR_CORRECTION_GAINS,
                    RggbChannelVector(gains.red, gains.greenEven, gains.greenOdd, gains.blue),
                )
            }
        }
    }

    companion object {
        private const val RESULT_UPDATE_INTERVAL_MS = 500L

        fun readCapabilities(characteristics: CameraCharacteristics): CameraCapabilitiesSnapshot {
            val capabilities = characteristics.get(CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES)
                ?.toSet().orEmpty()
            val iso = characteristics.get(CameraCharacteristics.SENSOR_INFO_SENSITIVITY_RANGE)
            val exposure = characteristics.get(CameraCharacteristics.SENSOR_INFO_EXPOSURE_TIME_RANGE)
            val exposureCompensation = characteristics.get(
                CameraCharacteristics.CONTROL_AE_COMPENSATION_RANGE,
            )
            val exposureCompensationStep = characteristics.get(
                CameraCharacteristics.CONTROL_AE_COMPENSATION_STEP,
            )
            return CameraCapabilitiesSnapshot(
                isoRange = (iso?.lower ?: 100)..(iso?.upper ?: 100),
                exposureTimeRangeNs = (exposure?.lower ?: 1_000_000L)..(exposure?.upper ?: 1_000_000L),
                minimumFocusDistanceDiopters = characteristics.get(
                    CameraCharacteristics.LENS_INFO_MINIMUM_FOCUS_DISTANCE,
                ) ?: 0f,
                apertures = characteristics.get(CameraCharacteristics.LENS_INFO_AVAILABLE_APERTURES)
                    ?.toList().orEmpty(),
                supportsManualSensor = capabilities.contains(
                    CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_MANUAL_SENSOR,
                ),
                supportsManualPostProcessing = capabilities.contains(
                    CameraCharacteristics.REQUEST_AVAILABLE_CAPABILITIES_MANUAL_POST_PROCESSING,
                ),
                exposureCompensationRange = (exposureCompensation?.lower ?: 0)..
                    (exposureCompensation?.upper ?: 0),
                exposureCompensationStepEv = exposureCompensationStep?.toFloat() ?: 0f,
            )
        }
    }
}
