import { NextResponse } from "next/server"
import { getMatchFromServer } from "@/lib/server-match-storage"
import { getImportantPoint, isGamePoint, isSetPoint, isMatchPoint } from "@/lib/scoring-logic"
import { getSetsToWin as getConfiguredSetsToWin } from "@/lib/match-format-rules"
import { logEvent } from "@/lib/error-logger"
import { getTennisPointName } from "@/lib/tennis-utils"
import { createServerSupabaseClient } from "@/lib/supabase"

// getPointIndex, isGamePoint, isSetPoint, isMatchPoint, getImportantPoint
// → removed, now imported from @/lib/scoring-logic

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getTotalSets = (match: any) => {
  // Проверяем различные возможные пути к данным о формате матча
  if (match.format && typeof match.format === "object") {
    // Прямое указание общего количества сетов
    if (typeof match.format.totalSets === "number") {
      return match.format.totalSets
    }
    if (typeof match.format.sets === "number") {
      return match.format.sets
    }
    // Формат "best of X sets"
    if (typeof match.format.bestOf === "number") {
      return match.format.bestOf
    }
  }

  // Проверяем настройки матча
  if (match.settings && typeof match.settings === "object") {
    // Прямое указание общего количества сетов
    if (typeof match.settings.totalSets === "number") {
      return match.settings.totalSets
    }
    if (typeof match.settings.sets === "number") {
      return match.settings.sets
    }
    // Формат "best of X sets"
    if (typeof match.settings.bestOf === "number") {
      return match.settings.bestOf
    }
  }

  // По умолчанию 3 сета
  return 3
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getSetsToWin = (match: any) => {
  // Проверяем различные возможные пути к данным о формате матча
  if (match.format && typeof match.format === "object") {
    // Прямое указание количества сетов для победы
    if (typeof match.format.setsToWin === "number") {
      return match.format.setsToWin
    }
  }

  // Проверяем настройки матча
  if (match.settings && typeof match.settings === "object") {
    // Прямое указание количества сетов для победы
    if (typeof match.settings.setsToWin === "number") {
      return match.settings.setsToWin
    }
  }

  // Вычисляем на основе общего количества сетов
  return getConfiguredSetsToWin({ ...match.settings, sets: getTotalSets(match) })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getCurrentSetNumber = (match: any) => {
  if (!match || !match.score) {
    return 1
  }

  // Если матч завершен, возвращаем последний сыгранный сет
  if (match.isCompleted) {
    return match.score.sets ? match.score.sets.length : 1
  }

  // Если есть массив сетов, текущий сет = количество завершенных сетов + 1
  if (match.score.sets && Array.isArray(match.score.sets)) {
    return match.score.sets.length + 1
  }

  // По умолчанию первый сет
  return 1
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const matchId = resolvedParams.id

    if (!matchId) {
      return NextResponse.json({ error: "Match ID is required" }, { status: 400 })
    }

    // Логируем запрос к API
    logEvent("info", `Match API: запрос данных матча: ${matchId}`, "match-api")

    // Пытаемся получить матч с несколькими попытками
    let match = null
    let attempts = 0
    const maxAttempts = 3

    while (!match && attempts < maxAttempts) {
      attempts++
      try {
        match = await getMatchFromServer(matchId)
        if (match) break
      } catch (retryError) {
        logEvent("warn", `Попытка ${attempts} получения матча не удалась`, "match-api", retryError)
        // Небольшая задержка перед следующей попыткой
        if (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }
    }

    if (!match) {
      logEvent("error", `Матч не найден после ${attempts} попыток: ${matchId}`, "match-api")
      return NextResponse.json({ error: "Match not found" }, { status: 404 })
    }

    // Логируем структуру матча для отладки
    logEvent("debug", `Match API: структура матча`, "match-api", {
      matchId: match.id,
      format: match.format,
      settings: match.settings,
    })

    // Получаем текущие сеты для обеих команд
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teamASets = match.score.sets ? match.score.sets.map((set: any) => set.teamA) : []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teamBSets = match.score.sets ? match.score.sets.map((set: any) => set.teamB) : []

    // Определяем информацию о победителе
    let winnerTeamName = ""
    let winnerName1 = ""
    let winnerName2 = ""

    if (match.isCompleted && match.winner) {
      if (match.winner === "teamA") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        winnerTeamName = match.teamA.players.map((p: any) => p.name).join(" / ")
        winnerName1 = match.teamA.players[0]?.name || ""
        winnerName2 = match.teamA.players[1]?.name || ""
      } else if (match.winner === "teamB") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        winnerTeamName = match.teamB.players.map((p: any) => p.name).join(" / ")
        winnerName1 = match.teamB.players[0]?.name || ""
        winnerName2 = match.teamB.players[1]?.name || ""
      }
    }

    // Получаем информацию о важном моменте
    const importantPoint = getImportantPoint(match)

    // Определяем общее количество сетов и сетов для победы
    const totalSets = getTotalSets(match)
    const setsToWin = getSetsToWin(match)
    const currentSetNumber = getCurrentSetNumber(match)

    // Логируем определенные значения для отладки
    logEvent("debug", `Match API: определены параметры матча`, "match-api", {
      totalSets,
      setsToWin,
      currentSetNumber,
      completedSets: match.score.sets ? match.score.sets.length : 0,
    })

    // Формируем объект данных в том же формате, что и для API корта
    const flatMatchData = {
      match_id: match.id,
      court_number: match.courtNumber || 0,

      // Данные команды A
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      teamA_name: match.teamA.players.map((p: any) => p.name).join(" / "),
      teamA_player1_name: match.teamA.players[0]?.name || "",
      teamA_player2_name: match.teamA.players[1]?.name || "",
      teamA_score: match.score.teamA,
      teamA_game_score: match.score.currentSet
        ? match.score.currentSet.isTiebreak
          ? match.score.currentSet.currentGame.teamA
          : getTennisPointName(match.score.currentSet.currentGame.teamA)
        : "0",
      teamA_current_set: match.score.currentSet ? match.score.currentSet.teamA : 0,
      teamA_serving: match.currentServer && match.currentServer.team === "teamA" ? "True" : "False",

      // Данные команды B
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      teamB_name: match.teamB.players.map((p: any) => p.name).join(" / "),
      teamB_player1_name: match.teamB.players[0]?.name || "",
      teamB_player2_name: match.teamB.players[1]?.name || "",
      teamB_score: match.score.teamB,
      teamB_game_score: match.score.currentSet
        ? match.score.currentSet.isTiebreak
          ? match.score.currentSet.currentGame.teamB
          : getTennisPointName(match.score.currentSet.currentGame.teamB)
        : "0",
      teamB_current_set: match.score.currentSet ? match.score.currentSet.teamB : 0,
      teamB_serving: match.currentServer && match.currentServer.team === "teamB" ? "True" : "False",

      // Общие данные матча
      is_tiebreak: match.score.currentSet ? (match.score.currentSet.isTiebreak ? "True" : "False") : "False",
      is_completed: match.isCompleted ? "True" : "False",
      winner: match.winner || "",
      total_sets: totalSets,
      sets_to_win: setsToWin,
      current_set_number: currentSetNumber,

      // Информация о победителе
      winner_team_name: winnerTeamName,
      winner_name1: winnerName1,
      winner_name2: winnerName2,

      // Информация о важном моменте
      important_point_type: importantPoint.type || "",
      important_point_team: importantPoint.team || "",
      is_match_point: isMatchPoint(match) ? "True" : "False",
      is_set_point: isSetPoint(match) ? "True" : "False",
      is_game_point: isGamePoint(match) ? "True" : "False",

      // Служебная информация
      timestamp: new Date().toISOString(),
      update_time: new Date().toLocaleTimeString(),
    }

    // Динамически добавляем данные о сетах в зависимости от настроек матча
    // Гарантируем, что будет как минимум 5 сетов для совместимости с vMix
    const maxSets = Math.max(5, totalSets)
    for (let i = 0; i < maxSets; i++) {
      ; (flatMatchData as any)[`teamA_set${i + 1}`] = teamASets[i] !== undefined ? teamASets[i] : ""
        ; (flatMatchData as any)[`teamB_set${i + 1}`] = teamBSets[i] !== undefined ? teamBSets[i] : ""
    }

    // Устанавливаем заголовки для предотвращения кэширования
    const headers = new Headers()
    headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    headers.set("Pragma", "no-cache")
    headers.set("Expires", "0")
    headers.set("Surrogate-Control", "no-store")
    headers.set("Access-Control-Allow-Origin", "*")
    headers.set("Access-Control-Allow-Methods", "GET")
    headers.set("Access-Control-Allow-Headers", "Content-Type")

    // Возвращаем данные матча в том же формате, что и API корта
    return new NextResponse(JSON.stringify([flatMatchData]), {
      status: 200,
      headers: headers,
    })
  } catch (error: any) {
    logEvent("error", "Ошибка при обработке API запроса", "match-api", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ─── Idempotent, revisioned match write (Task 2, Step 3) ───────────────────────

// Snapshot (camelCase) → Supabase row (snake_case).
const toMatchRow = (match: any): Record<string, any> => ({
  id: match.id,
  type: match.type,
  format: match.format,
  created_at: match.createdAt,
  settings: match.settings,
  team_a: match.teamA,
  team_b: match.teamB,
  score: match.score,
  current_server: match.currentServer,
  court_sides: match.courtSides,
  should_change_sides: match.shouldChangeSides,
  is_completed: match.isCompleted,
  winner: match.winner || null,
  court_number: match.courtNumber,
  created_via_court_link: match.created_via_court_link,
})

/**
 * Applies a single match operation idempotently with optimistic concurrency.
 *
 * Body: { operation: { operationId, baseRevision, kind, clientId }, match: <snapshot> }
 *
 *  - A repeated `operationId` returns the stored result (never applied twice).
 *  - A stale `baseRevision` fails fast with 409 and the authoritative snapshot
 *    instead of overwriting newer server data.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params
    const matchId = resolvedParams.id
    if (!matchId) {
      return NextResponse.json({ error: "Match ID is required" }, { status: 400 })
    }

    const body = await request.json().catch(() => null)
    const operation = body?.operation
    const match = body?.match
    if (!operation?.operationId || typeof operation.baseRevision !== "number" || !match?.id) {
      return NextResponse.json({ error: "Invalid operation payload" }, { status: 400 })
    }
    if (match.id !== matchId) {
      return NextResponse.json({ error: "Match id mismatch" }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    // Idempotency: a previously applied operation returns its stored result.
    const existing = await supabase
      .from("match_operations")
      .select("result_revision")
      .eq("operation_id", operation.operationId)
      .maybeSingle()

    if (!existing.error && existing.data) {
      const current = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle()
      return NextResponse.json(
        { status: "ok", idempotent: true, revision: existing.data.result_revision, match: current.data ?? null },
        { status: 200 },
      )
    }

    const resultRevision = operation.baseRevision + 1
    const row = toMatchRow(match)

    // Optimistic-concurrency write: only succeeds when the server is still at
    // the revision the client based this operation on.
    const updated = await supabase
      .from("matches")
      .update({ ...row, revision: resultRevision })
      .eq("id", matchId)
      .eq("revision", operation.baseRevision)
      .select()

    if (updated.error) {
      logEvent("error", `Ошибка revisioned update: ${updated.error.message}`, "match-api")
      return NextResponse.json({ status: "error", error: updated.error.message }, { status: 500 })
    }

    if (updated.data && updated.data.length > 0) {
      await supabase.from("match_operations").insert({
        operation_id: operation.operationId,
        match_id: matchId,
        base_revision: operation.baseRevision,
        result_revision: resultRevision,
        kind: operation.kind || "snapshot",
        client_id: operation.clientId || null,
      })
      return NextResponse.json({ status: "ok", revision: resultRevision, match: updated.data[0] }, { status: 200 })
    }

    // 0 rows updated — inspect the current row to classify the outcome.
    const current = await supabase.from("matches").select("*").eq("id", matchId).maybeSingle()
    if (current.error || !current.data) {
      return NextResponse.json({ status: "conflict", reason: "match_deleted", match: null }, { status: 409 })
    }

    const serverRevision = current.data.revision
    if (serverRevision === null || serverRevision === undefined) {
      // Legacy row without a revision — adopt it.
      const adopt = await supabase
        .from("matches")
        .update({ ...row, revision: resultRevision })
        .eq("id", matchId)
        .select()
      await supabase.from("match_operations").insert({
        operation_id: operation.operationId,
        match_id: matchId,
        base_revision: operation.baseRevision,
        result_revision: resultRevision,
        kind: operation.kind || "snapshot",
        client_id: operation.clientId || null,
      })
      return NextResponse.json(
        { status: "ok", revision: resultRevision, match: adopt.data?.[0] ?? current.data },
        { status: 200 },
      )
    }

    // Genuine conflict — return the authoritative snapshot, never overwrite it.
    return NextResponse.json(
      { status: "conflict", reason: `server_ahead (server=${serverRevision})`, revision: serverRevision, match: current.data },
      { status: 409 },
    )
  } catch (error) {
    logEvent("error", "Ошибка при идемпотентной записи матча", "match-api", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
