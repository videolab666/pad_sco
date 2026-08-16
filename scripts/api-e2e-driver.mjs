// End-to-end driver for the remote-control API (POST /api/match/[id]/command).
//
// Creates a temporary match directly in Supabase, runs every command plus the
// error / idempotency / conflict paths against a running dev server, verifies
// the public JSON stays consistent, then deletes the temp match.
//
// Usage:  node scripts/api-e2e-driver.mjs   (server must be running on :3000)

import { readFileSync } from "node:fs"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)

const env = {}
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "")
}

const BASE = process.env.BASE_URL ?? "http://localhost:3000"
const KEY = env.SCOREBOARD_API_KEY
const { createClient } = require("@supabase/supabase-js")
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const TEMP_ID = "bbbb0000-0000-4000-8000-000000000001"

let passed = 0
let failed = 0
const ok = (name, cond, extra = "") => {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.log(`  ✗ ${name} ${extra}`)
  }
}

async function cmd(command, args, operationId) {
  const r = await fetch(`${BASE}/api/match/${TEMP_ID}/command`, {
    method: "POST",
    headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ operationId, command, args }),
  })
  return { status: r.status, body: await r.json().catch(() => null) }
}

const game = (b) => b?.match?.score?.currentSet?.currentGame ?? b?.score?.currentSet?.currentGame
const set = (b) => b?.match?.score?.currentSet ?? b?.score?.currentSet
const sets = (b) => b?.match?.score?.sets ?? b?.score?.sets

async function scoreboardJson() {
  const r = await fetch(`${BASE}/api/match/${TEMP_ID}`)
  const arr = await r.json()
  return Array.isArray(arr) ? arr[0] : null
}

async function dbRevision() {
  const r = await sb.from("matches").select("revision").eq("id", TEMP_ID).maybeSingle()
  return r.data?.revision ?? 0
}

async function postBatch(commands, operationId) {
  const r = await fetch(`${BASE}/api/match/${TEMP_ID}/commands`, {
    method: "POST",
    headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ operationId, commands }),
  })
  return { status: r.status, body: await r.json().catch(() => null) }
}

