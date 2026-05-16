import { type NextRequest, NextResponse } from "next/server"
import { DY_BASE, DY_ALLOWED_HOST } from "@/lib/dy/dy-config"

// Server-side proxy for double-yellow.be feeds: bypasses CORS, caches, validates host.

const cache = new Map<string, { at: number; body: string }>()
const TTL_MS = 5 * 60 * 1000 // 5 minutes

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url")
  const path = req.nextUrl.searchParams.get("path")
  let target = raw ?? (path ? `${DY_BASE}/${path.replace(/^\//, "")}` : null)
  if (!target) return NextResponse.json({ error: "no url" }, { status: 400 })

  // build relative feed paths against the base (like prefixWithBaseIfRequired in Android)
  if (!/^https?:\/\//.test(target)) target = `${DY_BASE}/${target.replace(/^\//, "")}`

  let u: URL
  try {
    u = new URL(target)
  } catch {
    return NextResponse.json({ error: "bad url" }, { status: 400 })
  }
  if (u.hostname !== DY_ALLOWED_HOST) {
    // SSRF protection
    return NextResponse.json({ error: "host not allowed" }, { status: 403 })
  }

  const hit = cache.get(u.href)
  if (hit && Date.now() - hit.at < TTL_MS) {
    return new NextResponse(hit.body, { headers: { "content-type": "application/json" } })
  }

  const ctrl = new AbortController()
  const tm = setTimeout(() => ctrl.abort(), 15000)
  try {
    const r = await fetch(u.href, { signal: ctrl.signal })
    const text = await r.text()
    if (!r.ok) return NextResponse.json({ error: `upstream ${r.status}` }, { status: 502 })
    // light validation: not an HTML error page
    if (/^\s*<(?:!doctype|html)/i.test(text) || text.includes("Undefined index")) {
      return NextResponse.json({ error: "bad upstream content" }, { status: 502 })
    }
    cache.set(u.href, { at: Date.now(), body: text })
    return new NextResponse(text, { headers: { "content-type": "application/json" } })
  } catch {
    return NextResponse.json({ error: "fetch failed/timeout" }, { status: 504 })
  } finally {
    clearTimeout(tm)
  }
}
