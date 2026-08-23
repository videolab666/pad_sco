#!/usr/bin/env node
// License gate (plan-4 §205): scans every installed package (via the
// npm-generated node_modules/.package-lock.json) and fails when a package's
// SPDX id is outside the permissive allowlist, unless it is listed — with a
// recorded reason — in LICENSE_EXCEPTIONS below.
//
//   node scripts/check-licenses.mjs
//
// Writes/refreshes third-party-licenses.json next to package.json so the
// manifest always matches the actual dependency tree.

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const ALLOWED = new Set([
  "MIT",
  "MIT-0",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "0BSD",
  "Unlicense",
  "CC0-1.0",
])

// Documented exceptions — plan-4 §205 allows these only with a reason.
// Keep this list SHORT: every entry weakens the permissive-only policy.
const LICENSE_EXCEPTIONS = {
  "@img/sharp-win32-x64":
    "Apache-2.0 AND LGPL-3.0 — native libvips binary pulled in by Next.js image optimization; used unmodified server-side, not distributed as our code (see plan-4 §207/§249)",
  "caniuse-lite":
    "CC-BY-4.0 — browserslist DATA tables, not bundled executable code",
  "lightningcss":
    "MPL-2.0 — dev-only build tool (Tailwind CSS), never shipped to product",
  "lightningcss-win32-x64-msvc":
    "MPL-2.0 — dev-only native binary for lightningcss",
  "lru-cache":
    "BlueOak-1.0.0 — modern permissive MIT-equivalent license; dev-only (toolchain)",
  "@stdlib/math-base-special-erfinv":
    "Apache-2.0 AND BSL-1.0 — dual-licensed under two permissive licenses (openskill.js transitive dep); Boost BSL is MIT-equivalent",
}

const lockPath = join("node_modules", ".package-lock.json")
if (!existsSync(lockPath)) {
  console.error("license-check: node_modules/.package-lock.json not found — run npm install first")
  process.exit(1)
}

const lock = JSON.parse(readFileSync(lockPath, "utf8"))
const entries = Object.entries(lock.packages ?? {}).filter(([p]) => p.startsWith("node_modules/"))

function readLicenseField(pkgPath) {
  const pjPath = join(pkgPath, "package.json")
  if (!existsSync(pjPath)) return null
  let pkg
  try {
    pkg = JSON.parse(readFileSync(pjPath, "utf8"))
  } catch {
    return null
  }
  if (typeof pkg.license === "string") return pkg.license
  if (Array.isArray(pkg.licenses)) {
    return pkg.licenses.map((l) => (typeof l === "string" ? l : l?.type)).filter(Boolean).join(" OR ")
  }
  if (pkg.license && typeof pkg.license === "object" && pkg.license.type) return pkg.license.type
  return null
}

function passesAllowlist(expr) {
  if (!expr) return false
  if (/^SEE LICENSE IN/i.test(expr)) return false
  const ids = expr
    .replace(/[()]/g, "")
    .split(/\s+(?:OR|or|AND)\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  // For OR expressions any allowlisted side is enough; for AND every side
  // must be allowlisted. Splitting naively: treat single ids and OR chains.
  if (ids.length === 1) return ALLOWED.has(ids[0])
  const orSides = expr.replace(/[()]/g, "").split(/\s+(?:OR|or)\s+/)
  if (orSides.length > 1) return orSides.some((side) => ALLOWED.has(side.trim()))
  return ids.every((id) => ALLOWED.has(id))
}

const rows = []
const violations = []

for (const [pkgPath, meta] of entries) {
  if (!meta.version) continue
  const name = pkgPath.replace(/^node_modules\//, "")
  const license = readLicenseField(pkgPath) ?? "(missing)"
  const row = {
    name,
    version: meta.version,
    license,
    devOnly: meta.dev === true,
  }
  rows.push(row)

  const ok = passesAllowlist(license) || name in LICENSE_EXCEPTIONS
  if (!ok) violations.push(row)
}

rows.sort((a, b) => a.name.localeCompare(b.name))

const manifest = {
  generatedAt: new Date().toISOString(),
  policy: "permissive-only (plan-4 §205): MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, Unlicense, CC0-1.0",
  allowlist: [...ALLOWED].sort(),
  exceptions: LICENSE_EXCEPTIONS,
  total: rows.length,
  packages: rows,
}
writeFileSync("third-party-licenses.json", JSON.stringify(manifest, null, 2) + "\n")

console.log(`license-check: ${rows.length} packages scanned, ${violations.length} violation(s)`)
if (violations.length) {
  console.error("\nNon-permissive or unknown licenses:")
  for (const v of violations) {
    console.error(`  ${v.name}@${v.version} — ${v.license}${v.devOnly ? " (dev-only)" : ""}`)
  }
  console.error(
    "\nFix options: replace the dependency, or add it to LICENSE_EXCEPTIONS in scripts/check-licenses.mjs WITH a reason.",
  )
  process.exit(1)
}
console.log("license-check: OK — all dependencies pass the permissive-only policy")
