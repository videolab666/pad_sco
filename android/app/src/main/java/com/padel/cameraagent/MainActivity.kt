package com.padel.cameraagent

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.hardware.camera2.CameraManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.view.TextureView
import android.view.View
import android.view.WindowManager
import android.widget.ArrayAdapter
import android.widget.AdapterView
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.os.LocaleListCompat
import com.google.android.material.materialswitch.MaterialSwitch
import java.util.Locale
import kotlin.math.abs
import kotlin.math.roundToInt

/** Пункт спиннера выбора камеры: id + человекочитаемая подпись. */
data class CameraOption(val id: String, val label: String)

class MainActivity : AppCompatActivity(), CameraService.Listener, SensorEventListener {
    companion object {
        private const val PERMISSION_REQUEST = 100
        private const val KEY_PANEL_VISIBLE = "operator_panel_visible"
        private const val KEY_LANGUAGE_TAG = "operator_language_tag"
        private val SHUTTER_DENOMINATORS = intArrayOf(30, 40, 50, 60, 80, 100, 120, 160, 200, 250, 320, 500, 1000)
    }

    private lateinit var preview: TextureView
    private lateinit var horizonOverlay: HorizonOverlayView
    private lateinit var previewPlaceholder: TextView
    private lateinit var liveBadge: TextView
    private lateinit var actualValues: TextView
    private lateinit var cameraInfo: TextView
    private lateinit var courtCodeInput: EditText
    private lateinit var gatewayInput: EditText
    private lateinit var platformInput: EditText
    private lateinit var resolutionInput: Spinner
    private lateinit var cameraSelector: Spinner
    private lateinit var languageInput: Spinner
    private lateinit var startButton: Button
    private lateinit var statusText: TextView
    private lateinit var allAutoButton: Button
    private lateinit var streamSettingsButton: Button
    private lateinit var streamSettingsPanel: LinearLayout
    private lateinit var spinnerExposureMode: Spinner
    private val exposureModes = listOf(
        ExposureMode.AUTO,
        ExposureMode.MANUAL_SHUTTER,
        ExposureMode.MANUAL_ISO,
        ExposureMode.MANUAL,
    )
    private lateinit var autoFocusSwitch: MaterialSwitch
    private lateinit var autoWhiteBalanceSwitch: MaterialSwitch
    private lateinit var isoSeek: SeekBar
    private lateinit var shutterSeek: SeekBar
    private lateinit var focusSeek: SeekBar
    private lateinit var whiteBalanceSeek: SeekBar
    private lateinit var exposureCompensationSeek: SeekBar
    private lateinit var saturationSeek: SeekBar
    private lateinit var contrastSeek: SeekBar
    private lateinit var gammaSeek: SeekBar
    private lateinit var isoValue: TextView
    private lateinit var shutterValue: TextView
    private lateinit var focusValue: TextView
    private lateinit var whiteBalanceValue: TextView
    private lateinit var exposureCompensationValue: TextView
    private lateinit var saturationValue: TextView
    private lateinit var contrastValue: TextView
    private lateinit var gammaValue: TextView
    private lateinit var apertureValue: TextView
    private lateinit var controlPanel: View
    private lateinit var togglePanelButton: Button
    private lateinit var imageSettingsButton: Button
    private lateinit var imageSettingsPanel: LinearLayout
    private lateinit var imageResetButton: Button
    private lateinit var sensorManager: SensorManager
    private var gravitySensor: Sensor? = null

    private val resolutions = listOf("1920x1080", "1280x720")
    private lateinit var settingsStore: CameraSettingsStore
    private var currentSettings = ManualCameraSettings.defaults()
    private var currentCapabilities: CameraCapabilitiesSnapshot? = null
    private var cameraService: CameraService? = null
    private var isBound = false
    private var isStarted = false
    private var renderingControls = false

