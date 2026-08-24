// Share Card Generator (plan-4 §45) — чистая генерация SVG.
//
// Не использует внешних зависимостей: SVG строится вручную,
// растеризацию выполняет браузер (canvas → PNG) на клиенте.
// Это обходит MPL-лицензию @resvg/resvg-js (§207).

export interface ShareCardData {
  clubName: string
  teamA: string
  teamB: string
  score: string // "6:4 3:6 10:7"
  winner: "A" | "B" | null
  court: string
  duration: string // "1ч 24м"
  date: string
}

/** Цвета из дизайн-системы */
const COLORS = {
  bg: "#0A0F0A",
  card: "#111811",
  accent: "#A4FB23",
  text: "#FFFFFF",
  textDim: "#AAAAAA",
  winner: "#A4FB23",
  loser: "#666666",
}

/**
 * Генерирует SVG share-карточку 1200×630 (OG-размер).
 * Квадратная версия 1080×1080 для Instagram.
 */
export function generateShareCardSvg(data: ShareCardData, size: "wide" | "square" = "wide"): string {
  const w = size === "wide" ? 1200 : 1080
  const h = size === "wide" ? 630 : 1080
  const cx = w / 2

  const isAWinner = data.winner === "A"
  const isBWinner = data.winner === "B"

  const teamAColor = isAWinner ? COLORS.winner : COLORS.text
  const teamBColor = isBWinner ? COLORS.winner : COLORS.text

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0A0F0A"/>
      <stop offset="50%" style="stop-color:#0D1A0D"/>
      <stop offset="100%" style="stop-color:#0A0F0A"/>
    </linearGradient>
    <linearGradient id="accentBar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:${COLORS.accent}"/>
      <stop offset="100%" style="stop-color:${COLORS.accent};stop-opacity:0"/>
    </linearGradient>
  </defs>

  <!-- Фон -->
  <rect width="${w}" height="${h}" fill="url(#bg)"/>

  <!-- Декоративные круги -->
  <circle cx="${w * 0.85}" cy="${h * 0.15}" r="200" fill="${COLORS.accent}" opacity="0.03"/>
  <circle cx="${w * 0.1}" cy="${h * 0.85}" r="180" fill="#00FF88" opacity="0.03"/>

  <!-- Верхняя полоса -->
  <rect x="0" y="0" width="${w}" height="6" fill="url(#accentBar)"/>

  <!-- Клуб -->
  <text x="${cx}" y="${size === "wide" ? 60 : 100}" text-anchor="middle"
    font-family="Inter, -apple-system, sans-serif" font-size="22" font-weight="500"
    fill="${COLORS.textDim}" letter-spacing="4">
    ${escapeXml(data.clubName.toUpperCase())}
  </text>

  <!-- Счёт сетов -->
  <text x="${cx}" y="${size === "wide" ? 140 : 250}" text-anchor="middle"
    font-family="Inter, -apple-system, sans-serif" font-size="56" font-weight="800"
    fill="${COLORS.text}" letter-spacing="2">
    ${escapeXml(data.score)}
  </text>

  <!-- Разделитель -->
  <rect x="${cx - 200}" y="${size === "wide" ? 170 : 300}" width="400" height="1"
    fill="${COLORS.accent}" opacity="0.3"/>

  <!-- Команда A -->
  <text x="${cx}" y="${size === "wide" ? 240 : 420}" text-anchor="middle"
    font-family="Inter, -apple-system, sans-serif" font-size="${isAWinner ? 36 : 30}"
    font-weight="${isAWinner ? "700" : "400"}" fill="${teamAColor}">
    ${escapeXml(data.teamA)}
    ${isAWinner ? " 🏆" : ""}
  </text>

  <!-- VS -->
  <text x="${cx}" y="${size === "wide" ? 290 : 500}" text-anchor="middle"
    font-family="Inter, -apple-system, sans-serif" font-size="18" font-weight="600"
    fill="${COLORS.textDim}" letter-spacing="6">
    VS
  </text>

  <!-- Команда B -->
  <text x="${cx}" y="${size === "wide" ? 350 : 580}" text-anchor="middle"
    font-family="Inter, -apple-system, sans-serif" font-size="${isBWinner ? 36 : 30}"
    font-weight="${isBWinner ? "700" : "400"}" fill="${teamBColor}">
    ${escapeXml(data.teamB)}
    ${isBWinner ? " 🏆" : ""}
  </text>

  <!-- Нижняя панель -->
  <rect x="60" y="${h - 80}" width="${w - 120}" height="1" fill="#FFFFFF" opacity="0.1"/>

  <text x="80" y="${h - 45}"
    font-family="Inter, -apple-system, sans-serif" font-size="16" fill="${COLORS.textDim}">
    ${escapeXml(data.court)} · ${escapeXml(data.duration)}
  </text>

  <text x="${w - 80}" y="${h - 45}" text-anchor="end"
    font-family="Inter, -apple-system, sans-serif" font-size="16" fill="${COLORS.textDim}">
    ${escapeXml(data.date)}
  </text>

  <!-- Брендинг -->
  <text x="${cx}" y="${h - 20}" text-anchor="middle"
    font-family="Inter, -apple-system, sans-serif" font-size="12" fill="${COLORS.textDim}"
    opacity="0.5">
    Padel Club Platform
  </text>
</svg>`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
