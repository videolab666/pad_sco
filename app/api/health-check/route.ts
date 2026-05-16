import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase"

export async function GET() {
  try {
    const supabase = createServerSupabaseClient()

    const { error } = await supabase.from("matches").select("id").limit(1)

    if (error) throw error

    return NextResponse.json({ status: "ok", database: "connected", timestamp: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json(
      { status: "error", message: err instanceof Error ? err.message : "Unknown error", timestamp: new Date().toISOString() },
      { status: 500 },
    )
  }
}
