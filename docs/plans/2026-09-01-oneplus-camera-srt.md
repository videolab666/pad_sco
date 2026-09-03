# OnePlus Camera SRT Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the installed OnePlus Camera Agent from a probe/heartbeat MVP into a boot-persistent 1080p Camera2 stream that publishes H.264 over SRT to the venue MediaMTX gateway.

**Architecture:** Keep configuration in SharedPreferences and isolate validation plus endpoint construction in a pure Kotlin `StreamConfig` model. Run RootEncoder `SrtStream` in the existing camera foreground service with a Camera2 source, hardware H.264, no microphone, ultra-wide camera selection, reconnects, and heartbeat health updates. Keep MediaMTX as the transport/recording gateway.

**Tech Stack:** Kotlin, Android Camera2 foreground service, RootEncoder 2.7.5 with its corrected SRT/MPEG-TS startup, compileSdk 36, MediaMTX 1.20.0, JUnit 4, ADB.

**Status:** Completed and verified on the connected OnePlus 9 Pro. A cold reboot restored the ID 2 H.264 stream automatically, and the stream continued while the screen was asleep.

---

### Task 1: Configuration contract

**Files:**
- Create: `android/app/src/main/java/com/padel/cameraagent/StreamConfig.kt`
- Test: `android/app/src/test/java/com/padel/cameraagent/StreamConfigTest.kt`
- Modify: `android/app/build.gradle.kts`

1. Write failing tests for the selected court, stream key, SRT URL, resolution parsing, trimming, and invalid values.
2. Run `:app:testDebugUnitTest` and confirm the missing production type causes failure.
3. Implement the smallest pure Kotlin configuration model.
4. Run the unit tests and confirm they pass.

### Task 2: Real Camera2 to SRT service

**Files:**
- Modify: `android/app/src/main/java/com/padel/cameraagent/CameraService.kt`
- Modify: `android/app/src/main/AndroidManifest.xml`

1. Add RootEncoder 2.7.5 and create an `SrtStream` using `Camera2Source` and `NoAudioSource`.
2. Prepare hardware H.264 at the configured resolution, 30 fps, and 8 Mbit/s.
3. Warm the probed ultra-wide Camera2 ID before opening SRT, publish to MediaMTX, retry failed connections, and release all resources on stop.
4. Feed connection, bitrate, camera, resolution, and failure state into heartbeat and foreground notification.
5. Allow the intended LAN HTTP heartbeat endpoint while retaining a camera foreground service.

### Task 3: Provisioning UI and device defaults

**Files:**
- Modify: `android/app/src/main/java/com/padel/cameraagent/MainActivity.kt`
- Modify: `android/app/build.gradle.kts`

1. Wire the existing gateway and resolution controls to preferences.
2. Default this build to court `7dkrYGs`, gateway `192.168.31.142`, and platform `http://192.168.31.142:3000`.
3. Preserve user-entered values, validate before start, and request required runtime permissions.

### Task 4: Gateway, APK, and end-to-end verification

**Files:**
- Use: `video/mediamtx.yml`
- Output: `android/app/build/outputs/apk/debug/app-debug.apk`

1. Run unit tests and assemble the debug APK with the installed Android SDK.
2. Start native MediaMTX 1.20.0 and the local platform endpoint.
3. Install the APK with ADB, provision court/gateway/platform settings, and start the service.
4. Verify the SRT publisher in MediaMTX API, H.264 path metadata, increasing bytes/frames, heartbeat row, Camera2 ID, and service survival with the screen off.
5. Reboot/power-cycle only when needed and confirm the configured service returns without manual interaction.
