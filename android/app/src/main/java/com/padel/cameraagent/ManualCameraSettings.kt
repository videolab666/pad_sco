package com.padel.cameraagent

import kotlin.math.ln
import kotlin.math.min
import kotlin.math.pow

data class CameraCapabilitiesSnapshot(
    val isoRange: IntRange,
    val exposureTimeRangeNs: LongRange,
    val minimumFocusDistanceDiopters: Float,
    val apertures: List<Float>,
    val supportsManualSensor: Boolean,
    val supportsManualPostProcessing: Boolean,
    val exposureCompensationRange: IntRange = 0..0,
    val exposureCompensationStepEv: Float = 0f,
) {
    val isApertureAdjustable: Boolean
        get() = apertures.distinct().size > 1
}

data class ImageAdjustments(
    val saturation: Float,
    val contrast: Float,
    val gamma: Float,
) {
    companion object {
        fun defaults() = ImageAdjustments(saturation = 0f, contrast = 1f, gamma = 1f)
    }

    fun clamped() = copy(
        saturation = saturation.coerceIn(-1f, 1f),
        contrast = contrast.coerceIn(0.5f, 2f),
        gamma = gamma.coerceIn(0.5f, 2f),
    )
}


/**
 * Анти-бэндинг (plan 2026-09-02, удалённая настройка): ограничение выдержек
 * сетевой частотой света. AUTO — HAL сам детектирует по STATISTICS_SCENE_FLICKER
 * (так делает стоковая камера); дефолт HZ50 — текущее поведение агента.
 */
enum class AntibandingMode {
    OFF,
    HZ50,
    HZ60,
    AUTO;

    companion object {
        fun fromKey(raw: String?): AntibandingMode? = when (raw) {
            "off" -> OFF
            "50hz" -> HZ50
            "60hz" -> HZ60
            "auto" -> AUTO
            else -> null
        }
    }

    val key: String
        get() = when (this) {
            OFF -> "off"
            HZ50 -> "50hz"
            HZ60 -> "60hz"
            AUTO -> "auto"
        }
}

/**
 * Режим экспозиции (plan 2026-09-02 remote-camera-settings):
 *  AUTO           — аппаратный AE (ISO и выдержка вместе);
 *  MANUAL_SHUTTER — приоритет выдержки: выдержка ручная, ISO ведёт HAL
 *                   (AE ON + SENSOR_SENSITIVITY=-1 — паттерн стоковой камеры
 *                   OnePlus, подтверждён рут-дампом 2026-09-02);
 *  MANUAL_ISO     — ISO ручное, выдержку ведёт HAL (зеркальный паттерн,
 *                   экспериментально);
 *  MANUAL         — полный мануал (AE OFF).
 */
enum class ExposureMode {
    AUTO,
    MANUAL_SHUTTER,
    MANUAL_ISO,
    MANUAL;

    companion object {
        fun fromKey(raw: String?): ExposureMode? = when (raw) {
            "auto" -> AUTO
            "manualShutter" -> MANUAL_SHUTTER
            "manualIso" -> MANUAL_ISO
            "manual" -> MANUAL
            else -> null
        }
    }

    val key: String
        get() = when (this) {
            AUTO -> "auto"
            MANUAL_SHUTTER -> "manualShutter"
            MANUAL_ISO -> "manualIso"
            MANUAL -> "manual"
        }
}

