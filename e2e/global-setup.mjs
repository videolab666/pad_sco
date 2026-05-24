import { spawn } from "node:child_process"
import { writeFileSync, mkdirSync } from "node:fs"
import { request } from "node:http"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const statePath = join(root, "logs", "playwright-webserver.json")
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next")
const url = "http://127.0.0.1:3000/"

function isAvailable() {
  return new Promise((resolve) => {
    const req = request(url, { method: "GET", timeout: 1000 }, (res) => {
      res.resume()
      resolve(res.statusCode >= 200 && res.statusCode < 500)
    })
    req.on("timeout", () => {
      req.destroy()
      resolve(false)
    })
    req.on("error", () => resolve(false))
    req.end()
  })
}

async function waitForServer(timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isAvailable()) return
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

export default async function globalSetup() {
  mkdirSync(dirname(statePath), { recursive: true })

  if (await isAvailable()) {
    writeFileSync(statePath, JSON.stringify({ started: false }), "utf8")
    return
  }

  const child = spawn(process.execPath, [nextBin, "dev"], {
    cwd: root,
    detached: true,
    stdio: "ignore",
    env: { ...process.env, BROWSER: "none" },
  })
  child.unref()

  writeFileSync(statePath, JSON.stringify({ started: true, pid: child.pid }), "utf8")
  await waitForServer(120_000)
}
