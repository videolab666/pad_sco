import { readFileSync } from "node:fs"
const text = readFileSync("camera-full-static.txt", "utf8")
const parts = text.split(/== Camera HAL device device@3\.5\/legacy\/(\d) \(v3\.5\) static information: ==/)
console.log("parts.length:", parts.length)
const body = parts[2] ?? ""
console.log("body length:", body.length)
console.log("body starts:", JSON.stringify(body.slice(0, 80)))
const re = new RegExp("android\\.lens\\.facing.*\\n\\s*\\[([^\\]]+)")
console.log("regex source:", re.source)
console.log("match:", body.match(re)?.[1])
