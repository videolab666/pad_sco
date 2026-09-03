# Camera Agent Resilience, Localization And Image Controls Design

**Goal:** Make the dedicated OnePlus camera operator-safe in landscape, expose useful automatic and creative image controls, localize the complete UI, and recover unattended streaming failures without creating a reboot loop.

## Decisions

- Compute horizon from the gravity vector projected into display coordinates. A normal upright landscape camera is valid; only a near-flat phone, where gravity has almost no screen-plane projection, shows the aim-at-court prompt.
- Add English as the default resources plus complete Russian and Ukrainian translations. Provide an in-app `System / English / Русский / Українська` selector because this is a dedicated appliance.
- Keep ISO and shutter as manual-AE controls. When AE is automatic, expose the Camera2 compensation range reported by camera ID 2: -3 EV to +3 EV in 1/6 EV steps.
- Apply saturation, contrast, and gamma as RootEncoder OpenGL filters. This keeps Camera2 AWB/AE independent and guarantees the same processing in the viewfinder and encoded SRT output.
- Treat operator intent separately from process state. `stream_desired=false` after STOP prevents automatic restarts; START and boot provisioning set it true.
- A root watchdog checks a health snapshot containing monotonically increasing sent-frame count and update time. After 90 seconds without forward progress it performs a cold app restart, not only a service restart.
- Count consecutive cold-restart failures. After five failures, allow one device reboot, then suppress further reboot attempts for at least 30 minutes and until a stable stream resets the failure state. This prevents boot loops.
- A user-space watchdog cannot repair a kernel-level freeze. The Magisk loop covers an alive Android/root shell with a dead or stuck camera application; a true hard freeze still requires external power control.

## Lifecycle fix

The physical-device test reproduced a state in which the foreground service remained present while MediaMTX repeatedly rejected reconnects. A full process stop followed by a visible Activity start recovered a stable 1920x1080 H.264 stream with zero inbound-frame errors. Recovery must therefore kill the stale app process, visibly resume the Activity to satisfy Android 14 camera foreground-service rules, and then start the service.

Preview attachment and detachment must not recreate or stop encoders. The service owns one long-lived RootEncoder GL graph; Activity surfaces are attached and detached as preview outputs only.

## Acceptance gates

- Landscape level reports green 0 degrees; face-up/face-down reports the translated aim-at-court prompt.
- All text is available in English, Russian, and Ukrainian; selection survives restart.
- AE compensation, saturation, contrast, and gamma survive app and phone restart.
- Filter changes are visible in both local preview and an extracted HLS/SRT frame.
- Backgrounding and reopening the Activity does not interrupt SRT.
- Network loss reconnects; stale encoder progress triggers cold restart; five consecutive failed recoveries allow one guarded reboot.
- STOP remains stopped and is never undone by the watchdog.
