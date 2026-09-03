// Разбор dumpsys media.camera: идентичность объективов + ключи обработки.
// Формат секций: "== Camera HAL device device@3.5/legacy/N (v3.5) static information: =="
import { readFileSync, writeFileSync } from "node:fs"

const file = process.argv[2] ?? "camera-full-static.txt"
const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n")
const parts = text.split(/== Camera HAL device device@3\.5\/legacy\/(\d) \(v3\.5\) static information: ==/)

function grab(body, key, maxLen = 110) {
  // Ключ на одной строке ("android.x.y (id): type[n]"), значение — на следующей "[v1 v2 ]"
  const re = new RegExp("android\\." + key.replace(/\./g, "\\.") + ".*\\n\\s*\\[([^\\]]+)")
  const m = body.match(re)
  return m ? m[1].replace(/\s+/g, " ").trim().slice(0, maxLen) : null
}

const wanted = [
  "lens.facing",
  "lens.info.availableFocalLengths",
  "sensor.info.physicalSize",
  "sensor.info.pixelArraySize",
  "lens.info.availableApertures",
  "sensor.info.activeArraySize",
  "request.availableCapabilities",
  "tonemap.availableToneMapModes",
  "noiseReduction.availableNoiseReductionModes",
  "edge.availableEdgeModes",
  "colorCorrection.availableColorCorrectionModes",
  "control.availableVideoStabilizationModes",
  "lens.info.availableOpticalStabilization",
  "control.availableHighSpeedVideoFrameRates",
  "sensor.info.exposureTimeRange",
  "sensor.info.sensitivityRange",
]

const out = []
for (let i = 1; i < parts.length; i += 2) {
  const n = parts[i]
  const body = parts[i + 1] ?? ""
  out.push(`=== legacy/${n} ===`)
  for (const key of wanted) {
    const v = grab(body, key, 200)
    if (v !== null) out.push(` ${key}: ${v}`)
  }
  // dynamicRangeProfiles может быть без префикса android.
  const dr = body.match(/dynamicRangeProfiles[^\[]*?\n\s*\[ ([^\]]+)/)
  if (dr) out.push(` dynamicRangeProfiles: ${dr[1].replace(/\s+/g, " ").slice(0, 200)}`)
  const drMode = body.match(/dynamicRangeMode[^\[]*?\n\s*\[ ([^\]]+)/)
  if (drMode) out.push(` dynamicRangeMode: ${drMode[1].replace(/\s+/g, " ").slice(0, 200)}`)
}
writeFileSync("camera-lenses-parsed.txt", out.join("\n") + "\n")
console.log(out.join("\n"))