async function main() {
  console.log("== Setup: temporary match ==")
  await sb.from("matches").delete().eq("id", TEMP_ID)
  await sb.from("match_operations").delete().eq("match_id", TEMP_ID)
  const ins = await sb.from("matches").insert({
    id: TEMP_ID,
    type: "padel",
    format: "doubles",
    is_completed: false,
    revision: 0,
    settings: {
      sets: 3,
      scoringSystem: "classic",
      goldenPointFormat: "none",
      gamesPerSet: 6,
      tiebreakEnabled: true,
      tiebreakAt: "6-6",
    },
    team_a: { name: "A", players: [{ id: "p1", name: "Temp One" }, { id: "p2", name: "Temp Two" }] },
    team_b: { name: "B", players: [{ id: "p3", name: "Temp Three" }, { id: "p4", name: "Temp Four" }] },
    score: {
      teamA: 0,
      teamB: 0,
      sets: [],
      currentSet: { teamA: 0, teamB: 0, games: [], currentGame: { teamA: 0, teamB: 0 }, isTiebreak: false },
    },
    current_server: { team: "teamA", playerIndex: 0 },
    court_sides: { teamA: "left", teamB: "right" },
  })
  if (ins.error) throw new Error("setup failed: " + ins.error.message)
  console.log("  temp match created")

  console.log("== 1. Auth / routing ==")
  {
    const noKey = await fetch(`${BASE}/api/match/${TEMP_ID}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"command":"point"}',
    })
    ok("POST без ключа → 401", noKey.status === 401)
    // ВАЖНО: здесь никаких мутирующих команд на TEMP_ID — сценарий начинается с 0-0.
    const nf = await fetch(`${BASE}/api/match/cccc0000-0000-4000-8000-000000000009/command`, {
      method: "POST",
      headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
      body: '{"command":"point"}',
    })
    ok("несуществующий матч → 404", nf.status === 404, `got ${nf.status}`)
  }

  console.log("== 2. Валидация команд ==")
  {
    const bad = await cmd("explode")
    ok("неизвестная команда → 400 unknown_command", bad.status === 400 && bad.body.code === "unknown_command")
    const badTeam = await cmd("point", { team: "left" })
    ok("point с кривой командой → 400 invalid_args", badTeam.status === 400 && badTeam.body.code === "invalid_args")
    // новый матч: 0 завершённых сетов + живой текущий = ровно 1 строка
    const badRows = await cmd("set-set-scores", { rows: [{ teamA: 6, teamB: 4 }, { teamA: 0, teamB: 0 }] })
    ok("set-set-scores неверной длины → 400", badRows.status === 400 && badRows.body.code === "invalid_args")
  }

  console.log("== 3. point / undo-point ==")
  {
    let r = await cmd("point", { team: "teamA" }, "e2e-p1")
    ok("point → 15-0", JSON.stringify(game(r.body)) === JSON.stringify({ teamA: 15, teamB: 0 }),
      `http=${r.status} game=${JSON.stringify(game(r.body))} body=${r.body?.error ?? ""}`)
    for (let i = 0; i < 3; i++) await cmd("point", { team: "teamA" })
    let s = set((await lastState()))
    ok("4 очка → гейм взят (сет 1-0)", s.teamA === 1 && s.teamB === 0, `set=${s.teamA}:${s.teamB}`)

    r = await cmd("undo-point")
    ok("undo-point → гейм откат (сет 0-0, 40-0)", set(r.body).teamA === 0 && game(r.body).teamA === 40)

    const repeat = await cmd("point", { team: "teamA" }, "e2e-p1")
    ok("повтор operationId → idempotent, счёт не тронут", repeat.body.idempotent === true && game(repeat.body).teamA === 40)
  }

  console.log("== 4. adjust-game / adjust-set / set-server ==")
  {
    let r = await cmd("adjust-game", { teamA: "Ad", teamB: 3 })
    ok("adjust-game → Ad-40", game(r.body).teamA === "Ad" && game(r.body).teamB === 40)
    r = await cmd("undo-point")
    ok("undo-point снимает adjust-game", game(r.body).teamA === 40 && game(r.body).teamB === 0)

    r = await cmd("adjust-set", { teamA: 5, teamB: 5 })
    ok("adjust-set → 5-5", set(r.body).teamA === 5 && set(r.body).teamB === 5)

    r = await cmd("set-server", { team: "teamB", playerIndex: 1 })
    ok("set-server → B/п1", JSON.stringify(r.body.match.currentServer) === JSON.stringify({ team: "teamB", playerIndex: 1 }))
    r = await cmd("undo-point")
    ok("undo-point возвращает подающего", r.body.match.currentServer.team === "teamA")
  }

  console.log("== 5. Сет, правка сетов, переигрывание ==")
  {
    // currentGame после adjust-set остаётся 40-0 — сбросим; сет 5-5 закрываем
    // двумя геймами (6-5, 7-5) — по 4 очка каждый.
    await cmd("adjust-game", { teamA: 0, teamB: 0 })
    for (let g = 0; g < 2; g++) for (let p = 0; p < 4; p++) await cmd("point", { team: "teamA" })
    let st = sets(await lastState())
    ok("7-5 → сет записан {7,5, teamA}", st.length === 1 && st[0].teamA === 7 && st[0].winner === "teamA")

    let r = await cmd("set-set-scores", { rows: [{ teamA: 6, teamB: 4 }, { teamA: 0, teamB: 0 }] })
    ok("set-set-scores правит сет на 6-4", sets(r.body)[0].teamA === 6 && sets(r.body)[0].winner === "teamA")

    r = await cmd("reopen-set", { setIndex: 0, score: { teamA: 6, teamB: 6 } })
    ok("reopen-set 6-6 → сет текущий, тай-брейк", sets(r.body).length === 0 && set(r.body).isTiebreak === true)
    const json = await scoreboardJson()
    ok("JSON: is_tiebreak=true, сет 6-6", json?.is_tiebreak === 'True' && json?.teamA_current_set === 6)

    r = await cmd("undo-point") // снимает reopen-set
    ok("undo-point отменяет переигрывание", sets(r.body).length === 1 && sets(r.body)[0].teamA === 6)

    r = await cmd("undo-set")
    ok("undo-set → сет снова в игре", sets(r.body).length === 0 && set(r.body).teamA >= 5,
      `sets=${sets(r.body).length}, teamA=${set(r.body)?.teamA}`)
  }

  console.log("== 6. set-players ==")
  {
    const r = await cmd("set-players", {
      teamB: { name: "Dream Team", players: ["Temp Three", "New Star"] },
    })
    const names = r.body.match.teamB.players.map((p) => p.name)
    ok("set-players заменил состав", names.join(",") === "Temp Three,New Star")
    ok("set-players сохранил id по имени", r.body.match.teamB.players[0].id === "p3")
    ok("set-players задал имя команды", r.body.match.teamB.name === "Dream Team")
  }

  console.log("== 7. end-match / unlock-match ==")
  {
    await cmd("adjust-set", { teamA: 0, teamB: 0 })
    let r = await cmd("end-match", { reason: "time-up", winner: "teamA" })
    ok("end-match → завершён, победитель A", r.body.match.isCompleted === true && r.body.match.winner === "teamA")
    const json = await scoreboardJson()
    ok("JSON: is_completed=true, winner=teamA", json?.is_completed === "True" && json?.winner === "teamA",
      `json=${JSON.stringify({ c: json?.is_completed, w: json?.winner })}`)

    r = await cmd("point", { team: "teamA" })
    ok("point на завершённом → 400 match_completed", r.status === 400 && r.body.code === "match_completed")

    r = await cmd("unlock-match")
    ok("unlock-match → снова в игре", r.body.match.isCompleted === false && r.body.match.winner === null)
    r = await cmd("unlock-match")
    ok("unlock на живом → 400 not_completed", r.status === 400 && r.body.code === "not_completed")
  }

  console.log("== 8. Параллельная запись (ревизии) ==")
  {
    const results = await Promise.all([
      cmd("point", { team: "teamA" }, "par-1"),
      cmd("point", { team: "teamA" }, "par-2"),
      cmd("point", { team: "teamA" }, "par-3"),
    ])
    const oks = results.filter((r) => r.status === 200).length
    const conflicts = results.filter((r) => r.status === 409).length
    ok("параллельные 3 команды: каждая 200 или 409 (без 500)", results.every((r) => r.status === 200 || r.status === 409),
      JSON.stringify(results.map((r) => r.status)))
    console.log(`    (ok=${oks}, conflict=${conflicts} — конфликтующему драйверу нужно просто повторить)`)
    // финальное состояние согласовано
    const json = await scoreboardJson()
    const st = await lastState()
    ok("JSON и стейт согласованы после гонки", json?.teamA_current_set === st.score.currentSet.teamA)
  }

  console.log("== 9. set-rules / toss / assign-court (фаза 2) ==")
  {
    let r = await cmd("set-rules", { rules: { goldenGame: true, tiebreakLength: 9 } })
    ok(
      "set-rules применил патч",
      r.body.match?.settings?.goldenGame === true && r.body.match?.settings?.tiebreakLength === 9,
      `golden=${r.body.match?.settings?.goldenGame} tbLen=${r.body.match?.settings?.tiebreakLength}`,
    )
    ok("set-rules журнализирован с настройками", r.body.match?.events?.at(-1)?.payload?.action === "rule-change")
    const bad = await cmd("set-rules", { rules: { nonsense: 1 } })
    ok("set-rules с неизвестным ключом → 400", bad.status === 400 && bad.body.code === "invalid_args")

    r = await cmd("toss", { winner: "teamB", choice: "receive", teamOnLeft: "teamB" })
    ok(
      "toss: принял — подаёт teamA, teamB слева",
      r.body.match?.currentServer?.team === "teamA" && r.body.match?.courtSides?.teamB === "left",
    )

    r = await cmd("assign-court", { court: 7 })
    ok("assign-court → корт 7", r.body.match?.courtNumber === 7)
    r = await cmd("assign-court", { court: null })
    ok("assign-court null → без корта", r.body.match?.courtNumber === null || r.body.match?.courtNumber === undefined)
  }

  console.log("== 10. batch (атомарно, одной ревизией) ==")
  {
    const revBefore = await dbRevision()
    const r = await postBatch(
      [
        { command: "adjust-set", args: { teamA: 2, teamB: 1 } },
        { command: "adjust-game", args: { teamA: 0, teamB: 0 } },
        { command: "point", args: { team: "teamB" } },
      ],
      "e2e-batch-1",
    )
    ok("batch: 200, применено 3 команды", r.status === 200 && r.body.applied === 3 && r.body.status === "ok",
      `http=${r.status} body=${JSON.stringify(r.body).slice(0, 120)}`)
    ok("batch: одна ревизия", r.body.revision === revBefore + 1, `rev ${r.body.revision} после ${revBefore}`)
    ok(
      "batch: состояние = результат последовательности",
      r.body.match?.score?.currentSet?.teamA === 2 && r.body.match?.score?.currentSet?.currentGame?.teamB === 15,
    )

    const afterOk = JSON.stringify((await lastState()).score.currentSet)
    const fail = await postBatch([
      { command: "adjust-set", args: { teamA: 0, teamB: 0 } },
      { command: "point", args: { team: "left" } },
    ])
    ok("batch с ошибкой → 400 с индексом", fail.status === 400 && (fail.body.error || "").includes("batch[1]"),
      JSON.stringify(fail.body).slice(0, 140))
    const afterFail = JSON.stringify((await lastState()).score.currentSet)
    ok("batch с ошибкой ничего не изменил", afterFail === afterOk)

    const repeat = await postBatch([{ command: "adjust-set", args: { teamA: 0, teamB: 0 } }], "e2e-batch-1")
    ok("batch: повтор operationId → idempotent", repeat.body.idempotent === true && repeat.body.match?.score?.currentSet?.teamA === 2)
  }

  console.log("== 11. GET /api/matches (каталог для драйвера) ==")
  {
    const r = await fetch(`${BASE}/api/matches?limit=50`)
    const list = await r.json()
    ok("GET /api/matches → 200 массив", r.status === 200 && Array.isArray(list))
    const mine = Array.isArray(list) ? list.find((x) => x.id === TEMP_ID) : null
    ok("временный матч в каталоге с составами", !!mine && mine.teamA?.length === 2 && mine.teamB?.length === 2,
      JSON.stringify(mine)?.slice(0, 140))
    const active = await (await fetch(`${BASE}/api/matches?active=true&limit=100`)).json()
    ok("active=true фильтрует завершённые", Array.isArray(active) && active.every((x) => x.isCompleted === false))
  }

  console.log("== Cleanup ==")
  await sb.from("match_operations").delete().eq("match_id", TEMP_ID)
  await sb.from("matches").delete().eq("id", TEMP_ID)
  const left = await sb.from("matches").select("id").eq("id", TEMP_ID).maybeSingle()
  ok("временный матч удалён", !left.data)

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES"}: ${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

async function lastState() {
  // Точечное чтение через command-endpoint невозможно (он мутирует) — берём из БД.
  const r = await sb.from("matches").select("score").eq("id", TEMP_ID).maybeSingle()
  return r.data ? { score: r.data.score } : { score: null }
}

main().catch((e) => {
  console.error("DRIVER ERROR:", e.message)
  process.exit(1)
})
