import { existsSync, readFileSync, rmSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const statePath = join(root, "logs", "playwright-webserver.json")

export default async function globalTeardown() {
  if (!existsSync(statePath)) return

  const state = JSON.parse(readFileSync(statePath, "utf8"))
  rmSync(statePath, { force: true })

  if (!state.started || !state.pid) return

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(state.pid), "/T", "/F"], { stdio: "ignore" })
  } else {
    try {
      process.kill(-state.pid, "SIGTERM")
    } catch {
      // The server already exited.
    }
  }
}