    private val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            cameraService = (binder as? CameraService.LocalBinder)?.getService()
            isBound = cameraService != null
            cameraService?.registerListener(this@MainActivity)
            cameraService?.currentOperatorState()?.let(::renderOperatorState)
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            isBound = false
            cameraService = null
            previewPlaceholder.visibility = View.VISIBLE
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        applySavedLanguage()
        super.onCreate(savedInstanceState)
        enableImmersiveViewfinder()
        setContentView(R.layout.activity_main)
        title = getString(R.string.app_name)
        isStarted = true
        sensorManager = getSystemService(SENSOR_SERVICE) as SensorManager
        gravitySensor = sensorManager.getDefaultSensor(Sensor.TYPE_GRAVITY)
        settingsStore = CameraSettingsStore(getSharedPreferences(CameraService.PREFS_NAME, MODE_PRIVATE))
        bindViews()
        loadStreamSettings()
        wireControls()
        setPanelVisible(
            getSharedPreferences(CameraService.PREFS_NAME, MODE_PRIVATE).getBoolean(KEY_PANEL_VISIBLE, true),
            persist = false,
        )
        currentSettings = settingsStore.load()
        renderRequestedSettings(currentSettings, null)
        requestPermissionsAndProbe()
        updateServiceState()
    }

    private fun enableImmersiveViewfinder() {
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }
    }

    private fun applySavedLanguage() {
        val tag = getSharedPreferences(CameraService.PREFS_NAME, MODE_PRIVATE)
            .getString(KEY_LANGUAGE_TAG, "").orEmpty()
        val desired = if (tag.isBlank()) LocaleListCompat.getEmptyLocaleList()
        else LocaleListCompat.forLanguageTags(tag)
        if (AppCompatDelegate.getApplicationLocales().toLanguageTags() != desired.toLanguageTags()) {
            AppCompatDelegate.setApplicationLocales(desired)
        }
    }

    override fun onStart() {
        super.onStart()
        isStarted = true
        bindCameraService()
    }

    override fun onStop() {
        isStarted = false
        unbindCameraService()
        super.onStop()
    }

    override fun onResume() {
        super.onResume()
        gravitySensor?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_UI)
        }
        updateServiceState()
    }

    override fun onPause() {
        sensorManager.unregisterListener(this)
        super.onPause()
    }

    override fun onCameraState(state: CameraOperatorState) {
        renderOperatorState(state)
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type != Sensor.TYPE_GRAVITY) return
        @Suppress("DEPRECATION")
        val displayRotation = windowManager.defaultDisplay.rotation
        val reading = HorizonMath.fromGravity(
            event.values[0], event.values[1], event.values[2], displayRotation,
        )
        horizonOverlay.isOrientationValid = reading.valid
        horizonOverlay.rollDegrees = reading.rollDegrees
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    private fun bindViews() {
        preview = findViewById(R.id.camera_preview)
        horizonOverlay = findViewById(R.id.horizon_overlay)
        previewPlaceholder = findViewById(R.id.preview_placeholder)
        liveBadge = findViewById(R.id.live_badge)
        actualValues = findViewById(R.id.actual_values)
        cameraInfo = findViewById(R.id.camera_info)
        courtCodeInput = findViewById(R.id.court_code)
        gatewayInput = findViewById(R.id.gateway_host)
        platformInput = findViewById(R.id.platform_url)
        resolutionInput = findViewById(R.id.resolution)
        cameraSelector = findViewById(R.id.camera_selector)
        languageInput = findViewById(R.id.language)
        startButton = findViewById(R.id.btn_start)
        statusText = findViewById(R.id.status)
        allAutoButton = findViewById(R.id.btn_all_auto)
        streamSettingsButton = findViewById(R.id.btn_stream_settings)
        streamSettingsPanel = findViewById(R.id.stream_settings_panel)
        spinnerExposureMode = findViewById(R.id.spinner_exposure_mode)
        autoFocusSwitch = findViewById(R.id.switch_auto_focus)
        autoWhiteBalanceSwitch = findViewById(R.id.switch_auto_wb)
        isoSeek = findViewById(R.id.seek_iso)
        shutterSeek = findViewById(R.id.seek_shutter)
        focusSeek = findViewById(R.id.seek_focus)
        whiteBalanceSeek = findViewById(R.id.seek_wb)
        exposureCompensationSeek = findViewById(R.id.seek_ev)
        saturationSeek = findViewById(R.id.seek_saturation)
        contrastSeek = findViewById(R.id.seek_contrast)
        gammaSeek = findViewById(R.id.seek_gamma)
        isoValue = findViewById(R.id.iso_value)
        shutterValue = findViewById(R.id.shutter_value)
        focusValue = findViewById(R.id.focus_value)
        whiteBalanceValue = findViewById(R.id.wb_value)
        exposureCompensationValue = findViewById(R.id.ev_value)
        saturationValue = findViewById(R.id.saturation_value)
        contrastValue = findViewById(R.id.contrast_value)
        gammaValue = findViewById(R.id.gamma_value)
        apertureValue = findViewById(R.id.aperture_value)
        controlPanel = findViewById(R.id.control_panel)
        togglePanelButton = findViewById(R.id.btn_toggle_panel)
        imageSettingsButton = findViewById(R.id.btn_image_settings)
        imageSettingsPanel = findViewById(R.id.image_settings_panel)
        imageResetButton = findViewById(R.id.btn_image_reset)
    }

    private fun loadStreamSettings() {
        val prefs = getSharedPreferences(CameraService.PREFS_NAME, MODE_PRIVATE)
        courtCodeInput.setText(prefs.getString(CameraService.KEY_COURT_CODE, BuildConfig.DEFAULT_COURT))
        gatewayInput.setText(prefs.getString(CameraService.KEY_GATEWAY, BuildConfig.DEFAULT_GATEWAY))
        platformInput.setText(prefs.getString(CameraService.KEY_PLATFORM, BuildConfig.DEFAULT_PLATFORM))
        resolutionInput.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, resolutions)
        val selectedResolution = prefs.getString(CameraService.KEY_RESOLUTION, resolutions.first())
        resolutionInput.setSelection(resolutions.indexOf(selectedResolution).coerceAtLeast(0))

        // Каталог камер устройства: id + тип + фокусное (image-quality 2026-09-03).
        // Выбор пишет prefs camera_id; если сервис работает — рестрим вживую.
        val cameraOptions = listOf(CameraOption("auto", getString(R.string.camera_option_auto))) +
            CameraProbe(this).probe().map { CameraOption(it.cameraId, it.label) }
        cameraSelector.adapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_dropdown_item,
            cameraOptions.map { it.label },
        )
        val selectedCamera = prefs.getString(CameraSettingsCodec.KEY_CAMERA_ID, "auto") ?: "auto"
        cameraSelector.setSelection(
            cameraOptions.indexOfFirst { it.id == selectedCamera }.takeIf { it >= 0 } ?: 0,
        )
        cameraSelector.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            private var initial = true
            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                if (initial) {
                    initial = false
                    return
                }
                val option = cameraOptions.getOrNull(position) ?: return
                if (option.id == prefs.getString(CameraSettingsCodec.KEY_CAMERA_ID, "auto")) return
                prefs.edit().putString(CameraSettingsCodec.KEY_CAMERA_ID, option.id).apply()
                // Локальная правка: seq++ (сервер adopt'ит camera_id как desired)
                currentSettings = currentSettings.copy(cameraId = option.id)
                settingsStore.save(currentSettings, local = true)
                val service = cameraService
                if (service != null) {
                    service.requestStreamRestart()
                } else {
                    Toast.makeText(this@MainActivity, R.string.camera_saved_restart_hint, Toast.LENGTH_SHORT).show()
                }
            }
        }
        val languages = listOf(
            getString(R.string.language_system),
            getString(R.string.language_english),
            getString(R.string.language_russian),
            getString(R.string.language_ukrainian),
        )
        languageInput.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, languages)
        val selectedLanguage = prefs.getString(KEY_LANGUAGE_TAG, "").orEmpty()
        languageInput.setSelection(listOf("", "en", "ru", "uk").indexOf(selectedLanguage).coerceAtLeast(0))
        languageInput.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            private var initial = true
            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
            override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                if (initial) {
                    initial = false
                    return
                }
                val tag = listOf("", "en", "ru", "uk")[position.coerceIn(0, 3)]
                if (tag == prefs.getString(KEY_LANGUAGE_TAG, "").orEmpty()) return
                prefs.edit().putString(KEY_LANGUAGE_TAG, tag).apply()
                AppCompatDelegate.setApplicationLocales(
                    if (tag.isBlank()) LocaleListCompat.getEmptyLocaleList()
                    else LocaleListCompat.forLanguageTags(tag),
                )
            }
        }
    }

    private fun wireControls() {
        startButton.setOnClickListener {
            if (CameraService.isRunning) stopStreaming() else saveAndStart()
        }
        allAutoButton.setOnClickListener { persistOrApply(currentSettings.allAuto()) }
        streamSettingsButton.setOnClickListener {
            val showing = streamSettingsPanel.visibility == View.VISIBLE
            streamSettingsPanel.visibility = if (showing) View.GONE else View.VISIBLE
            streamSettingsButton.setText(if (showing) R.string.stream_settings_show else R.string.stream_settings_hide)
        }
        imageSettingsButton.setOnClickListener {
            val showing = imageSettingsPanel.visibility == View.VISIBLE
            imageSettingsPanel.visibility = if (showing) View.GONE else View.VISIBLE
            imageSettingsButton.setText(if (showing) R.string.image_settings_show else R.string.image_settings_hide)
        }
        imageResetButton.setOnClickListener {
            persistOrApply(currentSettings.copy(imageAdjustments = ImageAdjustments.defaults()))
        }
        togglePanelButton.setOnClickListener {
            setPanelVisible(controlPanel.visibility != View.VISIBLE, persist = true)
        }
        spinnerExposureMode.adapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_item,
            listOf(
                getString(R.string.exposure_mode_auto),
                getString(R.string.exposure_mode_manual_shutter),
                getString(R.string.exposure_mode_manual_iso),
                getString(R.string.exposure_mode_manual),
            ),
        ).also { it.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item) }
        spinnerExposureMode.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                if (!renderingControls) {
                    persistOrApply(currentSettings.copy(exposureMode = exposureModes[position]))
                }
            }

            override fun onNothingSelected(parent: AdapterView<*>?) = Unit
        }
        autoFocusSwitch.setOnCheckedChangeListener { _, checked ->
            if (!renderingControls) persistOrApply(currentSettings.copy(autoFocus = checked))
        }
        autoWhiteBalanceSwitch.setOnCheckedChangeListener { _, checked ->
            if (!renderingControls) persistOrApply(currentSettings.copy(autoWhiteBalance = checked))
        }
        isoSeek.setOnSeekBarChangeListener(seekListener { progress ->
            val minimum = currentCapabilities?.isoRange?.first ?: 100
            persistOrApply(currentSettings.copy(iso = minimum + progress))
        })
        shutterSeek.setOnSeekBarChangeListener(seekListener { progress ->
            val denominator = SHUTTER_DENOMINATORS[progress.coerceIn(SHUTTER_DENOMINATORS.indices)]
            persistOrApply(currentSettings.copy(exposureTimeNs = 1_000_000_000L / denominator))
        })
        focusSeek.setOnSeekBarChangeListener(seekListener { progress ->
            val maximum = currentCapabilities?.minimumFocusDistanceDiopters ?: 25f
            persistOrApply(currentSettings.copy(focusDistanceDiopters = maximum * progress / 1000f))
        })
        whiteBalanceSeek.setOnSeekBarChangeListener(seekListener { progress ->
            persistOrApply(
                currentSettings.copy(whiteBalanceKelvin = ManualCameraSettings.MIN_WB_KELVIN + progress),
            )
        })
        exposureCompensationSeek.setOnSeekBarChangeListener(seekListener { progress ->
            val minimum = currentCapabilities?.exposureCompensationRange?.first ?: -18
            persistOrApply(currentSettings.copy(exposureCompensationSteps = minimum + progress))
        })
        saturationSeek.setOnSeekBarChangeListener(seekListener { progress ->
            persistOrApply(
                currentSettings.copy(
                    imageAdjustments = currentSettings.imageAdjustments.copy(
                        saturation = progress / 100f - 1f,
                    ),
                ),
            )
        })
        contrastSeek.setOnSeekBarChangeListener(seekListener { progress ->
            persistOrApply(
                currentSettings.copy(
                    imageAdjustments = currentSettings.imageAdjustments.copy(
                        contrast = progress / 100f + 0.5f,
                    ),
                ),
            )
        })
        gammaSeek.setOnSeekBarChangeListener(seekListener { progress ->
            persistOrApply(
                currentSettings.copy(
                    imageAdjustments = currentSettings.imageAdjustments.copy(
                        gamma = progress / 100f + 0.5f,
                    ),
                ),
            )
        })
    }

    private fun setPanelVisible(visible: Boolean, persist: Boolean) {
        controlPanel.visibility = if (visible) View.VISIBLE else View.GONE
        togglePanelButton.text = if (visible) "›" else "‹"
        val params = togglePanelButton.layoutParams as FrameLayout.LayoutParams
        params.marginEnd = if (visible) (300f * resources.displayMetrics.density).roundToInt() else 0
        togglePanelButton.layoutParams = params
        if (persist) {
            getSharedPreferences(CameraService.PREFS_NAME, MODE_PRIVATE).edit()
                .putBoolean(KEY_PANEL_VISIBLE, visible)
                .apply()
        }
    }

    private fun seekListener(onStopped: (Int) -> Unit) = object : SeekBar.OnSeekBarChangeListener {
        override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
            if (fromUser && !renderingControls) renderRequestedLabelsForProgress()
        }

        override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit

        override fun onStopTrackingTouch(seekBar: SeekBar?) {
            if (!renderingControls && seekBar != null) onStopped(seekBar.progress)
        }
    }

    private fun persistOrApply(requested: ManualCameraSettings) {
        currentSettings = cameraService?.updateManualSettings(requested) ?: requested.also(settingsStore::save)
        renderRequestedSettings(currentSettings, currentCapabilities)
    }

    private fun renderOperatorState(state: CameraOperatorState) {
        currentSettings = state.settings
        currentCapabilities = state.capabilities ?: currentCapabilities
        renderRequestedSettings(currentSettings, currentCapabilities)
        statusText.text = state.cameraId?.let { id ->
            "${state.streamStatus} · камера $id"
        } ?: state.streamStatus
        liveBadge.text = state.streamStatus.uppercase(Locale.ROOT)
        startButton.setText(if (state.serviceRunning) R.string.stop else R.string.start)
        previewPlaceholder.visibility = if (state.serviceRunning) View.GONE else View.VISIBLE
        if (state.serviceRunning) cameraService?.attachPreview(preview)
        renderActualValues(state.actual)
    }

    private fun renderRequestedSettings(
        settings: ManualCameraSettings,
        capabilities: CameraCapabilitiesSnapshot?,
    ) {
        renderingControls = true
        val isoRange = capabilities?.isoRange ?: (100..6400)
        isoSeek.max = (isoRange.last - isoRange.first).coerceAtLeast(1)
        isoSeek.progress = (settings.iso - isoRange.first).coerceIn(0, isoSeek.max)
        shutterSeek.progress = nearestShutterIndex(settings.exposureTimeNs)
        focusSeek.progress = if ((capabilities?.minimumFocusDistanceDiopters ?: 25f) > 0f) {
            (settings.focusDistanceDiopters / (capabilities?.minimumFocusDistanceDiopters ?: 25f) * 1000f)
                .roundToInt().coerceIn(0, 1000)
        } else 0
        whiteBalanceSeek.progress = (settings.whiteBalanceKelvin - ManualCameraSettings.MIN_WB_KELVIN)
            .coerceIn(0, whiteBalanceSeek.max)
        val evRange = capabilities?.exposureCompensationRange ?: (-18..18)
        exposureCompensationSeek.max = (evRange.last - evRange.first).coerceAtLeast(0)
        exposureCompensationSeek.progress = (settings.exposureCompensationSteps - evRange.first)
            .coerceIn(0, exposureCompensationSeek.max)
        saturationSeek.progress = ((settings.imageAdjustments.saturation + 1f) * 100f)
            .roundToInt().coerceIn(0, 200)
        contrastSeek.progress = ((settings.imageAdjustments.contrast - 0.5f) * 100f)
            .roundToInt().coerceIn(0, 150)
        gammaSeek.progress = ((settings.imageAdjustments.gamma - 0.5f) * 100f)
            .roundToInt().coerceIn(0, 150)
        spinnerExposureMode.setSelection(exposureModes.indexOf(settings.exposureMode).coerceAtLeast(0), false)
        autoFocusSwitch.isChecked = settings.autoFocus
        autoWhiteBalanceSwitch.isChecked = settings.autoWhiteBalance
        autoFocusSwitch.setText(if (settings.autoFocus) R.string.focus_auto else R.string.focus_manual)
        autoWhiteBalanceSwitch.setText(if (settings.autoWhiteBalance) R.string.wb_auto else R.string.wb_manual)
        val manualSensor = capabilities?.supportsManualSensor != false
        // Ручной ISO активен в MANUAL/MANUAL_ISO; ручная выдержка — в MANUAL/MANUAL_SHUTTER;
        // EV работает везде, кроме полного мануала (нет авто-компонента)
        isoSeek.isEnabled = settings.manualIso && manualSensor
        shutterSeek.isEnabled = settings.manualShutter && manualSensor
        exposureCompensationSeek.isEnabled =
            settings.exposureMode != ExposureMode.MANUAL && evRange.first != evRange.last
        focusSeek.isEnabled = !settings.autoFocus && (capabilities?.minimumFocusDistanceDiopters ?: 25f) > 0f
        whiteBalanceSeek.isEnabled = !settings.autoWhiteBalance && capabilities?.supportsManualPostProcessing != false
        renderRequestedLabels(settings)
        renderCapabilities(capabilities)
        renderingControls = false
    }

    private fun renderRequestedLabels(settings: ManualCameraSettings) {
        isoValue.text = getString(R.string.iso_format, settings.iso)
        shutterValue.text = getString(R.string.shutter_format, formatExposure(settings.exposureTimeNs))
        focusValue.text = getString(R.string.focus_format, formatFocus(settings.focusDistanceDiopters))
        whiteBalanceValue.text = getString(R.string.wb_format, settings.whiteBalanceKelvin)
        val evStep = currentCapabilities?.exposureCompensationStepEv ?: (1f / 6f)
        exposureCompensationValue.text = getString(
            R.string.ev_format,
            formatSigned(settings.exposureCompensationSteps * evStep),
        )
        saturationValue.text = getString(
            R.string.saturation_format,
            formatSigned(settings.imageAdjustments.saturation),
        )
        contrastValue.text = getString(R.string.contrast_format, formatDecimal(settings.imageAdjustments.contrast))
        gammaValue.text = getString(R.string.gamma_format, formatDecimal(settings.imageAdjustments.gamma))
    }

    private fun renderRequestedLabelsForProgress() {
        val isoMinimum = currentCapabilities?.isoRange?.first ?: 100
        isoValue.text = getString(R.string.iso_format, isoMinimum + isoSeek.progress)
        shutterValue.text = getString(
            R.string.shutter_format,
            "1/${SHUTTER_DENOMINATORS[shutterSeek.progress]}",
        )
        val focusMaximum = currentCapabilities?.minimumFocusDistanceDiopters ?: 25f
        focusValue.text = getString(
            R.string.focus_format,
            formatFocus(focusMaximum * focusSeek.progress / 1000f),
        )
        whiteBalanceValue.text = getString(
            R.string.wb_format,
            ManualCameraSettings.MIN_WB_KELVIN + whiteBalanceSeek.progress,
        )
        val evMinimum = currentCapabilities?.exposureCompensationRange?.first ?: -18
        val evStep = currentCapabilities?.exposureCompensationStepEv ?: (1f / 6f)
        exposureCompensationValue.text = getString(
            R.string.ev_format,
            formatSigned((evMinimum + exposureCompensationSeek.progress) * evStep),
        )
        saturationValue.text = getString(
            R.string.saturation_format,
            formatSigned(saturationSeek.progress / 100f - 1f),
        )
        contrastValue.text = getString(
            R.string.contrast_format,
            formatDecimal(contrastSeek.progress / 100f + 0.5f),
        )
        gammaValue.text = getString(
            R.string.gamma_format,
            formatDecimal(gammaSeek.progress / 100f + 0.5f),
        )
    }

    private fun renderCapabilities(capabilities: CameraCapabilitiesSnapshot?) {
        if (capabilities == null) return
        val aperture = capabilities.apertures.firstOrNull()
        cameraInfo.text = getString(
            R.string.camera_info_format,
            capabilities.isoRange.first,
            capabilities.isoRange.last,
        )
        apertureValue.text = when {
            aperture == null -> getString(R.string.aperture_unknown)
            capabilities.isApertureAdjustable -> getString(
                R.string.aperture_adjustable,
                formatDecimal(aperture),
            )
            else -> getString(R.string.aperture_fixed, formatDecimal(aperture))
        }
    }

    private fun renderActualValues(actual: ActualCameraValues) {
        val focus = actual.focusDistanceDiopters?.let(::formatFocus) ?: "—"
        val aperture = actual.aperture?.let { "f/${formatDecimal(it)}" } ?: "f/—"
        val evStep = currentCapabilities?.exposureCompensationStepEv ?: 0f
        val actualEv = actual.exposureCompensationSteps?.let { formatSigned(it * evStep) } ?: "—"
        actualValues.text = getString(
            R.string.actual_values_format,
            actual.iso?.toString() ?: "—",
            formatExposure(actual.exposureTimeNs),
            focus,
            aperture,
            actualEv,
        )
    }

    private fun requestPermissionsAndProbe() {
        val needed = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            needed.add(Manifest.permission.CAMERA)
        }
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            needed.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (needed.isEmpty()) runProbe()
        else ActivityCompat.requestPermissions(this, needed.toTypedArray(), PERMISSION_REQUEST)
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSION_REQUEST &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        ) {
            runProbe()
        }
    }

    private fun runProbe() {
        // Характеристики берём от камеры, которую РЕАЛЬНО выберет сервис
        // (settings.cameraId), а не от «лучшего UW» — иначе панель врёт
        // (баг: показывали id 2, пока стрим шёл с id 5).
        val cameraId = CameraProbe(this).selectCamera(currentSettings.cameraId) ?: return
        val manager = getSystemService(CAMERA_SERVICE) as CameraManager
        currentCapabilities = CameraManualController.readCapabilities(manager.getCameraCharacteristics(cameraId))
        currentSettings = currentSettings.clampedTo(currentCapabilities!!, fps = 30)
        renderRequestedSettings(currentSettings, currentCapabilities)
    }

    private fun saveAndStart() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionsAndProbe()
            Toast.makeText(this, R.string.camera_permission_required, Toast.LENGTH_LONG).show()
            return
        }
        val config = try {
            StreamConfig.create(
                courtCodeInput.text.toString(),
                gatewayInput.text.toString(),
                platformInput.text.toString(),
                resolutionInput.selectedItem.toString(),
                BuildConfig.DEFAULT_SRT_PORT,
            )
        } catch (error: IllegalArgumentException) {
            Toast.makeText(this, error.message, Toast.LENGTH_LONG).show()
            return
        }
        getSharedPreferences(CameraService.PREFS_NAME, MODE_PRIVATE).edit()
            .putString(CameraService.KEY_COURT_CODE, config.courtCode)
            .putString(CameraService.KEY_GATEWAY, config.gatewayHost)
            .putString(CameraService.KEY_PLATFORM, config.platformUrl)
            .putString(CameraService.KEY_RESOLUTION, config.resolution)
            .apply()
        StreamHealthStore(this, getSharedPreferences(CameraService.PREFS_NAME, MODE_PRIVATE))
            .setDesired(true)
        startForegroundService(
            Intent(this, CameraService::class.java)
                .putExtra(StreamHealthStore.EXTRA_OPERATOR_DESIRED, true),
        )
        statusText.text = getString(R.string.status_starting, config.streamKey)
        startButton.setText(R.string.stop)
    }

    private fun stopStreaming() {
        StreamHealthStore(this, getSharedPreferences(CameraService.PREFS_NAME, MODE_PRIVATE))
            .setDesired(false)
        unbindCameraService()
        stopService(Intent(this, CameraService::class.java))
        previewPlaceholder.visibility = View.VISIBLE
        statusText.setText(R.string.status_stopped)
        liveBadge.setText(R.string.status_stopped)
        startButton.setText(R.string.start)
        preview.postDelayed({ if (isStarted) bindCameraService() }, 400L)
    }

    private fun bindCameraService() {
        if (isBound) return
        bindService(Intent(this, CameraService::class.java), serviceConnection, Context.BIND_AUTO_CREATE)
    }

    private fun unbindCameraService() {
        val service = cameraService
        if (isBound) {
            service?.detachPreview()
            service?.unregisterListener(this)
            unbindService(serviceConnection)
        }
        isBound = false
        cameraService = null
    }

    private fun updateServiceState() {
        startButton.setText(if (CameraService.isRunning) R.string.stop else R.string.start)
        if (!CameraService.isRunning) {
            statusText.setText(R.string.status_ready_sentence)
            previewPlaceholder.visibility = View.VISIBLE
        }
    }

    private fun nearestShutterIndex(exposureTimeNs: Long): Int {
        return SHUTTER_DENOMINATORS.indices.minByOrNull { index ->
            abs((1_000_000_000L / SHUTTER_DENOMINATORS[index]) - exposureTimeNs)
        } ?: 0
    }

    private fun formatExposure(exposureTimeNs: Long?): String {
        if (exposureTimeNs == null || exposureTimeNs <= 0L) return "1/—"
        return if (exposureTimeNs < 1_000_000_000L) {
            "1/${(1_000_000_000.0 / exposureTimeNs).roundToInt().coerceAtLeast(1)}"
        } else {
            String.format(Locale.US, "%.1fs", exposureTimeNs / 1_000_000_000.0)
        }
    }

    private fun formatFocus(diopters: Float): String {
        if (diopters <= 0.001f) return "∞"
        val meters = 1f / diopters
        return if (meters >= 1f) String.format(Locale.US, "%.1fm", meters)
        else "${(meters * 100f).roundToInt()}cm"
    }

    private fun formatDecimal(value: Float): String = String.format(Locale.US, "%.1f", value)

    private fun formatSigned(value: Float): String = String.format(Locale.US, "%+.2f", value)
}
