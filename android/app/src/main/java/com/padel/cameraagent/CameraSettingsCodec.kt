package com.padel.cameraagent

import android.content.SharedPreferences

object CameraSettingsCodec {
    const val KEY_EXPOSURE_MODE = "camera_exposure_mode"
    const val KEY_ANTIBANDING = "camera_antibanding"
    const val KEY_AUTO_EXPOSURE_LEGACY = "camera_auto_exposure"
    const val KEY_EXPOSURE_COMPENSATION = "camera_exposure_compensation_steps"
    const val KEY_ISO = "camera_iso"
    const val KEY_EXPOSURE_NS = "camera_exposure_ns"
    const val KEY_AUTO_FOCUS = "camera_auto_focus"
    const val KEY_FOCUS_DIOPTERS = "camera_focus_diopters"
    const val KEY_AUTO_WB = "camera_auto_white_balance"
    const val KEY_WB_KELVIN = "camera_white_balance_kelvin"
    const val KEY_WB_ANCHOR_KELVIN = "camera_white_balance_anchor_kelvin"
    const val KEY_WB_ANCHOR_RED = "camera_white_balance_anchor_red"
    const val KEY_WB_ANCHOR_GREEN_EVEN = "camera_white_balance_anchor_green_even"
    const val KEY_WB_ANCHOR_GREEN_ODD = "camera_white_balance_anchor_green_odd"
    const val KEY_WB_ANCHOR_BLUE = "camera_white_balance_anchor_blue"
    const val KEY_SATURATION = "camera_saturation"
    const val KEY_CONTRAST = "camera_contrast"
    const val KEY_GAMMA = "camera_gamma"
    const val KEY_METER_INTERVAL_SEC = "camera_meter_interval_sec"
    const val KEY_ISO_RAMP_EV_PER_SEC = "camera_iso_ramp_ev_per_sec"

    fun encode(settings: ManualCameraSettings): Map<String, Any> = mapOf(
        KEY_EXPOSURE_MODE to settings.exposureMode.key,
        KEY_ANTIBANDING to settings.antibanding.key,
        KEY_EXPOSURE_COMPENSATION to settings.exposureCompensationSteps,
        KEY_ISO to settings.iso,
        KEY_EXPOSURE_NS to settings.exposureTimeNs,
        KEY_AUTO_FOCUS to settings.autoFocus,
        KEY_FOCUS_DIOPTERS to settings.focusDistanceDiopters,
        KEY_AUTO_WB to settings.autoWhiteBalance,
        KEY_WB_KELVIN to settings.whiteBalanceKelvin,
        KEY_WB_ANCHOR_KELVIN to settings.whiteBalanceAnchorKelvin,
        KEY_WB_ANCHOR_RED to settings.whiteBalanceAnchorRedGain,
        KEY_WB_ANCHOR_GREEN_EVEN to settings.whiteBalanceAnchorGreenEvenGain,
        KEY_WB_ANCHOR_GREEN_ODD to settings.whiteBalanceAnchorGreenOddGain,
        KEY_WB_ANCHOR_BLUE to settings.whiteBalanceAnchorBlueGain,
        KEY_SATURATION to settings.imageAdjustments.saturation,
        KEY_CONTRAST to settings.imageAdjustments.contrast,
        KEY_GAMMA to settings.imageAdjustments.gamma,
        KEY_METER_INTERVAL_SEC to settings.meterIntervalSec,
        KEY_ISO_RAMP_EV_PER_SEC to settings.isoRampEvPerSec,
    )

