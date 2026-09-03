// POST /api/v1/video/heartbeat — heartbeat камеры (§152/§194).
//
// Устройство (Court Camera Agent / симулятор) сообщает stream_key, статус и
// здоровье. stream_key играет роль идентификатора устройства (v1: доступ
// устройства к endpoint ограничен самим ключом; выдача ключей и ротация —
// §101 api_keys позже). Источник создаётся при первом heartbeat —
// zero-friction provisioning (§88).
//
// Канал удалённых настроек (plan 2026-09-02): в payload может лежать
// deviceSettings {version, localSeq, settings, caps}. По протоколу
// resolveSettingsSync: push желаемого конфига отставшей камере или adopt
// локальной правки телефона как нового desired. Ответ:
//   { source, desiredSettings?: { version, camera?, stream? } }

import { type NextRequest, NextResponse } from "next/server"
import { heartbeatSource, VideoValidationError, type VideoSourceStatus } from "@/lib/video-registry"
import { createServerSupabaseClient } from "@/lib/supabase"
import { resolveSettingsSync, type DesiredSettings } from "@/lib/camera-remote-settings"
import { logEvent } from "@/lib/error-logger"

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  try {
    const streamKey = String(body.streamKey ?? "")
    const deviceSettings = (body.deviceSettings as Record<string, unknown>) ?? null

    // Снимок состояния устройства уходит в health — UI настроек по нему
    // считает pending/applied без отдельного запроса к камере
    const health = { ...((body.health as Record<string, unknown>) ?? {}) }
    if (deviceSettings) {
      health.deviceSettings = {
        version: Number(deviceSettings.version ?? 0),
        localSeq: Number(deviceSettings.localSeq ?? 0),
        caps: (deviceSettings.caps as Record<string, unknown>) ?? undefined,
      }
    }

    const source = await heartbeatSource({
      streamKey,
      status: (body.status ?? "online") as VideoSourceStatus,
      name: typeof body.name === "string" ? body.name : undefined,
      health,
    })

    // Протокол синхронизации настроек (desired-state на монотонных счётчиках)
    let desiredSettings: { version: number; camera?: unknown; stream?: unknown } | undefined
    if (deviceSettings) {
      const supabase = createServerSupabaseClient()
      const { data: row } = await supabase
        .from("video_sources")
        .select("desired_settings, settings_version, acked_local_seq")
        .eq("id", source.id)
        .limit(1)
      const current = row?.[0]
      const decision = resolveSettingsSync(
        {
          settingsVersion: Number(current?.settings_version ?? 0),
          ackedLocalSeq: Number(current?.acked_local_seq ?? 0),
          desired: (current?.desired_settings as DesiredSettings) ?? {},
        },
        {
          settingsVersion: Number(deviceSettings.version ?? 0),
          localSeq: Number(deviceSettings.localSeq ?? 0),
          settings: (deviceSettings.settings as Record<string, unknown>) ?? undefined,
        },
      )

      if (decision.action === "adopt") {
        await supabase
          .from("video_sources")
          .update({
            desired_settings: decision.desired,
            settings_version: decision.version,
            acked_local_seq: decision.ackedLocalSeq,
          })
          .eq("id", source.id)
        desiredSettings = { version: decision.version, camera: decision.desired.camera }
        logEvent(
          "info",
          `camera settings: adopt локальной правки ${streamKey} (v${decision.version}, seq ${decision.ackedLocalSeq})`,
          "camera-settings",
        )
      } else if (decision.action === "push") {
        desiredSettings = {
          version: decision.version,
          ...(decision.desired.camera ? { camera: decision.desired.camera } : {}),
          ...(decision.desired.stream ? { stream: decision.desired.stream } : {}),
        }
      }
    }

    return NextResponse.json({
      source: { id: source.id, streamKey: source.streamKey, status: source.status },
      ...(desiredSettings ? { desiredSettings } : {}),
    })
  } catch (err) {
    if (err instanceof VideoValidationError) {
      return NextResponse.json({ error: "validation", message: err.message }, { status: 400 })
    }
    logEvent("error", `video heartbeat: ${(err as Error).message}`, "video-heartbeat", err)
    return NextResponse.json({ error: "heartbeat_failed", message: (err as Error).message }, { status: 500 })
  }
}
