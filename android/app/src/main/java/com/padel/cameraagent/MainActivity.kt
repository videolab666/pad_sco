package com.padel.cameraagent

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
    companion object { private const val PERMISSION_REQUEST = 100 }

    private lateinit var probeResult: TextView
    private lateinit var courtCodeInput: EditText
    private lateinit var platformInput: EditText
    private lateinit var startButton: Button
    private lateinit var statusText: TextView
    private var isStreaming = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        title = "Padel Camera Agent"

        probeResult = findViewById(R.id.probe_result)
        courtCodeInput = findViewById(R.id.court_code)
        platformInput = findViewById(R.id.platform_url)
        startButton = findViewById(R.id.btn_start)
        statusText = findViewById(R.id.status)

        val prefs = getSharedPreferences(CameraService.PREFS_NAME, MODE_PRIVATE)
        courtCodeInput.setText(prefs.getString(CameraService.KEY_COURT_CODE, ""))
        platformInput.setText(prefs.getString(CameraService.KEY_PLATFORM, BuildConfig.DEFAULT_PLATFORM))

        requestPermissionsAndProbe()

        startButton.setOnClickListener {
            if (isStreaming) {
                stopService(Intent(this, CameraService::class.java))
                isStreaming = false
                startButton.text = "Старт"
                statusText.text = "Остановлен"
            } else saveAndStart()
        }
    }

    private fun requestPermissionsAndProbe() {
        val needed = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED)
            needed.add(Manifest.permission.CAMERA)
        if (needed.isEmpty()) runProbe()
        else ActivityCompat.requestPermissions(this, needed.toTypedArray(), PERMISSION_REQUEST)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSION_REQUEST) runProbe()
    }

    private fun runProbe() {
        val probe = CameraProbe(this)
        val cameras = probe.probe()
        val best = probe.selectBestCamera()
        val sb = StringBuilder("══ Camera2 Probe (§166) ══\n\n")
        for (cam in cameras) {
            val marker = if (cam.isUltraWide) "★" else " "
            sb.append("$marker ${cam.cameraId}  focal≤16mm: ${cam.isUltraWide}\n")
            sb.append("   max: ${cam.supportedResolutions.firstOrNull()}\n")
            sb.append("   fps: ${cam.maxFps}  manual: ${cam.hasManualControls}\n\n")
        }
        sb.append("══ Выбор ══\n${best ?: "НЕ НАЙДЕНА"}")
        probeResult.text = sb.toString()
    }

    private fun saveAndStart() {
        val courtCode = courtCodeInput.text.toString().trim()
        if (courtCode.isBlank()) {
            Toast.makeText(this, "Введите код корта", Toast.LENGTH_LONG).show()
            return
        }
        val prefs = getSharedPreferences(CameraService.PREFS_NAME, MODE_PRIVATE).edit()
        prefs.putString(CameraService.KEY_COURT_CODE, courtCode)
        prefs.putString(CameraService.KEY_PLATFORM, platformInput.text.toString().trim())
        prefs.apply()
        startForegroundService(Intent(this, CameraService::class.java))
        isStreaming = true
        startButton.text = "Стоп"
        statusText.text = "Активен: court-$courtCode-main"
    }
}
