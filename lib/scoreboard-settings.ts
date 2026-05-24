// Scoreboard display settings — the single parse of the vMix URL parameters
// (Этап A of vmix-scoreboard-unification.md).
//
// court-vmix and vmix/[id] parse exactly these 38 parameters identically;
// this module is now the one source. The fullscreen-scoreboard page parses a
// slightly different set (notably a different `showCountry` default) and is
// migrated separately, together with the shared <VmixScoreboard> component.

/** Normalises a color URL-param: empty → fallback, missing `#` → prepended. */
function parseColorParam(param: string | null | undefined, fallback: string): string {
  if (!param) return fallback
  return param.startsWith("#") ? param : `#${param}`
}

/** Minimal shape accepted for the source — both URLSearchParams and Next's
 *  ReadonlyURLSearchParams satisfy it. */
type ParamSource = { get(name: string): string | null }

export interface ScoreboardSettings {
  theme: string
  showNames: boolean
  showPoints: boolean
  showSets: boolean
  showServer: boolean
  showCountry: boolean
  showBreakPoint: boolean
  fontSize: string
  bgOpacity: number
  textColor: string
  accentColor: string
  playerNamesFontSize: number
  outputFormat: string
  showDebug: boolean
  namesBgColor: string
  countryBgColor: string
  pointsBgColor: string
  setsBgColor: string
  setsTextColor: string
  indicatorBgColor: string
  indicatorTextColor: string
  indicatorGradient: boolean
  indicatorGradientFrom: string
  indicatorGradientTo: string
  namesGradient: boolean
  namesGradientFrom: string
  namesGradientTo: string
  countryGradient: boolean
  countryGradientFrom: string
  countryGradientTo: string
  pointsGradient: boolean
  pointsGradientFrom: string
  pointsGradientTo: string
  setsGradient: boolean
  setsGradientFrom: string
  setsGradientTo: string
  serveBgColor: string
  serveGradient: boolean
  serveGradientFrom: string
  serveGradientTo: string
  // Per-variant overrides (Т2). The common block above applies to every
  // scoreboard variant; these optional sections override individual fields for
  // one variant only. Intentionally minimal for now — populated incrementally
  // as variant-specific options appear. `resolveSettings` flattens them.
  court?: Partial<ScoreboardSettings>
  overlay?: Partial<ScoreboardSettings>
  fullscreen?: Partial<ScoreboardSettings>
}

/** The three scoreboard variants a settings object can be resolved for. */
export type ScoreboardVariant = "court" | "overlay" | "fullscreen"

/**
 * Parses the scoreboard display settings out of the URL query parameters.
 * Defaults match the (identical) parsing previously inlined in court-vmix and
 * vmix/[id] — this is a behaviour-preserving extraction.
 */
export function parseScoreboardSettings(searchParams: ParamSource): ScoreboardSettings {
  const get = (key: string) => searchParams.get(key)
  return {
    theme: get("theme") || "default",
    showNames: get("showNames") !== "false",
    showPoints: get("showPoints") !== "false",
    showSets: get("showSets") !== "false",
    showServer: get("showServer") !== "false",
    showCountry: get("showCountry") !== "false",
    // Break-point indicator — shown on every scoreboard (Т1). Default on.
    showBreakPoint: get("showBreakPoint") !== "false",
    fontSize: get("fontSize") || "normal",
    bgOpacity: Number.parseFloat(get("bgOpacity") || "0.5"),
    textColor: parseColorParam(get("textColor"), "#ffffff"),
    accentColor: parseColorParam(get("accentColor"), "#a4fb23"),
    playerNamesFontSize: Number.parseFloat(get("playerNamesFontSize") || "1.2"),
    outputFormat: get("format") || "html",
    showDebug: get("debug") === "true",
    namesBgColor: parseColorParam(get("namesBgColor"), "#0369a1"),
    countryBgColor: parseColorParam(get("countryBgColor"), "#0369a1"),
    pointsBgColor: parseColorParam(get("pointsBgColor"), "#0369a1"),
    setsBgColor: parseColorParam(get("setsBgColor"), "#ffffff"),
    setsTextColor: parseColorParam(get("setsTextColor"), "#000000"),
    indicatorBgColor: parseColorParam(get("indicatorBgColor"), "#7c2d12"),
    indicatorTextColor: parseColorParam(get("indicatorTextColor"), "#ffffff"),
    indicatorGradient: get("indicatorGradient") === "true",
    indicatorGradientFrom: parseColorParam(get("indicatorGradientFrom"), "#7c2d12"),
    indicatorGradientTo: parseColorParam(get("indicatorGradientTo"), "#991b1b"),
    namesGradient: get("namesGradient") === "true",
    namesGradientFrom: parseColorParam(get("namesGradientFrom"), "#0369a1"),
    namesGradientTo: parseColorParam(get("namesGradientTo"), "#0284c7"),
    countryGradient: get("countryGradient") === "true",
    countryGradientFrom: parseColorParam(get("countryGradientFrom"), "#0369a1"),
    countryGradientTo: parseColorParam(get("countryGradientTo"), "#0284c7"),
    pointsGradient: get("pointsGradient") === "true",
    pointsGradientFrom: parseColorParam(get("pointsGradientFrom"), "#0369a1"),
    pointsGradientTo: parseColorParam(get("pointsGradientTo"), "#0284c7"),
    setsGradient: get("setsGradient") === "true",
    setsGradientFrom: parseColorParam(get("setsGradientFrom"), "#ffffff"),
    setsGradientTo: parseColorParam(get("setsGradientTo"), "#f0f0f0"),
    serveBgColor: parseColorParam(get("serveBgColor"), "#000000"),
    serveGradient: get("serveGradient") === "true",
    serveGradientFrom: parseColorParam(get("serveGradientFrom"), "#000000"),
    serveGradientTo: parseColorParam(get("serveGradientTo"), "#1e1e1e"),
  }
}

/**
 * Effective settings for one scoreboard variant: the common block with that
 * variant's override section applied on top (Т2). The `court`/`overlay`/
 * `fullscreen` sub-sections are stripped from the result — it is a flat,
 * ready-to-render settings object.
 */
export function resolveSettings(
  settings: ScoreboardSettings,
  variant: ScoreboardVariant,
): ScoreboardSettings {
  const { court, overlay, fullscreen, ...common } = settings
  const override = variant === "court" ? court : variant === "overlay" ? overlay : fullscreen
  return { ...common, ...(override ?? {}) }
}
