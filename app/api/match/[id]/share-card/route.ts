// GET /api/match/{id}/share-card?format=svg|wide|square — share-карточка (§45).
//
// SVG отдаётся напрямую (браузер рендерит); PNG — клиент конвертирует
// через canvas. Два размера: wide (1200×630, OG/Telegram) и square (1080×1080, Instagram).

import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"
import { matchFromRow } from "@/lib/match-supabase"
import { generateShareCardSvg } from "@/lib/share-card"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url = new URL(request.url)
  const size = url.searchParams.get("format") === "square" ? "square" : "wide"

  try {
    const supabase = createServerSupabaseClient()
    const { data: row, error } = await supabase
      .from("matches")
      .select("*")
      .eq("id", id)
      .single()

    if (error || !row) {
      return NextResponse.json({ error: "match_not_found" }, { status: 404 })
    }

    const match = matchFromRow(row)

    // Составы
    const teamA = match?.teamA?.players?.map((p: { name: string }) => p.name).join(" / ") ?? "Team A"
    const teamB = match?.teamB?.players?.map((p: { name: string }) => p.name).join(" / ") ?? "Team B"

    // Счёт сетов
    const sets = (match?.score?.sets ?? [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((s: any) => `${s.teamA}:${s.teamB}`)
      .join(" ")

    // Длительность
    const startedAt = match?.timing?.matchStartedAt
      ? Date.parse(match.timing.matchStartedAt)
      : Date.parse(match?.createdAt ?? "")
    const durationMs = startedAt ? Date.now() - startedAt : 0
    const duration = durationMs > 0
      ? durationMs >= 3600_000
        ? `${Math.floor(durationMs / 3600_000)}ч ${Math.floor((durationMs % 3600_000) / 60_000)}м`
        : `${Math.floor(durationMs / 60_000)}м`
      : ""

    // Корт
    let court = ""
    if (match?.courtId) {
      const { data: courtRow } = await supabase
        .from("courts")
        .select("name")
        .eq("id", match.courtId)
        .single()
      court = courtRow?.name ?? ""
    } else if (match?.courtNumber) {
      court = `Корт ${match.courtNumber}`
    }

    const svg = generateShareCardSvg(
      {
        clubName: "Padel Club",
        teamA,
        teamB,
        score: sets || "—",
        winner: match?.winner === "teamA" ? "A" : match?.winner === "teamB" ? "B" : null,
        court: court || "",
        duration,
        date: new Date(match?.createdAt ?? "").toLocaleDateString("ru-RU", {
          day: "numeric", month: "long", year: "numeric",
        }),
      },
      size,
    )

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: "share_card_failed", message: (error as Error).message },
      { status: 500 },
    )
  }
}
