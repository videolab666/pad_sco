package com.padel.cameraagent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.graphics.SurfaceTexture
import android.net.wifi.WifiManager
import android.os.Binder
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.util.Log
import android.view.Surface
import android.view.TextureView
import com.pedro.common.ConnectChecker
import com.pedro.common.VideoCodec
import com.pedro.encoder.input.sources.audio.NoAudioSource
import com.pedro.encoder.input.sources.video.Camera2Source
import com.pedro.encoder.input.gl.render.filters.ContrastFilterRender
import com.pedro.encoder.input.gl.render.filters.GammaFilterRender
import com.pedro.encoder.utils.CodecUtil
import com.pedro.library.srt.SrtStream
import org.json.JSONObject
import java.util.concurrent.CopyOnWriteArraySet

/** Camera2 -> hardware H.264 -> MPEG-TS/SRT foreground service. */
class CameraService : Service(), ConnectChecker {
    interface Listener {
        fun onCameraState(state: CameraOperatorState)
    }

    inner class LocalBinder : Binder() {
        fun getService(): CameraService = this@CameraService
    }

    companion object {
        private const val TAG = "CameraService"
        private const val CHANNEL_ID = "padel_camera"
        private const val NOTIFICATION_ID = 1001
        private const val VIDEO_FPS = 30
        private const val VIDEO_BITRATE = 8_000_000
        private const val I_FRAME_INTERVAL = 2
        private const val SRT_LATENCY_US = 400_000

        const val PREFS_NAME = "padel_camera_prefs"
        const val KEY_COURT_CODE = "court_code"
        const val KEY_GATEWAY = "gateway_host"
        const val KEY_PLATFORM = "platform_url"
        const val KEY_RESOLUTION = "resolution"

        /** Удалённые настройки (plan 2026-09-02): версия/локальный счётчик. */
        const val KEY_SETTINGS_VERSION = "settings_version"
        const val KEY_LOCAL_SEQ = "settings_local_seq"

        @Volatile var isRunning: Boolean = false
            private set
    }

    private var heartbeat: HeartbeatClient? = null
    private var stream: SrtStream? = null
    private var cameraSource: Camera2Source? = null
    private var config: StreamConfig? = null
    private var selectedCameraId: String? = null
    private var lastBitrate = 0L
    /** Рестрим по удалённому конфигу идёт — новые конфиги игнорируем до конца. */
    @Volatile
    private var restarting = false
    private var wakeLock: PowerManager.WakeLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var warmupTexture: SurfaceTexture? = null
    private var warmupSurface: Surface? = null
    private var warmupPreviewStarted = false
    private var destroying = false
    private val localBinder = LocalBinder()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val listeners = CopyOnWriteArraySet<Listener>()
    private var manualController: CameraManualController? = null
    private var actualCameraValues = ActualCameraValues()
    private var operatorStatus = ""
    private var activityPreviewAttached = false
    private lateinit var healthStore: StreamHealthStore
    private var saturationFilter: ImageSaturationFilter? = null
    private var contrastFilter: ContrastFilterRender? = null
    private var gammaFilter: GammaFilterRender? = null

    override fun onBind(intent: Intent?): IBinder = localBinder

    override fun onCreate() {
        super.onCreate()
        operatorStatus = getString(R.string.status_ready_sentence)
        healthStore = StreamHealthStore(this, getSharedPreferences(PREFS_NAME, MODE_PRIVATE))
        acquireDedicatedCameraLocks()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.hasExtra(StreamHealthStore.EXTRA_OPERATOR_DESIRED) == true) {
            healthStore.setDesired(
                intent.getBooleanExtra(StreamHealthStore.EXTRA_OPERATOR_DESIRED, true),
            )
        }
        startForeground(NOTIFICATION_ID, buildNotification(getString(R.string.status_initializing)))
        if (isRunning || restarting) {
            publishOperatorState()
            return START_STICKY
        }
        operatorStatus = getString(R.string.status_initializing)
        healthStore.markAttempt("initializing")
        publishOperatorState()

        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val nextConfig = try {
            StreamConfig.create(
                courtCode = prefs.getString(KEY_COURT_CODE, BuildConfig.DEFAULT_COURT) ?: BuildConfig.DEFAULT_COURT,
                gatewayHost = prefs.getString(KEY_GATEWAY, BuildConfig.DEFAULT_GATEWAY) ?: BuildConfig.DEFAULT_GATEWAY,
                platformUrl = prefs.getString(KEY_PLATFORM, BuildConfig.DEFAULT_PLATFORM) ?: BuildConfig.DEFAULT_PLATFORM,
                resolution = prefs.getString(KEY_RESOLUTION, "1920x1080") ?: "1920x1080",
                srtPort = BuildConfig.DEFAULT_SRT_PORT,
            )
        } catch (error: IllegalArgumentException) {
            Log.e(TAG, "Некорректная конфигурация: ${error.message}")
            updateNotification(getString(R.string.status_settings_error, error.message ?: "—"))
            stopSelf()
            return START_NOT_STICKY
        }
        config = nextConfig

