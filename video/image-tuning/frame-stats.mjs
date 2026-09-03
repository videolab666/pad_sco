// Luma-статистика кадров: YAVG / %clipped(>235) / %dark(<16) / stddev контраста.
// Использование: node frame-stats.mjs frame1.jpg frame2.jpg ...
import { execFileSync } from "node:child_process"

const ff = "C:\\Program Files\\FFmpeg 8\\ffmpeg"
const files = process.argv.slice(2)
for (const f of files) {
  const out = execFileSync(
    ff,
    [
      "-hide_banner", "-i", f,
      "-vf", "signalstats,metadata=print:file=-",
      "-f", "null", "-",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  )
  const g = (k) => {
    const m = out.match(new RegExp(k + "=([-0-9.]+)"))
    return m ? Number(m[1]) : null
  }
  const yavg = g("YAVG"), yhigh = g("YHIGH"), ylow = g("YLOW"), ymax = g("YMAX"), ymin = g("YMIN")
  console.log(
    `${f}: YAVG=${yavg} YMAX=${ymax} YMIN=${ymin} clipped>235=${yhigh}% dark<16=${ylow}%`,
  )
}
