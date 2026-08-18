// GET /api/v1/video/reels/{id}/file[?variant=thumb] — публичная выдача
// ГОТОВОГО highlight-reel (§144). Как и с клипами: путь собирает роут из id.

import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import { join, isAbsolute } from "node:path"
import { getReel } from "@/lib/reel-registry"

const CLIPS_DIR = process.env.CLIPS_DIR ?? "video/clips"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 })
  }

  const reel = await getReel(id)
  if (!reel || reel.status !== "ready") {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const url = new URL(_request.url)
  const isThumb = url.searchParams.get("variant") === "thumb"
  const fileName = isThumb ? reel.thumbName : reel.fileName
  if (!fileName || isAbsolute(fileName) || fileName.includes("..")) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  try {
    const data = await readFile(join(process.cwd(), CLIPS_DIR, fileName))
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": isThumb ? "image/jpeg" : "video/mp4",
        "Content-Length": String(data.length),
        "Cache-Control": "public, max-age=86400, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch {
    return NextResponse.json({ error: "file_missing" }, { status: 410 })
  }
}
