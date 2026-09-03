package com.padel.cameraagent

import android.os.Handler
import android.os.Looper
import android.util.Log
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Heartbeat-клиент (§152/§194): каждые 10 секунд отправляет здоровье камеры
 * на POST /api/v1/video/heartbeat. Источник создаётся при первом heartbeat
 * (zero-friction provisioning §88) — ключ stream_key = court-{код}-main.
 *
 * Канал удалённых настроек (plan 2026-09-02): payload дополняется блоком
 * deviceSettings (версия/локальный счётчик/полный конфиг/возможности), а
 * тело ответа с desiredSettings отдаётся в [onServerPayload] — сервис
 * применяет конфиг и подтверждает версию в следующем heartbeat.
 *
 * Ошибки НЕ прерывают стриминг — heartbeat fire-and-forget с retry.
 */
class HeartbeatClient(
    private val platformUrl: String,
    private val streamKey: String,
    private val deviceSettings: (() -> JSONObject)? = null,
    private val onServerPayload: ((JSONObject?) -> Unit)? = null,
) {
    companion object {
        private const val TAG = "Heartbeat"
        private const val INTERVAL_MS = 10_000L
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(5, TimeUnit.SECONDS)
        .writeTimeout(5, TimeUnit.SECONDS)
        .build()

    private val handler = Handler(Looper.getMainLooper())
    private var running = false
    @Volatile private var currentStatus = "online"
    private var lastHealth: JSONObject = JSONObject()

    private val heartbeatRunnable = object : Runnable {
        override fun run() {
            if (!running) return
            sendHeartbeat(currentStatus)
            handler.postDelayed(this, INTERVAL_MS)
        }
    }

    fun start() {
        if (running) return
        running = true
        sendHeartbeat("online")
        handler.postDelayed(heartbeatRunnable, INTERVAL_MS)
    }

    fun stop() {
        running = false
        handler.removeCallbacks(heartbeatRunnable)
        sendHeartbeat("offline")
    }

    fun setStatus(status: String) {
        require(status in setOf("offline", "online", "recording"))
        currentStatus = status
    }

    @Synchronized
    fun updateHealth(block: JSONObject.() -> Unit) {
        lastHealth = JSONObject().apply(block)
    }

    private fun sendHeartbeat(status: String) {
        val healthSnapshot = synchronized(this) { JSONObject(lastHealth.toString()) }
        val payload = JSONObject().apply {
            put("streamKey", streamKey)
            put("status", status)
            put("name", "OnePlus Camera Agent")
            put("health", healthSnapshot)
            deviceSettings?.invoke()?.let { put("deviceSettings", it) }
        }

        val request = Request.Builder()
            .url("$platformUrl/api/v1/video/heartbeat")
            .post(payload.toString().toRequestBody("application/json".toMediaType()))
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.w(TAG, "heartbeat failed: ${e.message}")
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    if (it.isSuccessful) {
                        Log.d(TAG, "heartbeat ok ($status)")
                        val body = it.body?.string()
                        val desired = try {
                            body?.let { JSONObject(it).optJSONObject("desiredSettings") }
                        } catch (error: Exception) {
                            Log.w(TAG, "heartbeat response parse: ${error.message}")
                            null
                        }
                        if (desired != null) {
                            handler.post { onServerPayload?.invoke(desired) }
                        }
                    } else {
                        Log.w(TAG, "heartbeat ${it.code}: ${it.body?.string()}")
                    }
                }
            }
        })
    }
}