        heartbeat = HeartbeatClient(
            platformUrl = nextConfig.platformUrl,
            streamKey = nextConfig.streamKey,
            deviceSettings = ::buildDeviceSettingsSnapshot,
            onServerPayload = ::applyRemoteConfig,
        ).also {
            it.setStatus("online")
            it.updateHealth { put("connection", "preparing") }
            it.start()
        }

        return try {
            startSrtStream(nextConfig)
            START_STICKY
        } catch (error: Exception) {
            Log.e(TAG, "Запуск SRT не удался", error)
            operatorStatus = getString(R.string.status_camera_error, error.message ?: "—")
            updateHealth("failed", error.message)
            updateNotification(getString(R.string.status_camera_error, error.message ?: "—"))
            publishOperatorState()
            stopSelf()
            START_NOT_STICKY
        }
    }

    private fun startSrtStream(config: StreamConfig) {
        val source = Camera2Source(applicationContext)
        val srt = SrtStream(applicationContext, this, source, NoAudioSource())
        srt.setVideoCodec(VideoCodec.H264)
        srt.forceCodecType(CodecUtil.CodecType.HARDWARE, CodecUtil.CodecType.FIRST_COMPATIBLE_FOUND)
        srt.getStreamClient().apply {
            setLatency(SRT_LATENCY_US)
            setReTries(Int.MAX_VALUE)
            setBitrateExponentialFactor(0.5f)
            setOnlyVideo(true)
            setLogs(true)
        }
        // VUI под фактический контент: GL-цепочка отдаёт full-range YUV, флаг
        // должен совпадать (иначе плееры жмут тени/клипают света). Локальная
        // либа: COLOR_RANGE_FULL + BT.709 (image-quality 2026-09-03).
        // Только ДО prepareVideo (Encoder already prepared — иначе IllegalStateException).
        srt.forceBt709Color(true)
        check(
            srt.prepareVideo(
                width = config.width,
                height = config.height,
                bitrate = VIDEO_BITRATE,
                fps = VIDEO_FPS,
                iFrameInterval = I_FRAME_INTERVAL,
                rotation = 0,
            ),
        ) { "MediaCodec не поддерживает ${config.resolution} H.264" }
        // StreamBase starts both encoders even with NoAudioSource. Preparing the
        // silent encoder satisfies that lifecycle contract; onlyVideo prevents
        // an audio track from being published.
        check(srt.prepareAudio(sampleRate = 32_000, isStereo = false, bitrate = 64_000)) {
            "Не удалось подготовить служебный AudioEncoder"
        }

        installImageFilters(srt, CameraSettingsStore(getSharedPreferences(PREFS_NAME, MODE_PRIVATE)).load())

        cameraSource = source
        stream = srt
        val startupSettings = CameraSettingsStore(getSharedPreferences(PREFS_NAME, MODE_PRIVATE)).load()
        val probe = CameraProbe(applicationContext)
        selectedCameraId = checkNotNull(probe.selectCamera(startupSettings.cameraId)) {
            "Не найдена задняя камера для трансляции"
        }
        Log.i(TAG, "Камера стрима: id=$selectedCameraId (запрошено ${startupSettings.cameraId})")
        // Целевая камера — ДО старта: optimal-размер буфера посчитается под неё
        // (padel patch либы), иначе reOpenCamera унаследует чужой размер → растяжение.
        source.setCameraId(selectedCameraId)
        manualController = CameraManualController(
            context = applicationContext,
            cameraId = selectedCameraId!!,
            fps = VIDEO_FPS,
            store = CameraSettingsStore(getSharedPreferences(PREFS_NAME, MODE_PRIVATE)),
        ) { values ->
            actualCameraValues = values
            publishOperatorState()
        }.also { it.installCaptureCallback(source) }
        warmCameraBeforeSrt(srt, source, selectedCameraId!!, config)
        isRunning = true
        operatorStatus = getString(R.string.status_connecting)
        updateHealth("connecting")
        updateNotification(getString(R.string.notification_connecting, config.streamKey))
        Log.i(TAG, "SRT start endpoint=${config.srtEndpoint} camera=$selectedCameraId")
        srt.startStream(config.srtEndpoint)
        releaseWarmupPreview(srt)
        // stopPreview() пересоздаёт capture-request из TEMPLATE_RECORD — кастомные
        // ключи (zoom/экспозиция/анти-бэндинг) применяем ПОСЛЕ него, поверх живого
        // запроса. Логическая камера конфигурирует сессию дольше физической — ретраи.
        var applied = false
        var applyAttempts = 0
        while (!applied && applyAttempts < 15) {
            applied = manualController?.applyTo(source) == true
            if (!applied) {
                applyAttempts++
                Thread.sleep(200)
            }
        }
        check(applied) {
            "Не удалось применить настройки Camera2"
        }
        updateHealth("connecting")
        publishOperatorState()
    }

    fun registerListener(listener: Listener) {
        listeners.add(listener)
        dispatchOperatorState(listener)
    }

    fun unregisterListener(listener: Listener) {
        listeners.remove(listener)
    }

    fun attachPreview(textureView: TextureView): Boolean {
        val currentStream = stream ?: return false
        return try {
            if (!activityPreviewAttached) {
                currentStream.startPreview(textureView, true)
                activityPreviewAttached = true
            }
            true
        } catch (error: Exception) {
            Log.w(TAG, "attachPreview: ${error.message}")
            false
        }
    }

    fun detachPreview() {
        if (!activityPreviewAttached) return
        activityPreviewAttached = false
        try {
            if (stream?.isOnPreview == true) stream?.stopPreview(true)
        } catch (error: Exception) {
            Log.w(TAG, "detachPreview: ${error.message}")
        }
    }

    /** Локальная смена стрим-конфига (камера/разрешение) из UI: рестрим. */
    fun requestStreamRestart() {
        if (!isRunning || restarting) return
        Log.i(TAG, "Локальный рестрим по запросу UI")
        restartWithCurrentPrefs()
    }

    fun updateManualSettings(requested: ManualCameraSettings): ManualCameraSettings {
        val controller = manualController
        val before = controller?.settings?.imageAdjustments?.clamped()
        val applied = if (controller != null) {
            controller.update(cameraSource, requested)
        } else {
            requested.also {
                CameraSettingsStore(getSharedPreferences(PREFS_NAME, MODE_PRIVATE)).save(it)
            }
        }
        applyImageAdjustments(applied.imageAdjustments)
        // Состав GL-цепочки фиксируется на старте стрима: переход
        // нейтраль↔правки требует рестрима, иначе правка не применилась бы.
        if (before != null && before.isNeutral() != applied.imageAdjustments.clamped().isNeutral()) {
            requestStreamRestart()
        }
        publishOperatorState()
        return applied
    }

    /**
     * Снапшот для heartbeat: версия/локальный счётчик/полный конфиг/возможности.
     * Сервер по ним решает: push желаемого или adopt локальной правки.
     */
    private fun buildDeviceSettingsSnapshot(): JSONObject {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val settings = manualController?.settings
            ?: CameraSettingsStore(prefs).load()
        val caps = manualController?.capabilities
        val camera = JSONObject()
        CameraSettingsCodec.encode(settings).forEach { (key, value) -> camera.put(key, value) }
        return JSONObject().apply {
            put("version", prefs.getLong(KEY_SETTINGS_VERSION, 0L))
            put("localSeq", prefs.getInt(KEY_LOCAL_SEQ, 0))
            put("settings", camera)
            caps?.let {
                put(
                    "caps",
                    JSONObject().apply {
                        put("isoMin", it.isoRange.first)
                        put("isoMax", it.isoRange.last)
                        put("exposureNsMin", it.exposureTimeRangeNs.first)
                        put("exposureNsMax", it.exposureTimeRangeNs.last)
                        put("minFocusDiopters", it.minimumFocusDistanceDiopters)
                        put("evMin", it.exposureCompensationRange.first)
                        put("evMax", it.exposureCompensationRange.last)
                        put("evStepEv", it.exposureCompensationStepEv)
                        put("zoomMin", it.zoomRatioRange?.start ?: 1f)
                        put("zoomMax", it.zoomRatioRange?.endInclusive ?: 1f)
                        put("manualSensor", it.supportsManualSensor)
                        put("manualPostProcessing", it.supportsManualPostProcessing)
                    },
                )
            }
            // Каталог камер устройства: панель на сайте строит выбор объектива
            // по фактическому списку (id + фокусное + физические подкамеры).
            put(
                "cameras",
                org.json.JSONArray().apply {
                    CameraProbe(applicationContext).probe().forEach { info ->
                        put(
                            org.json.JSONObject().apply {
                                put("id", info.cameraId)
                                put("facing", info.facing)
                                put("focal35mm", info.focal35mm ?: JSONObject.NULL)
                                put("logical", info.isLogical)
                                if (info.physicalIds.isNotEmpty()) put("physicalIds", org.json.JSONArray(info.physicalIds))
                                put("pixelArray", info.pixelArray)
                                put("aperture", info.aperture ?: JSONObject.NULL)
                            },
                        )
                    }
                },
            )
        }
    }

    /**
     * Применение удалённого конфига (пришёл в ответе heartbeat).
     * Камера — немедленно; стрим-переопределение — с перезапуском сервиса.
     * Версия пишется до применения: следующий heartbeat подтверждает цикл.
     */
    private fun applyRemoteConfig(payload: JSONObject?) {
        val config = try {
            RemoteSettingsParser.parse(payload)
        } catch (error: Exception) {
            Log.w(TAG, "remote config parse: ${error.message}")
            null
        } ?: return

        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        if (config.version <= prefs.getLong(KEY_SETTINGS_VERSION, 0L)) return

        Log.i(TAG, "Remote settings v${config.version} применяюсь (camera=${config.cameraValues != null}, stream=${config.stream})")
        prefs.edit().putLong(KEY_SETTINGS_VERSION, config.version).apply()

        var streamRestartNeeded = false

        // Сначала camera-ветка: decode-дефолты для отсутствующих ключей не
        // должны сбрасывать стрим-уровневые настройки — camera_id берём из
        // prefs, если карта его не принесла (PUT с camera-секцией без id).
        config.cameraValues?.let { values ->
            val decoded = if (values.containsKey(CameraSettingsCodec.KEY_CAMERA_ID)) {
                CameraSettingsCodec.decode(values)
            } else {
                CameraSettingsCodec.decode(values).copy(
                    cameraId = prefs.getString(CameraSettingsCodec.KEY_CAMERA_ID, "auto") ?: "auto",
                )
            }
            val controller = manualController
            val before = controller?.settings?.imageAdjustments?.clamped()
            if (controller != null) {
                controller.update(cameraSource, decoded, fromRemote = true)
                applyImageAdjustments(controller.settings.imageAdjustments)
            } else {
                CameraSettingsStore(prefs).save(decoded, local = false)
            }
            publishOperatorState()
            // Состав GL-цепочки фиксируется на старте стрима — как и локально,
            // переход нейтраль↔правки требует рестрима.
            val after = controller?.settings?.imageAdjustments?.clamped()
            if (before != null && after != null && before.isNeutral() != after.isNeutral()) {
                streamRestartNeeded = true
            }
        }

        config.stream?.let { stream ->
            val prefsEditor = prefs.edit()
            stream.resolution?.let { resolution ->
                if (resolution != prefs.getString(KEY_RESOLUTION, null)) {
                    prefsEditor.putString(KEY_RESOLUTION, resolution)
                    streamRestartNeeded = true
                }
            }
            stream.courtCode?.let { court ->
                if (court != prefs.getString(KEY_COURT_CODE, null)) {
                    prefsEditor.putString(KEY_COURT_CODE, court)
                    streamRestartNeeded = true
                }
            }
            stream.cameraId?.let { cameraId ->
                if (cameraId != prefs.getString(CameraSettingsCodec.KEY_CAMERA_ID, "auto")) {
                    prefsEditor.putString(CameraSettingsCodec.KEY_CAMERA_ID, cameraId)
                    streamRestartNeeded = true
                }
            }
            prefsEditor.apply()
        }

        updateNotification(getString(R.string.status_remote_applied, config.version))
        if (streamRestartNeeded && !restarting) {
            Log.i(TAG, "Remote settings: стрим-конфиг изменился — рестрим внутри сервиса")
            restartWithCurrentPrefs()
        }
    }

    /**
     * Рестрим по изменившемуся prefs-конфигу (объектив/разрешение/корт) —
     * ВНУТРИ живого сервиса. Пересоздание сервиса из фонового состояния
     * запрещено Android 14+ (FGS type camera SecurityException, дамп
     * 2026-09-03), а живой camera-FGS переоткрывает камеру легально.
     */
    private fun restartWithCurrentPrefs() {
        restarting = true
        // Main thread обязателен: openCamera без явного Handler требует Looper
        // (ру-лог 2026-09-03: «No handler given, and current thread has no looper»).
        mainHandler.post {
            try {
                releaseStreamResources()
            } catch (error: Exception) {
                Log.w(TAG, "рестрим release: ${error.message}")
            }
            isRunning = false
            operatorStatus = getString(R.string.status_initializing)
            publishOperatorState()

            val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            val nextConfig = try {
                StreamConfig.create(
                    courtCode = prefs.getString(KEY_COURT_CODE, BuildConfig.DEFAULT_COURT) ?: BuildConfig.DEFAULT_COURT,
                    gatewayHost = prefs.getString(KEY_GATEWAY, BuildConfig.DEFAULT_GATEWAY) ?: BuildConfig.DEFAULT_GATEWAY,
                    platformUrl = prefs.getString(KEY_PLATFORM, BuildConfig.DEFAULT_PLATFORM) ?: BuildConfig.DEFAULT_PLATFORM,
                    resolution = prefs.getString(KEY_RESOLUTION, "1920x1080") ?: "1920x1080",
                    srtPort = BuildConfig.DEFAULT_SRT_PORT,
                )
            } catch (error: IllegalArgumentException) {
                Log.e(TAG, "Рестрим: некорректная конфигурация: ${error.message}")
                updateNotification(getString(R.string.status_settings_error, error.message ?: "—"))
                restarting = false
                stopSelf()
                return@post
            }
            config = nextConfig

            // Корт в конфиге мог смениться — heartbeat обязан бить новым stream_key.
            heartbeat?.stop()
            heartbeat = HeartbeatClient(
                platformUrl = nextConfig.platformUrl,
                streamKey = nextConfig.streamKey,
                deviceSettings = ::buildDeviceSettingsSnapshot,
                onServerPayload = ::applyRemoteConfig,
            ).also {
                it.setStatus("online")
                it.updateHealth { put("connection", "restarting") }
                it.start()
            }

            try {
                startSrtStream(nextConfig)
                restarting = false
            } catch (error: Exception) {
                Log.e(TAG, "Рестрим SRT не удался", error)
                operatorStatus = getString(R.string.status_camera_error, error.message ?: "—")
                updateHealth("failed", error.message)
                updateNotification(getString(R.string.status_camera_error, error.message ?: "—"))
                publishOperatorState()
                restarting = false
                stopSelf()
            }
        }
    }

    fun currentOperatorState(): CameraOperatorState = CameraOperatorState(
        serviceRunning = isRunning,
        streamStatus = operatorStatus,
        settings = manualController?.settings
            ?: CameraSettingsStore(getSharedPreferences(PREFS_NAME, MODE_PRIVATE)).load(),
        capabilities = manualController?.capabilities,
        actual = actualCameraValues,
        cameraId = cameraSource?.getCurrentCameraId() ?: selectedCameraId,
    )

    private fun publishOperatorState() {
        listeners.forEach(::dispatchOperatorState)
    }

    private fun dispatchOperatorState(listener: Listener) {
        val state = currentOperatorState()
        mainHandler.post {
            if (listeners.contains(listener)) listener.onCameraState(state)
        }
    }

    /**
     * Start Camera2 on the selected lens before the SRT socket is opened. On a
     * cold OxygenOS boot, opening SRT first can publish data before the camera
     * switch has produced a stable H.264 configuration record.
     */
    private fun warmCameraBeforeSrt(
        srt: SrtStream,
        source: Camera2Source,
        cameraId: String,
        config: StreamConfig,
    ) {
        val texture = SurfaceTexture(false).apply {
            setDefaultBufferSize(config.width, config.height)
        }
        val surface = Surface(texture)
        warmupTexture = texture
        warmupSurface = surface
        srt.startPreview(surface, config.width, config.height)
        warmupPreviewStarted = true

        if (source.getCurrentCameraId() != cameraId) source.openCameraId(cameraId)
        val deadline = SystemClock.elapsedRealtime() + CameraWarmupPolicy.OPEN_TIMEOUT_MS
        while (!CameraWarmupPolicy.isTargetReady(source.isRunning(), source.getCurrentCameraId(), cameraId) &&
            SystemClock.elapsedRealtime() < deadline
        ) {
            Thread.sleep(50)
        }
        check(CameraWarmupPolicy.isTargetReady(source.isRunning(), source.getCurrentCameraId(), cameraId)) {
            "Камера $cameraId не открылась перед SRT"
        }
        Thread.sleep(CameraWarmupPolicy.SETTLE_MS)
        Log.i(TAG, "Camera warmup complete camera=$cameraId")
    }

    private fun releaseWarmupPreview(srt: SrtStream) {
        if (warmupPreviewStarted) {
            srt.stopPreview()
            warmupPreviewStarted = false
        }
        warmupSurface?.release()
        warmupSurface = null
        warmupTexture?.release()
        warmupTexture = null
    }

    override fun onConnectionStarted(url: String) {
        Log.i(TAG, "SRT connection started")
        operatorStatus = getString(R.string.status_connecting)
        updateHealth("connecting")
        publishOperatorState()
    }

    override fun onConnectionSuccess() {
        Log.i(TAG, "SRT connected camera=${cameraSource?.getCurrentCameraId()}")
        operatorStatus = getString(R.string.status_live)
        heartbeat?.setStatus("recording")
        updateHealth("connected")
        healthStore.markConnection("connected")
        updateNotification(getString(R.string.notification_live, config?.streamKey ?: "—"))
        publishOperatorState()
    }

    override fun onConnectionFailed(reason: String) {
        Log.w(TAG, "SRT failed: $reason")
        operatorStatus = getString(R.string.status_retrying, reason)
        heartbeat?.setStatus("online")
        updateHealth("retrying", reason)
        healthStore.markConnection("retrying")
        updateNotification(getString(R.string.status_retrying, reason))
        if (!destroying) stream?.getStreamClient()?.reTry(3_000, reason)
        publishOperatorState()
    }

    override fun onNewBitrate(bitrate: Long) {
        lastBitrate = bitrate
        healthStore.record(stream?.getStreamClient()?.getSentVideoFrames() ?: 0, "connected")
        updateHealth("connected")
    }

    override fun onDisconnect() {
        Log.i(TAG, "SRT disconnected")
        operatorStatus = getString(
            if (destroying) R.string.status_stopped else R.string.status_disconnected,
        )
        heartbeat?.setStatus("online")
        updateHealth(if (destroying) "stopped" else "disconnected")
        healthStore.markConnection(if (destroying) "stopped" else "disconnected")
        publishOperatorState()
    }

    override fun onAuthError() {
        updateHealth("auth_error")
        healthStore.markConnection("auth_error")
    }

    override fun onAuthSuccess() = Unit

    private fun updateHealth(connection: String, error: String? = null) {
        val client = stream?.getStreamClient()
        heartbeat?.updateHealth {
            put("connection", connection)
            put("cameraId", cameraSource?.getCurrentCameraId() ?: selectedCameraId ?: "unknown")
            put("resolution", config?.resolution ?: "unknown")
            put("fps", VIDEO_FPS)
            put("targetBitrate", VIDEO_BITRATE)
            put("bitrate", lastBitrate)
            put("videoFramesSent", client?.getSentVideoFrames() ?: 0)
            put("videoFramesDropped", client?.getDroppedVideoFrames() ?: 0)
            put("codec", "H264-hardware")
            // Детектированная частота сети (для панели анти-бэндинга на сайте)
            actualCameraValues.sceneFlicker?.let { put("sceneFlicker", it) }
            put("audio", false)
            error?.let { put("lastError", it.take(300)) }
        }
    }

    private fun acquireDedicatedCameraLocks() {
        val power = getSystemService(POWER_SERVICE) as PowerManager
        wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "padel:camera").apply {
            setReferenceCounted(false)
            acquire()
        }
        val wifi = applicationContext.getSystemService(WIFI_SERVICE) as WifiManager
        @Suppress("DEPRECATION")
        wifiLock = wifi.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "padel:camera").apply {
            setReferenceCounted(false)
            acquire()
        }
    }

    /**
     * GL-фильтры картинки — ТОЛЬКО при не-нейтральных значениях.
     *
     * Критично (image-quality 2026-09-03): SaturationFilterRender RootEncoder'а
     * со значением <= 0 (наш нейтральный дефолт 0!) держит exponents нулевым,
     * а его шейдер ДОБАВЛЯЕТ к выводу второй член pow(x,0)=1/max(...)≈+лума —
     * изображение сильно пересвечивается. Без фильтров стрим идёт чистым
     * путём камера→кодер (эталонное изображение). Переход нейтраль↔правки
     * требует рестрима (restartWithCurrentPrefs).
     */
    /**
     * GL-фильтры картинки. Нейтральные значения → чистый путь (ни одного
     * GL-прохода). Как только любая правка не нейтральна — ставим ВСЕ ТРИ:
     * все безопасны (насыщенность — своя mix(luma,color,k); контраст/гамма —
     * честные формулы), и тогда последующие правки любых параметров
     * применяются на живом запросе без рестрима. Рестрим нужен только
     * на переходе нейтраль↔правки.
     */
    private fun installImageFilters(srt: SrtStream, settings: ManualCameraSettings) {
        val adj = settings.imageAdjustments.clamped()
        if (adj.isNeutral()) {
            Log.i(TAG, "Коррекции картинки нейтральны — GL-фильтры не ставлю (чистый путь)")
            return
        }
        saturationFilter = ImageSaturationFilter().also(srt.getGlInterface()::addFilter)
        contrastFilter = ContrastFilterRender().also(srt.getGlInterface()::addFilter)
        gammaFilter = GammaFilterRender().also(srt.getGlInterface()::addFilter)
        Log.i(TAG, "GL-фильтры: saturation=${adj.saturation}, contrast=${adj.contrast}, gamma=${adj.gamma}")
        applyImageAdjustments(adj)
    }

    private fun applyImageAdjustments(requested: ImageAdjustments) {
        val values = requested.clamped()
        // Наш слайдер -1..1 → множитель 0..2 (1 = нейтрально)
        saturationFilter?.setSaturation(1f + values.saturation)
        contrastFilter?.setContrast(values.contrast)
        gammaFilter?.setGamma(values.gamma)
    }

    /** Teardown стрима/камеры без остановки сервиса (рестрим) или вместе с ним. */
    private fun releaseStreamResources() {
        isRunning = false
        activityPreviewAttached = false
        cameraSource?.setCustomOnCaptureCompletedCallback(null)
        try {
            stream?.release()
        } catch (error: Exception) {
            Log.w(TAG, "release: ${error.message}")
        }
        stream = null
        cameraSource = null
        manualController = null
        saturationFilter = null
        contrastFilter = null
        gammaFilter = null
        warmupPreviewStarted = false
        warmupSurface?.release()
        warmupSurface = null
        warmupTexture?.release()
        warmupTexture = null
    }

    override fun onDestroy() {
        destroying = true
        operatorStatus = getString(R.string.status_stopped)
        releaseStreamResources()
        heartbeat?.stop()
        heartbeat = null
        if (wifiLock?.isHeld == true) wifiLock?.release()
        if (wakeLock?.isHeld == true) wakeLock?.release()
        publishOperatorState()
        listeners.clear()
        super.onDestroy()
    }

    private fun buildNotification(text: String): Notification {
        val channel = NotificationChannel(CHANNEL_ID, "Padel Camera", NotificationManager.IMPORTANCE_LOW)
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(channel)
        val pending = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("Padel Camera Agent")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setContentIntent(pending)
            .setOngoing(true)
            .build()
    }

    private fun updateNotification(text: String) {
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager)
            .notify(NOTIFICATION_ID, buildNotification(text))
    }
}
