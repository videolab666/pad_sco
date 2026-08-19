package com.padel.cameraagent

import android.os.Handler
import android.os.Looper
import android.util.Log
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * Heartbeat-клиент (§152/§194): каждые 10 секунд отправляет здоровье камеры
 * на POST /api/v1/video/heartbeat. Источник создаётся при первом heartbeat
 * (zero-friction provisioning §88) — ключ stream_key = court-{код}-main.
 *
 * Ошибки НЕ прерывают стриминг — heartbeat fire-and-forget с retry.
 */
class HeartbeatClient(
    private val platformUrl: String,
    private val streamKey: String,
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
    private var lastHealth: JSONObject = JSONObject()

    private val heartbeatRunnable = object : Runnable {
        override fun run() {
            if (!running) return
            sendHeartbeat("recording")
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

    fun updateHealth(block: JSONObject.() -> Unit) {
        lastHealth = JSONObject().apply(block)
    }

    private fun sendHeartbeat(status: String) {
        val payload = JSONObject().apply {
            put("streamKey", streamKey)
            put("status", status)
            put("name", "OnePlus Camera Agent")
            put("health", lastHealth)
        }

        val request = Request.Builder()
            .url("$platformUrl/api/v1/video/heartbeat")
            .post(payload.toString().toMediaType().let {
                RequestBody.create(it, payload.toString())
            })
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.w(TAG, "heartbeat failed: ${e.message}")
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    if (it.isSuccessful) {
                        Log.d(TAG, "heartbeat ok ($status)")
                    } else {
                        Log.w(TAG, "heartbeat ${it.code}: ${it.body?.string()}")
                    }
                }
            }
        })
    }
}
