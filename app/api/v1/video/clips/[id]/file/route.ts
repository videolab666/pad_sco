// GET /api/v1/video/clips/{id}/file[?variant=thumb] — публичная выдача
// ГОТОВОГО клипа/миниатюры (§146: PWA/плеер). Путь собирается из id —
// клиент пути не передаёт (защита от traversal); файлы только из clips-каталога.

import { NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import { join, isAbsolute } from "node:path"
import { getClip } from "@/lib/clip-registry"

const CLIPS_DIR = process.env.CLIPS_DIR ?? "video/clips"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "bad_id" }, { status: 400 })
  }

  const clip = await getClip(id)
  if (!clip || clip.status !== "ready") {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const url = new URL(_request.url)
  const isThumb = url.searchParams.get("variant") === "thumb"
  const fileName = isThumb ? clip.thumbName : clip.fileName
  if (!fileName || isAbsolute(fileName) || fileName.includes("..")) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  try {
    const data = await readFile(join(process.cwd(), CLIPS_DIR, fileName))
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": isThumb ? "image/jpeg" : "video/mp4",
        "Content-Length": String(data.length),
        // Готовый клип неизменен — кэшируем агрессивно
        "Cache-Control": "public, max-age=86400, immutable",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch {
    return NextResponse.json({ error: "file_missing" }, { status: 410 })
  }
}
