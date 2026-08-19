package com.padel.cameraagent

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Главный экран Camera Agent (§188: provisioning + §166: probe results).
 *
 * MVP-UI: тёмная тема, крупные элементы для установки на корте.
 * Показывает:
 *   1. Найденные камеры (Camera2 probe — ультраширик, разрешения, FPS)
 *   2. Настройки: код корта, gateway, платформа, разрешение
 *   3. Кнопку Старт/Стоп стриминга
 */
class MainActivity : AppCompatActivity() {

    companion object {
        private const val PERMISSION_REQUEST = 100
    }

    private lateinit var probeResult: TextView
    private lateinit var courtCodeInput: EditText
    private lateinit var gatewayInput: EditText
    private lateinit var platformInput: EditText
    private lateinit var resolutionSpinner: Spinner
    private lateinit var startButton: Button
    private lateinit var statusText: TextView

    private var isStreaming = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        title = "Padel Camera Agent"

        probeResult = findViewById(R.id.probe_result)
        courtCodeInput = findViewById(R.id.court_code)
        gatewayInput = findViewById(R.id.gateway_host)
        platformInput = findViewById(R.id.platform_url)
        resolutionSpinner = findViewById(R.id.resolution)
        startButton = findViewById(R.id.btn_start)
        statusText = findViewById(R.id.status)

        // Загрузка сохранённых настроек
        val prefs = getSharedPreferences(CameraService.PREFS_NAME, MODE_PRIVATE)
        courtCodeInput.setText(prefs.getString(CameraService.KEY_COURT_CODE, ""))
        gatewayInput.setText(prefs.getString(CameraService.KEY_GATEWAY, BuildConfig.DEFAULT_GATEWAY))
        platformInput.setText(prefs.getString(CameraService.KEY_PLATFORM, BuildConfig.DEFAULT_PLATFORM))

        // Spinner: разрешение
        val resolutions = arrayOf("1080p (стабильно)", "4K (если поддерживается)")
        resolutionSpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, resolutions)
        resolutionSpinner.setSelection(0) // MVP: 1080p по умолчанию

        // Camera probe при запуске
        requestPermissionsAndProbe()

        startButton.setOnClickListener {
            if (isStreaming) {
                stopService(Intent(this, CameraService::class.java))
                isStreaming = false
                startButton.text = "Старт"
                statusText.text = "Остановлен"
            } else {
                saveAndStart()
            }
        }
    }

    private fun requestPermissionsAndProbe() {
        val needed = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.CAMERA)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            && android.os.Build.VERSION.SDK_INT >= 33) {
            needed.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        if (needed.isEmpty()) {
            runProbe()
        } else {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), PERMISSION_REQUEST)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSION_REQUEST) {
            runProbe()
        }
    }

    private fun runProbe() {
        val probe = CameraProbe(this)
        val cameras = probe.probe()
        val best = probe.selectBestCamera()

        val sb = StringBuilder()
        sb.append("══ Camera2 Probe (§166) ══\n\n")

        for (cam in cameras) {
            val marker = if (cam.isUltraWide) "★" else " "
            sb.append("$marker ${cam.cameraId}/${cam.physicalId ?: "logical"}\n")
            sb.append("   focal: ${cam.focalLength?.let { "%.1f".format(it) } ?: "?"}mm\n")
            sb.append("   sensor: ${cam.sensorInfo}\n")
            sb.append("   max res: ${cam.supportedResolutions.firstOrNull() ?: "?"}\n")
            sb.append("   max fps: ${cam.maxFps ?: "?"}\n")
            sb.append("   manual: ${cam.hasManualControls}\n\n")
        }

        sb.append("══ Выбор ══\n")
        sb.append(best?.let { (id, phys) -> "Камера: $id/${phys ?: "logical"}" } ?: "НЕ НАЙДЕНА")

        probeResult.text = sb.toString()
    }

    private fun saveAndStart() {
        val courtCode = courtCodeInput.text.toString().trim()
        if (courtCode.isBlank()) {
            Toast.makeText(this, "Введите код корта (из /settings → Корты)", Toast.LENGTH_LONG).show()
            return
        }

        val prefs = getSharedPreferences(CameraService.PREFS_NAME, MODE_PRIVATE).edit()
        prefs.putString(CameraService.KEY_COURT_CODE, courtCode)
        prefs.putString(CameraService.KEY_GATEWAY, gatewayInput.text.toString().trim())
        prefs.putString(CameraService.KEY_PLATFORM, platformInput.text.toString().trim())
        prefs.putString(CameraService.KEY_RESOLUTION, if (resolutionSpinner.selectedItemPosition == 1) "4k" else "1080p")
        prefs.putInt(CameraService.KEY_FPS, 30)
        prefs.apply()

        startForegroundService(Intent(this, CameraService::class.java))
        isStreaming = true
        startButton.text = "Стоп"
        statusText.text = "Запуск... court-$courtCode-main"

        Toast.makeText(this, "Стриминг запущен: court-$courtCode-main", Toast.LENGTH_SHORT).show()
    }
}
