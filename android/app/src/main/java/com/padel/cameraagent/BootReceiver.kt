package com.padel.cameraagent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Автозапуск Camera Agent после boot (§185).
 * Запускает foreground service если court_code уже настроен.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        val prefs = context.getSharedPreferences(CameraService.PREFS_NAME, Context.MODE_PRIVATE)
        val courtCode = prefs.getString(CameraService.KEY_COURT_CODE, "")

        if (courtCode.isNullOrBlank()) {
            Log.i("BootReceiver", "court_code не задан — автозапуск пропущен")
            return
        }

        Log.i("BootReceiver", "Автозапуск Camera Service для корта $courtCode")
        val serviceIntent = Intent(context, CameraService::class.java)
        context.startForegroundService(serviceIntent)
    }
}
