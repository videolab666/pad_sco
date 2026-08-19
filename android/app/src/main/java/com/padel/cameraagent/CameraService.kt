package com.padel.cameraagent

import android.app.*
import android.content.Intent
import android.os.IBinder
import android.util.Log

/**
 * Foreground service (§185): MVP без RootEncoder.
 * Camera Probe + Heartbeat — стриминг добавим через Android Studio.
 */
class CameraService : Service() {
    companion object {
        private const val TAG = "CameraService"
        private const val CHANNEL_ID = "padel_camera"
        private const val NOTIFICATION_ID = 1001
        const val PREFS_NAME = "padel_camera_prefs"
        const val KEY_COURT_CODE = "court_code"
        const val KEY_PLATFORM = "platform_url"
    }

    private var heartbeat: HeartbeatClient? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification("Инициализация..."))
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val courtCode = prefs.getString(KEY_COURT_CODE, "") ?: ""
        val platform = prefs.getString(KEY_PLATFORM, "http://192.168.1.100:3000") ?: "http://192.168.1.100:3000"

        if (courtCode.isBlank()) {
            Log.e(TAG, "court_code не задан")
            stopSelf()
            return START_NOT_STICKY
        }

        val streamKey = "court-$courtCode-main"
        Log.i(TAG, "Запуск: streamKey=$streamKey platform=$platform")

        heartbeat = HeartbeatClient(platform, streamKey)
        heartbeat?.updateHealth {
            put("fps", 30)
            put("resolution", "1080p")
            put("simulated", false)
            put("note", "MVP: probe+heartbeat, стриминг добавляется")
        }
        heartbeat?.start()
        updateNotification("Активен: $streamKey")

        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        heartbeat?.stop()
    }

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
