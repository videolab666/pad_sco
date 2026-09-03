# Camera Agent Resilience, Localization And Image Controls Implementation Plan

> **For implementation:** execute test-first and verify lifecycle behavior on the physical OnePlus 9 Pro.

**Goal:** Correct landscape horizon behavior, add localized automatic exposure and image controls, and provide progress-based unattended SRT recovery with a guarded reboot after five failed recoveries.

**Architecture:** Pure Kotlin models calculate horizon, settings persistence, and recovery decisions. Android adapters map those models to sensors, Camera2, RootEncoder GL filters, localized resources, and a health file readable by the Magisk watchdog.

**Tech stack:** Kotlin, Android Views, Camera2, RootEncoder 2.7.5, SharedPreferences, JUnit 4, Magisk shell service.

---

## Task 1: Pure contracts and failing tests

**Files:**
- Create: `android/app/src/main/java/com/padel/cameraagent/HorizonMath.kt`
- Create: `android/app/src/main/java/com/padel/cameraagent/StreamRecoveryPolicy.kt`
- Modify: `android/app/src/main/java/com/padel/cameraagent/ManualCameraSettings.kt`
- Modify: `android/app/src/main/java/com/padel/cameraagent/CameraSettingsCodec.kt`
- Test: `android/app/src/test/java/com/padel/cameraagent/HorizonMathTest.kt`
- Test: `android/app/src/test/java/com/padel/cameraagent/StreamRecoveryPolicyTest.kt`
- Test: `android/app/src/test/java/com/padel/cameraagent/ImageAdjustmentsTest.kt`

Write tests for landscape gravity mapping, flat-device invalidity, EV/filter clamping and round-trip persistence, five-failure reboot threshold, cooldown, stable reset, and STOP intent.

## Task 2: Sensor, Camera2 and GL implementation

**Files:**
- Modify: `android/app/src/main/java/com/padel/cameraagent/MainActivity.kt`
- Modify: `android/app/src/main/java/com/padel/cameraagent/HorizonOverlayView.kt`
- Modify: `android/app/src/main/java/com/padel/cameraagent/CameraManualController.kt`
- Modify: `android/app/src/main/java/com/padel/cameraagent/CameraService.kt`

Use `TYPE_GRAVITY`, apply `CONTROL_AE_EXPOSURE_COMPENSATION` only with AE enabled, and install saturation/contrast/gamma filters on the service-owned GL graph. Keep one preview/encoder graph across Activity lifecycle changes.

## Task 3: Complete localization and compact UI

**Files:**
- Replace: `android/app/src/main/res/values/strings.xml`
- Create: `android/app/src/main/res/values-ru/strings.xml`
- Create: `android/app/src/main/res/values-uk/strings.xml`
- Modify: `android/app/src/main/res/layout/activity_main.xml`
- Modify: `android/app/src/main/java/com/padel/cameraagent/MainActivity.kt`

Move all operator-facing text to resources, add a language selector, EV slider, collapsible image section, three filter sliders, and reset action while preserving the full-screen panel toggle.

## Task 4: Health contract and Magisk watchdog

**Files:**
- Create: `android/app/src/main/java/com/padel/cameraagent/StreamHealthStore.kt`
- Modify: `android/app/src/main/java/com/padel/cameraagent/CameraService.kt`
- Modify: `MAGISK_MODULES_APK_FOR_ONEPLUS/padel_dedicated_camera_policy/service.sh`
- Modify: `MAGISK_MODULES_APK_FOR_ONEPLUS/padel_dedicated_camera_policy/module.prop`
- Modify: `MAGISK_MODULES_APK_FOR_ONEPLUS/padel_dedicated_camera_policy/test-policy.ps1`

Persist operator desire and a root-readable atomic health snapshot. Poll every 30 seconds, recover after 90 seconds stale, reboot only after five failed cold recoveries, and enforce a 30-minute reboot guard. Package a new versioned module zip.

## Task 5: Verification

Run focused red/green unit tests, all unit tests, `assembleDebug`, static localization checks, shell policy checks, APK install, horizon/device checks, preview/SRT image checks, Activity background/reopen, network reconnect, process kill recovery, five-failure policy simulation, STOP persistence, and reboot restoration.