data class ManualCameraSettings(
    val exposureMode: ExposureMode = ExposureMode.AUTO,
    val exposureCompensationSteps: Int = 0,
    val iso: Int,
    val exposureTimeNs: Long,
    val autoFocus: Boolean,
    val focusDistanceDiopters: Float,
    val autoWhiteBalance: Boolean,
    val whiteBalanceKelvin: Int,
    val whiteBalanceAnchorKelvin: Int = 5_000,
    val whiteBalanceAnchorRedGain: Float = 1.5f,
    val whiteBalanceAnchorGreenEvenGain: Float = 1f,
    val whiteBalanceAnchorGreenOddGain: Float = 1f,
    val whiteBalanceAnchorBlueGain: Float = 2.5f,
    val imageAdjustments: ImageAdjustments = ImageAdjustments.defaults(),
    val antibanding: AntibandingMode = AntibandingMode.HZ50,
    /** Параметры запасного luma-контура (plan: непрерывный автозамер). */
    val meterIntervalSec: Int = 5,
    val isoRampEvPerSec: Float = 0.5f,
) {
    /** Совместимость локального UI: тумблер «автоэкспозиция» = полный авто. */
    val autoExposure: Boolean
        get() = exposureMode == ExposureMode.AUTO

    /** Ручной ISO — в MANUAL и MANUAL_ISO; ручная выдержка — в MANUAL и MANUAL_SHUTTER. */
    val manualIso: Boolean
        get() = exposureMode == ExposureMode.MANUAL || exposureMode == ExposureMode.MANUAL_ISO

    val manualShutter: Boolean
        get() = exposureMode == ExposureMode.MANUAL || exposureMode == ExposureMode.MANUAL_SHUTTER

    companion object {
        const val MIN_WB_KELVIN = 2_000
        const val MAX_WB_KELVIN = 10_000

        fun defaults() = ManualCameraSettings(
            exposureMode = ExposureMode.AUTO,
            exposureCompensationSteps = 0,
            iso = 400,
            exposureTimeNs = 10_000_000L,
            autoFocus = true,
            focusDistanceDiopters = 0f,
            autoWhiteBalance = true,
            whiteBalanceKelvin = 5_000,
        )
    }

    fun clampedTo(capabilities: CameraCapabilitiesSnapshot, fps: Int): ManualCameraSettings {
        val frameDurationNs = 1_000_000_000L / fps.coerceAtLeast(1)
        val maximumStreamingExposure = min(capabilities.exposureTimeRangeNs.last, frameDurationNs)
        return copy(
            exposureCompensationSteps = exposureCompensationSteps.coerceIn(
                capabilities.exposureCompensationRange,
            ),
            iso = iso.coerceIn(capabilities.isoRange),
            exposureTimeNs = exposureTimeNs.coerceIn(
                capabilities.exposureTimeRangeNs.first,
                maximumStreamingExposure,
            ),
            focusDistanceDiopters = focusDistanceDiopters.coerceIn(
                0f,
                capabilities.minimumFocusDistanceDiopters.coerceAtLeast(0f),
            ),
            whiteBalanceKelvin = whiteBalanceKelvin.coerceIn(MIN_WB_KELVIN, MAX_WB_KELVIN),
            whiteBalanceAnchorKelvin = whiteBalanceAnchorKelvin.coerceIn(
                MIN_WB_KELVIN,
                MAX_WB_KELVIN,
            ),
            whiteBalanceAnchorRedGain = whiteBalanceAnchorRedGain.validGainOr(1.5f),
            whiteBalanceAnchorGreenEvenGain = whiteBalanceAnchorGreenEvenGain.validGainOr(1f),
            whiteBalanceAnchorGreenOddGain = whiteBalanceAnchorGreenOddGain.validGainOr(1f),
            whiteBalanceAnchorBlueGain = whiteBalanceAnchorBlueGain.validGainOr(2.5f),
            imageAdjustments = imageAdjustments.clamped(),
        )
    }

    fun withWhiteBalanceAnchor(kelvin: Int, gains: WhiteBalanceGains) = copy(
        whiteBalanceAnchorKelvin = kelvin,
        whiteBalanceAnchorRedGain = gains.red,
        whiteBalanceAnchorGreenEvenGain = gains.greenEven,
        whiteBalanceAnchorGreenOddGain = gains.greenOdd,
        whiteBalanceAnchorBlueGain = gains.blue,
    )

    fun manualWhiteBalanceGains(): WhiteBalanceGains = WhiteBalanceConverter.adjustFromAnchor(
        anchor = WhiteBalanceGains(
            red = whiteBalanceAnchorRedGain,
            greenEven = whiteBalanceAnchorGreenEvenGain,
            greenOdd = whiteBalanceAnchorGreenOddGain,
            blue = whiteBalanceAnchorBlueGain,
        ),
        anchorKelvin = whiteBalanceAnchorKelvin,
        requestedKelvin = whiteBalanceKelvin,
    )

    fun allAuto() = copy(
        exposureMode = ExposureMode.AUTO,
        autoFocus = true,
        autoWhiteBalance = true,
    )

    private fun Float.validGainOr(fallback: Float): Float =
        if (isFinite() && this >= 1f) coerceAtMost(8f) else fallback
}

data class WhiteBalanceGains(
    val red: Float,
    val greenEven: Float,
    val greenOdd: Float,
    val blue: Float,
)

object WhiteBalanceConverter {
    fun adjustFromAnchor(
        anchor: WhiteBalanceGains,
        anchorKelvin: Int,
        requestedKelvin: Int,
    ): WhiteBalanceGains {
        val anchorModel = fromKelvin(anchorKelvin)
        val requestedModel = fromKelvin(requestedKelvin)
        val raw = floatArrayOf(
            anchor.red * requestedModel.red / anchorModel.red,
            anchor.greenEven * requestedModel.greenEven / anchorModel.greenEven,
            anchor.greenOdd * requestedModel.greenOdd / anchorModel.greenOdd,
            anchor.blue * requestedModel.blue / anchorModel.blue,
        )
        val scale = if ((raw.minOrNull() ?: 1f) < 1f) {
            1f / (raw.minOrNull() ?: 1f).coerceAtLeast(0.01f)
        } else {
            1f
        }
        return WhiteBalanceGains(
            red = (raw[0] * scale).coerceIn(1f, 8f),
            greenEven = (raw[1] * scale).coerceIn(1f, 8f),
            greenOdd = (raw[2] * scale).coerceIn(1f, 8f),
            blue = (raw[3] * scale).coerceIn(1f, 8f),
        )
    }

    fun fromKelvin(requestedKelvin: Int): WhiteBalanceGains {
        val temperature = requestedKelvin
            .coerceIn(ManualCameraSettings.MIN_WB_KELVIN, ManualCameraSettings.MAX_WB_KELVIN) / 100.0
        val red = when {
            temperature <= 66.0 -> 255.0
            else -> 329.698727446 * (temperature - 60.0).pow(-0.1332047592)
        }.coerceIn(1.0, 255.0)
        val green = when {
            temperature <= 66.0 -> 99.4708025861 * ln(temperature) - 161.1195681661
            else -> 288.1221695283 * (temperature - 60.0).pow(-0.0755148492)
        }.coerceIn(1.0, 255.0)
        val blue = when {
            temperature >= 66.0 -> 255.0
            temperature <= 19.0 -> 1.0
            else -> 138.5177312231 * ln(temperature - 10.0) - 305.0447927307
        }.coerceIn(1.0, 255.0)

        val raw = floatArrayOf(
            (green / red).toFloat(),
            1f,
            1f,
            (green / blue).toFloat(),
        )
        val scale = 1f / (raw.minOrNull() ?: 1f).coerceAtLeast(0.01f)
        return WhiteBalanceGains(
            red = (raw[0] * scale).coerceIn(1f, 8f),
            greenEven = (raw[1] * scale).coerceIn(1f, 8f),
            greenOdd = (raw[2] * scale).coerceIn(1f, 8f),
            blue = (raw[3] * scale).coerceIn(1f, 8f),
        )
    }
}
