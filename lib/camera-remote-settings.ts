// Remote Camera Settings — чистая логика желаемого конфига (plan
// 2026-09-02 remote-camera-settings). Без I/O, покрыта тестами.
//
// Ключи camera_* зеркалят CameraSettingsCodec агента (APK): то, что агент
// encode-ит, то сервер и хранит/отправляет. Синхронизация — монотонные
// счётчики (никаких часов): settings_version инкрементирует сервер,
// local_seq — телефон при локальном сохранении.

export interface DesiredCameraPatch {
  [key: string]: unknown
}

export interface DesiredStreamPatch {
  resolution?: string
  courtCode?: string
  /** Точный id камеры устройства ("auto" | "0".."N") — смена рестартит стрим. */
  cameraId?: string
}

export interface DesiredSettings {
  camera?: DesiredCameraPatch
  stream?: DesiredStreamPatch
}

const EXPOSURE_MODES = new Set(["auto", "manualShutter", "manualIso", "manual"])
const ANTIBANDING_MODES = new Set(["off", "50hz", "60hz", "auto"])
const PROC_PROFILES = new Set(["standard", "highlight", "oplus"])

/** id камеры: "auto" или точный id устройства (1–2 цифры). */
const CAMERA_ID_RE = /^(auto|[0-9]{1,2})$/

/** Whitelist + типы + клампинг camera-ключей (зеркало CameraSettingsCodec). */
const CAMERA_RULES: Record<string, {
  type: "boolean" | "int" | "long" | "float" | "string"
  min?: number
  max?: number
  allowed?: Set<string>
}> = {
  camera_exposure_mode: { type: "string", allowed: EXPOSURE_MODES },
  camera_antibanding: { type: "string", allowed: ANTIBANDING_MODES },
  camera_exposure_compensation_steps: { type: "int", min: -24, max: 24 },
  camera_iso: { type: "int", min: 50, max: 102_400 },
  camera_exposure_ns: { type: "long", min: 1_000_000, max: 1_000_000_000 },
  camera_auto_focus: { type: "boolean" },
  camera_focus_diopters: { type: "float", min: 0, max: 30 },
  camera_auto_white_balance: { type: "boolean" },
  camera_white_balance_kelvin: { type: "int", min: 2_000, max: 10_000 },
  camera_white_balance_anchor_kelvin: { type: "int", min: 2_000, max: 10_000 },
  camera_white_balance_anchor_red: { type: "float", min: 1, max: 8 },
  camera_white_balance_anchor_green_even: { type: "float", min: 1, max: 8 },
  camera_white_balance_anchor_green_odd: { type: "float", min: 1, max: 8 },
  camera_white_balance_anchor_blue: { type: "float", min: 1, max: 8 },
  camera_saturation: { type: "float", min: -1, max: 1 },
  camera_contrast: { type: "float", min: 0.5, max: 2 },
  camera_gamma: { type: "float", min: 0.5, max: 2 },
  camera_meter_interval_sec: { type: "int", min: 1, max: 60 },
  camera_iso_ramp_ev_per_sec: { type: "float", min: 0.1, max: 2 },
  camera_zoom_ratio: { type: "float", min: 0.5, max: 10 },
  camera_proc_profile: { type: "string", allowed: PROC_PROFILES },
}

const RESOLUTION_RE = /^(\d{3,5})x(\d{3,5})$/
const COURT_CODE_RE = /^[A-Za-z0-9_-]{3,20}$/

/** Оставляет только известные ключи, проверяет типы, клампит диапазоны. */
export function sanitizeCameraPatch(input: unknown): DesiredCameraPatch {
  if (typeof input !== "object" || input === null) return {}
  const out: DesiredCameraPatch = {}
  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    const rule = CAMERA_RULES[key]
    if (!rule) continue // мусорные ключи отбрасываем
    switch (rule.type) {
      case "boolean":
        if (typeof raw === "boolean") out[key] = raw
        break
      case "int":
      case "long":
        if (typeof raw === "number" && Number.isFinite(raw)) {
          out[key] = Math.round(Math.min(Math.max(raw, rule.min ?? -Infinity), rule.max ?? Infinity))
        }
        break
      case "float":
        if (typeof raw === "number" && Number.isFinite(raw)) {
          out[key] = Math.min(Math.max(raw, rule.min ?? -Infinity), rule.max ?? Infinity)
        }
        break
      case "string": {
        const allowed = rule.allowed
        if (allowed && typeof raw === "string" && allowed.has(raw)) out[key] = raw
        break
      }
    }
  }
  return out
}

/** stream-патч: разрешение чёткое WxH, court-код по формату агента. */
export function sanitizeStreamPatch(input: unknown): DesiredStreamPatch {
  if (typeof input !== "object" || input === null) return {}
  const raw = input as Record<string, unknown>
  const out: DesiredStreamPatch = {}
  if (typeof raw.resolution === "string") {
    const m = RESOLUTION_RE.exec(raw.resolution)
    if (m && Number(m[1]) % 2 === 0 && Number(m[2]) % 2 === 0) out.resolution = raw.resolution
  }
  if (typeof raw.courtCode === "string" && COURT_CODE_RE.test(raw.courtCode)) {
    out.courtCode = raw.courtCode
  }
  if (typeof raw.cameraId === "string" && CAMERA_ID_RE.test(raw.cameraId)) {
    out.cameraId = raw.cameraId
  }
  return out
}

/** MERGE патча в текущий desired (PUT — частичное обновление). */
export function mergeDesired(current: DesiredSettings, patch: DesiredSettings): DesiredSettings {
  return {
    camera: { ...(current.camera ?? {}), ...(patch.camera ?? {}) },
    stream: { ...(current.stream ?? {}), ...(patch.stream ?? {}) },
  }
}

// ─── Синхронизация (heartbeat) ──────────────────────────────────────────────

export interface ServerSyncState {
  settingsVersion: number
  ackedLocalSeq: number
  desired: DesiredSettings
}

export interface DeviceSyncState {
  /** applied_version телефона; 0 — никогда не применял. */
  settingsVersion: number
  /** settings_local_seq телефона; 0 — локально не менял. */
  localSeq: number
  /** Полный конфиг камеры (для adopt; доверяем — ключ устройства = stream_key). */
  settings?: DesiredCameraPatch
}

export type SyncDecision =
  | { action: "none" }
  | { action: "push"; version: number; desired: DesiredSettings }
  | { action: "adopt"; version: number; desired: DesiredSettings; ackedLocalSeq: number }

/**
 * Решение по heartbeat (план, протокол «Синхронизация правок»):
 *  localSeq > acked — телефон менял локально → adopt его конфига как desired
 *    (version+1, acked=localSeq) и отдаём обратно (телефон применит hash-эхо
 *    без изменений и зафиксирует версию);
 *  applied < version — обычный push;
 *  иначе — синхронизированы.
 */
export function resolveSettingsSync(server: ServerSyncState, device: DeviceSyncState): SyncDecision {
  if (device.localSeq > server.ackedLocalSeq && device.settings && Object.keys(device.settings).length > 0) {
    return {
      action: "adopt",
      version: server.settingsVersion + 1,
      desired: { camera: device.settings, stream: server.desired.stream },
      ackedLocalSeq: device.localSeq,
    }
  }
  if (device.settingsVersion < server.settingsVersion) {
    return { action: "push", version: server.settingsVersion, desired: server.desired }
  }
  return { action: "none" }
}
