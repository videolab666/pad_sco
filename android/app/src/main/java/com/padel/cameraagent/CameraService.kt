package com.padel.cameraagent

import android.app.*
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import com.pedro.encoder.utils.CodecUtil
import com.pedro.rtplibrary.base.camera2.Camera2ApiBase
import com.pedro.rtplibrary.srt.SrtCamera2
import com.pedro.srt.srt.SrtConnectionListener

/**
 * Foreground service (§185): Camera2 + SRT стриминг + heartbeat.
 *
 * Запускается из MainActivity или BootReceiver. Живёт пока приложение живо;
 * при остановке шлёт offline-heartbeat и закрывает SRT-сессию.
 *
 * §169: Camera2 API для контроля pipeline (physical camera selection,
 * fixed FPS, manual exposure/WB lock).
 */
class CameraService : Service(), SrtConnectionListener {

    companion object {
        private const val TAG = "CameraService"
        private const val CHANNEL_ID = "padel_camera"
        private const val NOTIFICATION_ID = 1001

        // Конфигурация (меняется из MainActivity через SharedPreferences)
        const val PREFS_NAME = "padel_camera_prefs"
        const val KEY_COURT_CODE = "court_code"
        const val KEY_GATEWAY = "gateway_host"
        const val KEY_SRT_PORT = "srt_port"
        const val KEY_PLATFORM = "platform_url"
        const val KEY_RESOLUTION = "resolution" // "4k" | "1080p"
        const val KEY_FPS = "fps"
    }

    private var srtCamera: SrtCamera2? = null
    private var heartbeat: HeartbeatClient? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification("Инициализация..."))

        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val courtCode = prefs.getString(KEY_COURT_CODE, "") ?: ""
        val gateway = prefs.getString(KEY_GATEWAY, BuildConfig.DEFAULT_GATEWAY) ?: BuildConfig.DEFAULT_GATEWAY
        val srtPort = prefs.getInt(KEY_SRT_PORT, BuildConfig.DEFAULT_SRT_PORT)
        val platform = prefs.getString(KEY_PLATFORM, BuildConfig.DEFAULT_PLATFORM) ?: BuildConfig.DEFAULT_PLATFORM
        val resolution = prefs.getString(KEY_RESOLUTION, "1080p") ?: "1080p"
        val fps = prefs.getInt(KEY_FPS, 30)

        if (courtCode.isBlank()) {
            Log.e(TAG, "court_code не задан — откройте настройки")
            stopSelf()
            return START_NOT_STICKY
        }

        val streamKey = "court-$courtCode-main"
        Log.i(TAG, "Запуск: streamKey=$streamKey gateway=$gateway:$srtPort res=$resolution fps=$fps")

        // Heartbeat
        heartbeat = HeartbeatClient(platform, streamKey)
        heartbeat?.updateHealth {
            put("fps", fps)
            put("resolution", resolution)
            put("simulated", false)
        }

        // SRT Camera
        try {
            srtCamera = SrtCamera2(this, this).apply {
                // Профиль (§167): Standard Court или Fallback
                val (w, h) = when (resolution) {
                    "4k" -> 3840 to 2160
                    else -> 1920 to 1080
                }
                prepareVideo(w, h, fps, 3_000_000, 0, true) // bitrate 3 Mbps MVP
                prepareAudio(44100, true, 96 * 1024)
            }

            // §166: выбор ультраширика через Camera2
            val probe = CameraProbe(this)
            val best = probe.selectBestCamera()
            if (best != null) {
                val (cameraId, physicalId) = best
                Log.i(TAG, "Камера: id=$cameraId physical=$physicalId")
                srtCamera?.startPreview(cameraId, physicalId)
                srtCamera?.startStream("srt://$gateway:$srtPort?streamid=publish:$streamKey")

                heartbeat?.start()
                updateNotification("Стриминг: $streamKey")
            } else {
                Log.e(TAG, "Подходящая камера не найдена")
                updateNotification("Ошибка: камера не найдена")
                stopSelf()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Ошибка запуска: ${e.message}", e)
            updateNotification("Ошибка: ${e.message}")
            stopSelf()
        }

        return START_STICKY // перезапуск при kill системой
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.i(TAG, "Остановка")
        try {
            srtCamera?.stopStream()
            srtCamera?.release()
        } catch (e: Exception) {
            Log.w(TAG, "release: ${e.message}")
        }
        heartbeat?.stop()
    }

    // ─── SrtConnectionListener ────────────────────────────────────────────

    override fun onConnectionSuccess() {
        Log.i(TAG, "SRT подключён")
        updateNotification("SRT подключён — стриминг")
    }

    override fun onConnectionFailed(reason: String) {
        Log.e(TAG, "SRT ошибка подключения: $reason")
        updateNotification("SRT ошибка: $reason — retry")
        srtCamera?.reTry(5000, reason) // retry через 5с (§195: recovery ladder)
    }

    override fun onNewBitrate(bitrate: Long) {
        heartbeat?.updateHealth {
            put("bitrateBps", bitrate)
        }
    }

    override fun onDisconnect() {
        Log.w(TAG, "SRT отключён")
        updateNotification("SRT отключён")
    }

    override fun onAuthError() {
        Log.e(TAG, "SRT auth error")
    }

    override fun onAuthSuccess() {
        Log.i(TAG, "SRT auth ok")
    }

    // ─── Notification ─────────────────────────────────────────────────────

    private fun buildNotification(text: String): Notification {
        val channel = NotificationChannel(CHANNEL_ID, "Padel Camera", NotificationManager.IMPORTANCE_LOW)
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(channel)

        val intent = Intent(this, MainActivity::class.java)
        val pending = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE)

        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Padel Camera Agent")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentIntent(pending)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(text: String) {
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, buildNotification(text))
    }
}