    fun decode(values: Map<String, Any?>): ManualCameraSettings {
        val defaults = ManualCameraSettings.defaults()
        return ManualCameraSettings(
            exposureMode = decodeExposureMode(values),
            antibanding = (values[KEY_ANTIBANDING] as? String)?.let(AntibandingMode::fromKey) ?: defaults.antibanding,
            exposureCompensationSteps = (values[KEY_EXPOSURE_COMPENSATION] as? Number)?.toInt()
                ?: defaults.exposureCompensationSteps,
            iso = (values[KEY_ISO] as? Number)?.toInt()?.takeIf { it > 0 } ?: defaults.iso,
            exposureTimeNs = (values[KEY_EXPOSURE_NS] as? Number)?.toLong()?.takeIf { it > 0L }
                ?: defaults.exposureTimeNs,
            autoFocus = values[KEY_AUTO_FOCUS] as? Boolean ?: defaults.autoFocus,
            focusDistanceDiopters = (values[KEY_FOCUS_DIOPTERS] as? Number)?.toFloat()
                ?.takeIf { it.isFinite() && it >= 0f } ?: defaults.focusDistanceDiopters,
            autoWhiteBalance = values[KEY_AUTO_WB] as? Boolean ?: defaults.autoWhiteBalance,
            whiteBalanceKelvin = (values[KEY_WB_KELVIN] as? Number)?.toInt()
                ?.takeIf { it > 0 } ?: defaults.whiteBalanceKelvin,
            whiteBalanceAnchorKelvin = (values[KEY_WB_ANCHOR_KELVIN] as? Number)?.toInt()
                ?.takeIf { it > 0 } ?: defaults.whiteBalanceAnchorKelvin,
            whiteBalanceAnchorRedGain = values.validGain(KEY_WB_ANCHOR_RED)
                ?: defaults.whiteBalanceAnchorRedGain,
            whiteBalanceAnchorGreenEvenGain = values.validGain(KEY_WB_ANCHOR_GREEN_EVEN)
                ?: defaults.whiteBalanceAnchorGreenEvenGain,
            whiteBalanceAnchorGreenOddGain = values.validGain(KEY_WB_ANCHOR_GREEN_ODD)
                ?: defaults.whiteBalanceAnchorGreenOddGain,
            whiteBalanceAnchorBlueGain = values.validGain(KEY_WB_ANCHOR_BLUE)
                ?: defaults.whiteBalanceAnchorBlueGain,
            imageAdjustments = ImageAdjustments(
                saturation = values.finiteFloat(KEY_SATURATION)
                    ?: defaults.imageAdjustments.saturation,
                contrast = values.finiteFloat(KEY_CONTRAST)
                    ?: defaults.imageAdjustments.contrast,
                gamma = values.finiteFloat(KEY_GAMMA)
                    ?: defaults.imageAdjustments.gamma,
            ).clamped(),
            meterIntervalSec = (values[KEY_METER_INTERVAL_SEC] as? Number)?.toInt()
                ?.takeIf { it in 1..60 } ?: defaults.meterIntervalSec,
            isoRampEvPerSec = (values[KEY_ISO_RAMP_EV_PER_SEC] as? Number)?.toFloat()
                ?.takeIf { it.isFinite() && it in 0.1f..2f } ?: defaults.isoRampEvPerSec,
        )
    }

    /**
     * Режим экспозиции: новый строковый ключ; легаси-совместимость — старый
     * boolean camera_auto_exposure (true→AUTO, false→MANUAL). Частичные
     * карты (удалённый desired) без обоих ключей → null → дефолт вызывателя.
     */
    fun decodeExposureMode(values: Map<String, Any?>): ExposureMode {
        val byKey = (values[KEY_EXPOSURE_MODE] as? String)?.let(ExposureMode::fromKey)
        if (byKey != null) return byKey
        return when (values[KEY_AUTO_EXPOSURE_LEGACY]) {
            true -> ExposureMode.AUTO
            false -> ExposureMode.MANUAL
            else -> ExposureMode.AUTO
        }
    }

    private fun Map<String, Any?>.validGain(key: String): Float? =
        (this[key] as? Number)?.toFloat()?.takeIf { it.isFinite() && it >= 1f }

    private fun Map<String, Any?>.finiteFloat(key: String): Float? =
        (this[key] as? Number)?.toFloat()?.takeIf { it.isFinite() }
}

class CameraSettingsStore(private val preferences: SharedPreferences) {
    fun load(): ManualCameraSettings = CameraSettingsCodec.decode(preferences.all)

    /**
     * @param local true — правка с телефона: инкремент settings_local_seq
     *   (heartbeat понесёт серверу → adopt). false — применение удалённого
     *   конфига (seq не трогаем).
     */
    fun save(settings: ManualCameraSettings, local: Boolean = true) {
        val editor = preferences.edit()
        CameraSettingsCodec.encode(settings).forEach { (key, value) ->
            when (value) {
                is Boolean -> editor.putBoolean(key, value)
                is Int -> editor.putInt(key, value)
                is Long -> editor.putLong(key, value)
                is Float -> editor.putFloat(key, value)
                is String -> editor.putString(key, value)
            }
        }
        if (local) {
            val seq = preferences.getInt(CameraService.KEY_LOCAL_SEQ, 0) + 1
            editor.putInt(CameraService.KEY_LOCAL_SEQ, seq)
        }
        editor.apply()
    }
}
