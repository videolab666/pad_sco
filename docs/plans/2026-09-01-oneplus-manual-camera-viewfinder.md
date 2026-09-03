# OnePlus Viewfinder And Manual Camera Controls Implementation Plan

> **For implementation:** execute task-by-task with tests first and verify every camera request on the physical OnePlus 9 Pro.

**Goal:** Add a live local viewfinder for the exact frames sent to SRT, independent Auto/Manual controls for exposure, focus and white balance, and durable restoration of the selected profile after app or phone restart.

**Architecture:** Keep RootEncoder `SrtStream` as the only camera owner. `MainActivity` binds to the started `CameraService`; the service attaches the Activity `TextureView` to RootEncoder's existing OpenGL preview and applies all settings to the same `Camera2Source` repeating request. A pure settings model validates persisted values against a capability snapshot, while an Android adapter reads `CameraCharacteristics`, writes `CaptureRequest` keys, and reports actual `CaptureResult` values back to the UI.

**Reference:** Android's Apache-2.0 Camera2 Manual Controls sample and Camera2 API contracts. Do not add natario1 CameraView: it would create a second camera owner and its public controls do not cover the required ISO/shutter workflow.

**Tech stack:** Kotlin, Android Views, Camera2, RootEncoder 2.7.5, SharedPreferences, JUnit 4.

---

## Task 1: Pure manual-settings contract

**Files:**
- Create: `android/app/src/main/java/com/padel/cameraagent/ManualCameraSettings.kt`
- Test: `android/app/src/test/java/com/padel/cameraagent/ManualCameraSettingsTest.kt`

1. Write failing tests for Auto defaults, ISO/exposure/focus/Kelvin clamping, the 30 fps shutter ceiling, and `allAuto()` preserving saved manual values.
2. Run the focused unit test and confirm it fails because the model is absent.
3. Implement `ManualCameraSettings`, `CameraCapabilitiesSnapshot`, and value formatting helpers with no Android dependencies.
4. Rerun the focused test.

## Task 2: Persistent profile

**Files:**
- Create: `android/app/src/main/java/com/padel/cameraagent/CameraSettingsCodec.kt`
- Modify: `android/app/src/main/java/com/padel/cameraagent/CameraService.kt`
- Test: `android/app/src/test/java/com/padel/cameraagent/CameraSettingsCodecTest.kt`

1. Write failing round-trip and missing/corrupt-value fallback tests using a `Map<String, Any?>` boundary.
2. Implement a pure codec and small SharedPreferences adapter.
3. Save every user change immediately and load/clamp settings before opening camera ID 2.

## Task 3: Device capabilities and Camera2 request mapping

**Files:**
- Create: `android/app/src/main/java/com/padel/cameraagent/CameraManualController.kt`
- Modify: `android/app/src/main/java/com/padel/cameraagent/CameraProbe.kt`
- Test: `android/app/src/test/java/com/padel/cameraagent/WhiteBalanceTest.kt`

1. Test Kelvin-to-RGGB conversion for finite, positive and monotonic gains at 2000 K, 5000 K and 10000 K.
2. Read ISO, exposure, focus, aperture, AWB modes, manual-sensor capability and hardware level from camera ID 2.
3. Map exposure manual mode to `CONTROL_AE_MODE_OFF`, `SENSOR_SENSITIVITY`, `SENSOR_EXPOSURE_TIME` and 30 fps frame duration.
4. Map focus manual mode to `CONTROL_AF_MODE_OFF` and `LENS_FOCUS_DISTANCE`.
5. Map WB manual mode to `CONTROL_AWB_MODE_OFF`, `COLOR_CORRECTION_MODE_TRANSFORM_MATRIX` and `COLOR_CORRECTION_GAINS`; restore automatic algorithms independently.
6. Register a throttled capture callback for actual ISO, shutter, focus, aperture and WB gains.

## Task 4: Service binding and exact-stream preview

**Files:**
- Modify: `android/app/src/main/java/com/padel/cameraagent/CameraService.kt`
- Modify: `android/app/src/main/AndroidManifest.xml`

1. Add a local Binder and listener contract without changing the started foreground-service lifecycle.
2. Attach/detach the Activity `TextureView` through `SrtStream.startPreview`/`stopPreview`; never open another camera.
3. Apply the persisted profile after camera warmup and before publishing SRT frames.
4. Reapply after a camera restart/reconnect and expose current capability/actual-value state to the UI.

## Task 5: Landscape operator UI

**Files:**
- Replace: `android/app/src/main/res/layout/activity_main.xml`
- Modify: `android/app/src/main/java/com/padel/cameraagent/MainActivity.kt`
- Create: `android/app/src/main/res/values/strings.xml`

1. Put a 16:9 `TextureView` with live/preview status on the left.
2. Put a vertically scrollable compact control panel on the right.
3. Let the operator hide the entire panel for an immersive full-screen preview and remember that choice.
4. Overlay a local rule-of-thirds grid and sensor-driven electronic horizon; overlays must never enter SRT.
5. Add independent Auto switches and sliders/selectors for ISO, shutter, focus and WB temperature; show f/2.2 as read-only when aperture has one value.
6. Add `Всё Auto`, keep stream Start/Stop and move provisioning fields into a collapsible/secondary section.
7. Display requested and actual values so HAL clamping is visible.

## Task 6: Build and physical-device verification

1. Run all Android unit tests and `assembleDebug`.
2. Install with `adb install -r`, launch, grant permissions and verify the preview is non-black while the site stream remains live.
3. Exercise Auto/Manual independently and verify matching `dumpsys media.camera` capture results for ISO, shutter, focus and WB; verify aperture remains f/2.2.
4. Confirm SRT path remains healthy and has no new camera disconnect loop or encoder restart.
5. Reboot the phone, wait for Magisk policy autostart, confirm the same saved settings in both UI and capture results, and confirm `padel8.vercel.app`/local HLS is live.
6. Record final APK path, hashes and observed camera values.

## Verification result — 2026-09-01

- Pure model/codec/WB tests: JUnit 4.13.2, 13 tests, 0 failures. The Gradle
  test executor is unusable on this workstation because its inherited PATH is
  malformed; the compiled test classes were executed directly with JUnitCore.
- Debug APK: `assembleDebug` successful; installed on physical LE2121.
- Same Camera2 ID 2 supplies the 1920x1080 preview and SRT stream. Local grid,
  horizon and status overlays are absent from the extracted HLS frame.
- Manual AE/AF/AWB requests were observed in `dumpsys media.camera`. Auto →
  Manual WB captured and persisted `[1.48730469, 1, 1, 2.68554688]`, stayed
  visually neutral, and restored as `AWB OFF` with the same gains after reboot.
- Panel-hidden state restored after reboot. Magisk policy launched the visible
  Activity and camera foreground service; MediaMTX reported the H264 path ready,
  available and online with zero inbound frame errors; HLS returned HTTP 200.
- Final unattended profile is deliberately `Всё AUTO` with the panel hidden,
  because final fixed manual exposure/focus/WB must be calibrated at the court,
  not against the temporary indoor ceiling scene.
