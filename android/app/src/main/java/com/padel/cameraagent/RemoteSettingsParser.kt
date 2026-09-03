package com.padel.cameraagent

import org.json.JSONObject

/**
 * Удалённый конфиг из ответа heartbeat (plan 2026-09-02 remote-camera-settings).
 *
 * Сервер возвращает desiredSettings, когда телефон отстал по версии:
 *   { "version": 7,
 *     "camera": { "camera_exposure_mode": "manualShutter", "camera_exposure_ns": 20000000, ... },
 *     "stream": { "resolution": "1920x1080", "courtCode": "7dkrYGs" } }
 *
 * camera — частичная карта ключей CameraSettingsCodec (недостающее → дефолты
 * кодека); stream — переопределение стрим-конфига (применяется с перезапуском).
 * Чистый парсер без I/O — покрыт JUnit (RemoteSettingsParserTest).
 */
data class RemoteStreamOverride(
    val resolution: String?,
    val courtCode: String?,
)

data class RemoteConfig(
    val version: Long,
    val cameraValues: Map<String, Any?>?,
    val stream: RemoteStreamOverride?,
)

object RemoteSettingsParser {

    fun parse(payload: JSONObject?): RemoteConfig? {
        if (payload == null) return null
        val version = payload.optLong("version", -1L)
        if (version <= 0L) return null
        return RemoteConfig(
            version = version,
            cameraValues = payload.optJSONObject("camera")?.toValueMap(),
            stream = payload.optJSONObject("stream")?.let { stream ->
                RemoteStreamOverride(
                    resolution = stream.optStringOrNull("resolution")?.takeIf { it.isNotBlank() },
                    courtCode = stream.optStringOrNull("courtCode")?.takeIf { it.isNotBlank() },
                )
            },
        )
    }

    /** JSONObject → Map<String, Any?> с обычными типами (Number/Boolean/String). */
    fun JSONObject.toValueMap(): Map<String, Any?> {
        val map = mutableMapOf<String, Any?>()
        for (key in keys()) {
            val value = opt(key)
            map[key] = when (value) {
                is Int, is Long, is Double, is Boolean, is String -> value
                else -> null
            }
        }
        return map
    }

    private fun JSONObject.optStringOrNull(key: String): String? =
        if (has(key) && !isNull(key)) optString(key) else null
}
