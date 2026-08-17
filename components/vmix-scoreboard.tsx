"use client"

// <VmixScoreboard> — the single presentational scoreboard for every vMix screen
// (Этап C of vmix-scoreboard-unification.md).
//
// It carries TWO layouts, chosen by `variant`:
//   - "court" / "overlay" — the fixed-pixel flex table used by the vMix overlay
//     pages (/court-vmix, /vmix/[id]); identical for both variants;
//   - "fullscreen" — the CSS-grid / viewport-unit layout that fills the screen
//     (/fullscreen-scoreboard), embedded inside the page's own header chrome.
//
// The break-point indicator is rendered on EVERY variant (Т1), gated by
// `settings.showBreakPoint`. The component never loads data or subscribes —
// the page owns the match; this is props-only.

import React, { useState, useEffect } from "react"
import { Trophy } from "lucide-react"
import { getImportantPoint, isBreakPoint, getBreakPointCount } from "@/lib/scoring-logic"
import { getImportantEventType, getGameScoreDisplay, getSetCellDisplay, isPlayerServing } from "@/lib/match-view"
import { formatCountry, isSameCountryAllPlayers } from "@/lib/country-display"
import { isSameAvatarAllPlayers } from "@/lib/avatar-display"
import { formatPlayerName, splitNameParts, applyNameCase } from "@/lib/player-name-format"
import type { ScoreboardSettings } from "@/lib/scoreboard-settings"

export type VmixVariant = "court" | "overlay" | "fullscreen"

export interface VmixScoreboardProps {
  match: any
  settings: ScoreboardSettings
  variant: VmixVariant
  /** fullscreen only: localized "match is over" banner label. */
  matchOverLabel?: string
}

/** Player country for display — flag / code / name per settings (APK
 *  ShowCountryAs); a space instead of an empty cell. */
function getPlayerCountryDisplay(
  team: "teamA" | "teamB",
  playerIndex: number,
  match: any,
  settings?: ScoreboardSettings,
): string {
  if (!match) return " "
  const country = match[team]?.players?.[playerIndex]?.country
  if (!country) return " "
  // APK hideFlagForSameCountry — one country on both sides carries no signal.
  if (settings?.hideSameCountry && isSameCountryAllPlayers(match)) return " "
  return formatCountry(country, settings?.countryAs ?? "flag") || " "
}

/**
 * One player's name, styled by the name typography settings: single/two
 * lines, per-part size & weight (or linked), and letter case.
 */
function PlayerNameBlock({ player, settings, baseEm }: { player: any; settings: ScoreboardSettings; baseEm: number }) {
  const {
    playerNameFormat, nameLines, nameLineOrder, nameCase,
    nameSizeLinked, nameSizeFirst, nameSizeLast,
    nameWeightLinked, nameWeightFirst, nameWeightLast,
  } = settings
  // Linked → the "first" value drives both parts.
  const sizeLast = nameSizeLinked ? nameSizeFirst : nameSizeLast
  const weightLast = nameWeightLinked ? nameWeightFirst : nameWeightLast
  const line = (text: string, size: number, weight: string) => (
    <span
      style={{
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        fontSize: `${baseEm * size}em`,
        fontWeight: weight,
        lineHeight: 1.05,
      }}
    >
      {text}
    </span>
  )

  // nameAs=first/last collapses everything to one styled part.
  if (playerNameFormat !== "full") {
    return line(applyNameCase(formatPlayerName(player?.name, playerNameFormat), nameCase), nameSizeFirst, nameWeightFirst)
  }

  const { first, last } = splitNameParts(player?.name)
  const f = applyNameCase(first, nameCase)
  const l = applyNameCase(last, nameCase)

  if (nameLines === "two" && l) {
    const seed = (player?.seed ?? "").toString().trim()
    const seedSuffix = seed ? ` [${seed}]` : ""
    return (
      <span style={{ display: "flex", flexDirection: "column", width: "100%", minWidth: 0 }}>
        {nameLineOrder === "last-top" ? (
          <>
            {line(l + seedSuffix, sizeLast, weightLast)}
            {line(f, nameSizeFirst, nameWeightFirst)}
          </>
        ) : (
          <>
            {line(f, nameSizeFirst, nameWeightFirst)}
            {line(l + seedSuffix, sizeLast, weightLast)}
          </>
        )}
      </span>
    )
  }

  // Single line; "last on top" order reads as "Фамилия Имя".
  const seed = (player?.seed ?? "").toString().trim()
  const suffix = seed ? ` [${seed}]` : ""
  const text = l ? (nameLineOrder === "last-top" ? `${l} ${f}` : `${f} ${l}`) : f
  return line(text + suffix, nameSizeFirst, nameWeightFirst)
}


/** Round avatar photo cell, or null when hidden / not configured. */
function getAvatarCell(
  team: "teamA" | "teamB",
  match: any,
  settings?: ScoreboardSettings,
  widthPx = 44,
): React.ReactNode {
  if (!match || !settings?.showAvatar) return null
  const hideSame = settings.hideSameAvatar && isSameAvatarAllPlayers(match)
  const avatarWidth = widthPx
  const cell = (team: "teamA" | "teamB") => (
    <div
      style={{
        padding: "2px",
        flex: "0 0 auto",
        width: `${avatarWidth}px`,
        minWidth: `${avatarWidth}px`,
        maxWidth: `${avatarWidth}px`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
      }}
    >
      {match[team].players.map((p: any, idx: number) => (
        <div
          key={idx}
          style={{
            height: match[team].players.length > 1 ? "50%" : "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {!hideSame && p?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.avatar}
              alt=""
              style={{
                width: `${avatarWidth - 10}px`,
                height: `${avatarWidth - 10}px`,
                borderRadius: "50%",
                objectFit: "cover",
              }}
            />
          ) : null}
        </div>
      ))}
    </div>
  )
  return cell(team)
}


/** Top-to-bottom linear-gradient background, or {} when the gradient is off. */
function getGradientStyle(useGradient: boolean, fromColor: string, toColor: string): React.CSSProperties {
  if (!useGradient) return {}
  return { background: `linear-gradient(to bottom, ${fromColor}, ${toColor})` }
}

export function VmixScoreboard({ match, settings, variant, matchOverLabel = "MATCH IS OVER" }: VmixScoreboardProps) {
  // --- Animated banner / break-point state (used by the flex variants) ---
  const [indicatorState, setIndicatorState] = useState("hidden") // entering | visible | exiting | hidden
  const [breakPointState, setBreakPointState] = useState("hidden")
  const [prevImportantPoint, setPrevImportantPoint] = useState<{ type: string | null; team: string | null }>({
    type: null,
    team: null,
  })
  const [prevBreakPoint, setPrevBreakPoint] = useState<{ team: string | false | null; count: { current: number; total: number } }>({
    team: null,
    count: { current: 0, total: 0 },
  })

  // Important-point banner animation — drives slide in/out of the indicator.
  useEffect(() => {
    if (!match) return

    const currentImportantPoint = getImportantPoint(match)
    const currentType = currentImportantPoint.type
    const prevType = prevImportantPoint.type

    if (currentType === prevType) return

    if (currentType && currentType !== "GAME" && (!prevType || prevType === "GAME")) {
      setIndicatorState("entering")
      const timer = setTimeout(() => setIndicatorState("visible"), 1000)
      return () => clearTimeout(timer)
    }

    if ((!currentType || currentType === "GAME") && prevType && prevType !== "GAME") {
      setIndicatorState("exiting")
      const timer = setTimeout(() => setIndicatorState("hidden"), 1000)
      return () => clearTimeout(timer)
    }

    setPrevImportantPoint(currentImportantPoint)
  }, [match, prevImportantPoint.type])

  // Break-point indicator animation — same slide in/out pattern.
  useEffect(() => {
    if (!match) return

    const currentBreakPoint = isBreakPoint(match)
    const prevBreakPointTeam = prevBreakPoint.team

    if (currentBreakPoint === prevBreakPointTeam) return

    if (currentBreakPoint && !prevBreakPointTeam) {
      setBreakPointState("entering")
      const timer = setTimeout(() => setBreakPointState("visible"), 1000)
      return () => clearTimeout(timer)
    }

    if (!currentBreakPoint && prevBreakPointTeam) {
      setBreakPointState("exiting")
      const timer = setTimeout(() => setBreakPointState("hidden"), 1000)
      return () => clearTimeout(timer)
    }

    setPrevBreakPoint({ team: currentBreakPoint, count: getBreakPointCount(match) })
  }, [match, prevBreakPoint.team])

  if (!match) return null

  return variant === "fullscreen"
    ? <FullscreenLayout match={match} settings={settings} matchOverLabel={matchOverLabel} />
    : <FlexLayout
        match={match}
        settings={settings}
        indicatorState={indicatorState}
        breakPointState={breakPointState}
        prevImportantPoint={prevImportantPoint}
      />
}

// ---------------------------------------------------------------------------
// Flex layout — fixed-pixel table for the vMix overlays (court / overlay).
// ---------------------------------------------------------------------------

const CONTAINER_CLASS: Record<string, string> = {
  small: "text-sm",
  normal: "text-base",
  large: "text-lg",
  xlarge: "text-xl",
}

/** Tiebreak superscript as used by the flex overlays. */
function formatSetScoreFlex(score: string | number, sup: string | number | null) {
  if (sup === null || sup === undefined || sup === "") return <span>{score}</span>
  return (
    <span>
      {score}
      <sup style={{ fontSize: "0.67em", position: "relative", top: "-0.8em" }}>{sup}</sup>
    </span>
  )
}

interface FlexLayoutProps {
  match: any
  settings: ScoreboardSettings
  indicatorState: string
  breakPointState: string
  prevImportantPoint: { type: string | null; team: string | null }
}

function FlexLayout({ match, settings, indicatorState, breakPointState, prevImportantPoint }: FlexLayoutProps) {
  const {
    theme, showPoints, showSets, showServer, showCountry, fontSize, showBreakPoint, showAvatar,
    playerNameFormat,
    textColor, accentColor, playerNamesFontSize,
    namesBgColor, countryBgColor, pointsBgColor, setsBgColor, setsTextColor,
    indicatorBgColor, indicatorTextColor, indicatorGradient, indicatorGradientFrom, indicatorGradientTo,
    namesGradient, namesGradientFrom, namesGradientTo,
    countryGradient, countryGradientFrom, countryGradientTo,
    pointsGradient, pointsGradientFrom, pointsGradientTo,
    setsGradient, setsGradientFrom, setsGradientTo,
    serveBgColor, serveGradient, serveGradientFrom, serveGradientTo,
  } = settings

  const isTransparent = theme === "transparent"
  const importantPoint = getImportantPoint(match)
  const breakPoint = isBreakPoint(match)
  const breakPointCount = getBreakPointCount(match)

  // Column widths — fixed so the break-point bar can match the table width.
  const nameColumnWidth = 300
  const avatarColumnWidth = 44
  const countryColumnWidth = 50
  const serveColumnWidth = 30

  const tableWidth =
    nameColumnWidth +
    (showAvatar ? avatarColumnWidth : 0) +
    (showCountry ? countryColumnWidth : 0) +
    (showServer ? serveColumnWidth : 0) +
    (match.score.sets?.length || 0) * 40 +
    (match.score.currentSet ? 40 : 0) +
    (showPoints ? 60 : 0)

  const getServeCell = (team: "teamA" | "teamB") => (
    showServer && (
      <div
        style={{
          color: accentColor,
          padding: "1px",
          flex: "0 0 auto",
          width: `${serveColumnWidth}px`,
          minWidth: `${serveColumnWidth}px`,
          maxWidth: `${serveColumnWidth}px`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...(isTransparent
            ? { background: "transparent" }
            : serveGradient
              ? getGradientStyle(true, serveGradientFrom, serveGradientTo)
              : { background: serveBgColor }),
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-around",
            height: "100%",
          }}
        >
          <div style={{ visibility: isPlayerServing(match, team, 0) ? "visible" : "hidden", fontSize: "4em", lineHeight: "0.5" }}>
            •
          </div>
          {match[team].players.length > 1 && (
            <div style={{ visibility: isPlayerServing(match, team, 1) ? "visible" : "hidden", fontSize: "4em", lineHeight: "0.5" }}>
              •
            </div>
          )}
        </div>
      </div>
    )
  )

  const getNameCell = (team: "teamA" | "teamB") => (
    <div
      style={{
        color: isTransparent ? textColor : "white",
        padding: "1px",
        flex: "0 0 auto",
        width: `${nameColumnWidth}px`,
        minWidth: `${nameColumnWidth}px`,
        maxWidth: `${nameColumnWidth}px`,
        display: "flex",
        alignItems: "center",
        ...(isTransparent
          ? { background: "transparent" }
          : namesGradient
            ? getGradientStyle(true, namesGradientFrom, namesGradientTo)
            : { background: namesBgColor }),
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", width: "100%", overflow: "hidden" }}>
        {match[team].players.map((player: any, idx: number) => (
          <div key={idx} style={{ display: "flex", alignItems: "center" }}>
            <span style={{ flex: 1, minWidth: 0, paddingLeft: "10px" }}>
              <PlayerNameBlock player={player} settings={settings} baseEm={playerNamesFontSize} />
            </span>
          </div>
        ))}
      </div>
    </div>
  )

  const getCountryCell = (team: "teamA" | "teamB") => (
    showCountry && (
      <div
        style={{
          color: isTransparent ? textColor : "white",
          padding: "1px",
          flex: "0 0 auto",
          width: `${countryColumnWidth}px`,
          minWidth: `${countryColumnWidth}px`,
          maxWidth: `${countryColumnWidth}px`,
          display: "flex",
          flexDirection: "column",
          ...(isTransparent
            ? { background: "transparent" }
            : countryGradient
              ? getGradientStyle(true, countryGradientFrom, countryGradientTo)
              : { background: countryBgColor }),
        }}
      >
        {match[team].players.map((_: any, idx: number) => (
          <div
            key={idx}
            style={{
              height: match[team].players.length > 1 ? "50%" : "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {getPlayerCountryDisplay(team, idx, match, settings)}
          </div>
        ))}
      </div>
    )
  )

  const setCellStyle: React.CSSProperties = {
    color: isTransparent ? textColor : setsTextColor,
    padding: "1px",
    flex: "0 0 auto",
    width: "40px",
    minWidth: "40px",
    textAlign: "center",
    borderLeft: isTransparent ? "none" : "1px solid #e5e5e5",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.8em",
    ...(isTransparent
      ? { background: "transparent" }
      : setsGradient
        ? getGradientStyle(true, setsGradientFrom, setsGradientTo)
        : { background: setsBgColor }),
  }

  const getSetsCells = (team: "teamA" | "teamB") => (
    showSets && match.score.sets && (
      <>
        {match.score.sets.map((set: any, idx: number) => {
          const cell = getSetCellDisplay(set, team)
          return (
            <div key={`${team}-set-${idx}-${set[team]}-${set.tiebreak?.[team] ?? ""}`} style={setCellStyle}>
              {formatSetScoreFlex(cell.main, cell.sup)}
            </div>
          )
        })}
        {match.score.currentSet && !match.isCompleted && (
          <div style={setCellStyle}>{match.score.currentSet[team]}</div>
        )}
      </>
    )
  )

  const getPointsCell = (team: "teamA" | "teamB") => (
    showPoints && (
      <div
        style={{
          color: isTransparent ? textColor : "white",
          padding: "1px",
          flex: "0 0 auto",
          width: "60px",
          minWidth: "60px",
          textAlign: "center",
          borderLeft: isTransparent ? "none" : "1px solid #e5e5e5",
          fontSize: "2em",
          fontWeight: "bold",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...(isTransparent
            ? { background: "transparent" }
            : pointsGradient
              ? getGradientStyle(true, pointsGradientFrom, pointsGradientTo)
              : { background: pointsBgColor }),
        }}
      >
        {match.isCompleted ? (
          // Finished match: trophy on the winner, empty on the loser.
          match.winner === team ? <Trophy size={24} /> : null
        ) : (
          match.score.currentSet && (
            <span key={`${team}-score-${match.id}-${JSON.stringify(match.score.currentSet?.currentGame?.[team] || 0)}`}>
              {getGameScoreDisplay(match, team)}
            </span>
          )
        )}
      </div>
    )
  )

  return (
    <>
      <style>{`
        @keyframes vmixSlideIn {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes vmixSlideOut {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(100%); opacity: 0; }
        }
        .indicator-animation-enter { animation: vmixSlideIn 1s ease forwards; }
        .indicator-animation-exit { animation: vmixSlideOut 1s ease forwards; }
      `}</style>

      <div
        className={CONTAINER_CLASS[fontSize] || CONTAINER_CLASS.normal}
        style={{
          background: "transparent",
          color: textColor,
          padding: "0",
          fontFamily: "Arial, sans-serif",
          width: "auto",
          height: "auto",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* Break-point indicator (top) — shown on every variant (Т1). */}
        <div
          style={{
            display: "flex",
            width: `${tableWidth}px`,
            height: "18px",
            marginBottom: "1px",
            justifyContent: "flex-end",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {showBreakPoint && (breakPoint || breakPointState === "exiting") && (
            <div
              className={
                breakPointState === "entering" || breakPointState === "visible"
                  ? "indicator-animation-enter"
                  : "indicator-animation-exit"
              }
              style={{
                color: isTransparent ? accentColor : indicatorTextColor,
                backgroundColor: isTransparent ? "transparent" : indicatorGradient ? undefined : indicatorBgColor,
                ...(indicatorGradient ? getGradientStyle(true, indicatorGradientFrom, indicatorGradientTo) : {}),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "120px",
                height: "100%",
                fontWeight: "bold",
                fontSize: "0.8em",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                position: "absolute",
                top: 0,
                right: "60px",
                zIndex: 1,
                overflow: "hidden",
              }}
            >
              {`BREAK POINT ${breakPointCount.current}/${breakPointCount.total}`}
            </div>
          )}
        </div>

        {/* Score table */}
        <div style={{ display: "flex", flexDirection: "column", width: "fit-content" }}>
          {/* Team A */}
          <div style={{ display: "flex", marginBottom: "1px" }}>
            {getNameCell("teamA")}
            {getAvatarCell("teamA", match, settings, avatarColumnWidth)}
            {getCountryCell("teamA")}
            {getServeCell("teamA")}
            {getSetsCells("teamA")}
            {getPointsCell("teamA")}
          </div>

          {/* Team B */}
          <div style={{ display: "flex" }}>
            {getNameCell("teamB")}
            {getAvatarCell("teamB", match, settings, avatarColumnWidth)}
            {getCountryCell("teamB")}
            {getServeCell("teamB")}
            {getSetsCells("teamB")}
            {getPointsCell("teamB")}
          </div>

          {/* Important-event indicator (bottom) */}
          <div
            style={{
              display: "flex",
              width: "100%",
              height: "18px",
              marginTop: "1px",
              justifyContent: "flex-end",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {((importantPoint.type && importantPoint.type !== "GAME") || indicatorState === "exiting") && (
              <div
                className={
                  indicatorState === "entering" || indicatorState === "visible"
                    ? "indicator-animation-enter"
                    : "indicator-animation-exit"
                }
                style={{
                  color: isTransparent ? accentColor : indicatorTextColor,
                  backgroundColor: isTransparent ? "transparent" : indicatorGradient ? undefined : indicatorBgColor,
                  ...(indicatorGradient ? getGradientStyle(true, indicatorGradientFrom, indicatorGradientTo) : {}),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "33%",
                  height: "100%",
                  fontWeight: "bold",
                  fontSize: "0.8em",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  position: "absolute",
                  bottom: 0,
                  right: 0,
                  zIndex: 1,
                }}
              >
                {prevImportantPoint.type !== "GAME" && prevImportantPoint.type
                  ? prevImportantPoint.type
                  : importantPoint.type}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Fullscreen layout — CSS grid / viewport units, fills the screen.
// ---------------------------------------------------------------------------

/** Tiebreak superscript as used by the fullscreen scoreboard. */
function formatSetScoreFullscreen(score: any, sup: any) {
  if (sup === null || sup === undefined || sup === "") return <span>{score}</span>
  return (
    <span className="relative">
      {score}
      <span className="absolute -top-[12px] -right-4 text-[0.45em] font-bold" style={{ color: "inherit" }}>
        {sup}
      </span>
    </span>
  )
}

interface FullscreenLayoutProps {
  match: any
  settings: ScoreboardSettings
  matchOverLabel: string
}

function FullscreenLayout({ match, settings, matchOverLabel }: FullscreenLayoutProps) {
  const {
    theme, showNames, showPoints, showSets, showServer, showCountry, showBreakPoint, showAvatar,
    playerNameFormat,
    textColor, accentColor,
    namesBgColor, countryBgColor, pointsBgColor, setsBgColor, setsTextColor,
    indicatorBgColor, indicatorTextColor, indicatorGradient, indicatorGradientFrom, indicatorGradientTo,
    namesGradient, namesGradientFrom, namesGradientTo,
    countryGradient, countryGradientFrom, countryGradientTo,
    pointsGradient, pointsGradientFrom, pointsGradientTo,
    setsGradient, setsGradientFrom, setsGradientTo,
    serveBgColor, serveGradient, serveGradientFrom, serveGradientTo,
  } = settings

  const isTransparent = theme === "transparent"
  const importantEvent = getImportantEventType(match, matchOverLabel)
  const breakPoint = isBreakPoint(match)
  const breakPointCount = getBreakPointCount(match)

  const renderSetCell = (set: any, team: "teamA" | "teamB") => {
    const cell = getSetCellDisplay(set, team)
    return formatSetScoreFullscreen(cell.main, cell.sup)
  }

  const setCount = (match.score.sets?.length || 0) + (match.score.currentSet && !match.isCompleted ? 1 : 0)

  const renderTeamRow = (team: "teamA" | "teamB") => (
    <div className="team-row">
      {showNames && (
        <div
          className="cell names-cell"
          style={{
            color: isTransparent ? textColor : "white",
            ...(isTransparent
              ? { background: "transparent" }
              : namesGradient
                ? getGradientStyle(true, namesGradientFrom, namesGradientTo)
                : { background: namesBgColor }),
          }}
        >
          {match[team].players.map((player: any, idx: number) => (
            <div key={idx} className="player-name-container">
              <div className="player-name pl-6" title={player.name}>
                <PlayerNameBlock player={player} settings={settings} baseEm={1} />
              </div>
            </div>
          ))}
          {match.format === "doubles" && <div className="player-divider"></div>}
        </div>
      )}

      {showAvatar && !(settings.hideSameAvatar && isSameAvatarAllPlayers(match)) && (
        <div className="cell avatar-cell" style={{ background: "transparent" }}>
          {match[team].players.map((p: any, idx: number) => (
            <div
              key={idx}
              style={{ height: `${100 / match[team].players.length}%`, display: "flex", alignItems: "center", justifyContent: "center" }}
            >
              {p?.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatar} alt="" className="rounded-full object-cover" style={{ width: "70%", height: "70%" }} />
              ) : null}
            </div>
          ))}
        </div>
      )}

      {showCountry && (
        <div
          className="cell country-cell"
          style={{
            color: isTransparent ? textColor : "white",
            ...(isTransparent
              ? { background: "transparent" }
              : countryGradient
                ? getGradientStyle(true, countryGradientFrom, countryGradientTo)
                : { background: countryBgColor }),
          }}
        >
          {match[team].players.map((_: any, idx: number) => (
            <div
              key={idx}
              style={{ height: `${100 / match[team].players.length}%`, display: "flex", alignItems: "center" }}
            >
              {getPlayerCountryDisplay(team, idx, match, settings)}
            </div>
          ))}
        </div>
      )}

      {showServer && (
        <div
          className="cell server-cell"
          style={{
            color: accentColor,
            ...(isTransparent
              ? { background: "transparent" }
              : serveGradient
                ? getGradientStyle(true, serveGradientFrom, serveGradientTo)
                : { background: serveBgColor }),
          }}
        >
          {match[team].players.map((_: any, idx: number) => (
            <div
              key={idx}
              className="server-indicator"
              style={{ visibility: isPlayerServing(match, team, idx) ? "visible" : "hidden" }}
            >
              •
            </div>
          ))}
        </div>
      )}

      {showSets &&
        match.score.sets &&
        match.score.sets.map((set: any, idx: number) => (
          <div
            key={idx}
            className="cell set-cell"
            style={{
              ...(isTransparent
                ? { background: "transparent" }
                : setsGradient
                  ? getGradientStyle(true, setsGradientFrom, setsGradientTo)
                  : { background: setsBgColor }),
              color: isTransparent ? textColor : setsTextColor,
            }}
          >
            {renderSetCell(set, team)}
          </div>
        ))}

      {showSets && match.score.currentSet && !match.isCompleted && (
        <div
          className="cell set-cell"
          style={{
            ...(isTransparent
              ? { background: "transparent" }
              : setsGradient
                ? getGradientStyle(true, setsGradientFrom, setsGradientTo)
                : { background: setsBgColor }),
            color: isTransparent ? textColor : setsTextColor,
          }}
        >
          {match.score.currentSet[team]}
        </div>
      )}

      {showPoints && (
        <>
          <div
            className="cell points-cell"
            style={{
              color: isTransparent ? textColor : "white",
              ...(isTransparent
                ? { background: "transparent" }
                : pointsGradient
                  ? getGradientStyle(true, pointsGradientFrom, pointsGradientTo)
                  : { background: pointsBgColor }),
            }}
          >
            {!match.isCompleted ? (
              <span>{getGameScoreDisplay(match, team)}</span>
            ) : match.winner === team ? (
              <div className="trophy-icon">
                <Trophy size={48} />
              </div>
            ) : null}
          </div>
          <div style={{ width: 0, padding: 0, margin: 0 }}></div>
        </>
      )}
    </div>
  )

  return (
    <>
      <style>{`
        .scoreboard {
          display: grid;
          grid-template-rows: 1fr 1fr;
          height: 100%;
          width: 100%;
          gap: 2px;
          margin: 0;
          padding: 0;
          overflow: hidden;
          position: relative;
        }

        .team-row {
          display: grid;
          grid-template-columns: ${showNames ? "4.6fr " : ""}${showAvatar ? "0.7fr " : ""}${showCountry ? "1fr " : ""}${showServer ? "0.5fr " : ""}${showSets ? `repeat(${setCount}, 0.8fr) ` : ""}${showPoints ? "1.4fr 0fr" : ""};
          height: 100%;
          width: 100%;
          gap: 0;
          max-width: 100vw;
          margin: 0;
          padding: 0;
        }

        .cell {
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          position: relative;
          padding: 0;
        }

        .player-name-container {
          width: 100%;
          height: ${match.format === "doubles" ? "50%" : "100%"};
          display: flex;
          flex-direction: column;
          justify-content: center;
          position: relative;
          z-index: 1;
        }

        .player-divider {
          height: 1px;
          background-color: rgba(192, 192, 192, 0.5);
          width: 100%;
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          margin: 0;
        }

        .names-cell {
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          padding: 3px;
          height: 100%;
          position: relative;
        }

        .player-name {
          white-space: normal;
          overflow: hidden;
          word-wrap: break-word;
          font-weight: bold;
          width: 100%;
          text-align: left;
          font-size: clamp(1.9vh, 9.5vh, 19vh);
          line-height: 1.1;
          display: -webkit-box;
          -webkit-line-clamp: ${match.format === "doubles" ? "2" : "3"};
          -webkit-box-orient: vertical;
        }

        .server-cell {
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          align-items: center;
          padding: 0;
          margin: 0;
        }

        .server-indicator {
          font-size: 15vh;
          line-height: 1;
          padding: 0;
          margin: 0;
        }

        .set-cell {
          font-weight: bold;
          font-size: 10vh;
          padding: 0 0.5vw;
        }

        .points-cell {
          font-weight: bold;
          font-size: 19.2vh;
          width: 100%;
          text-align: center;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 0;
          margin: 0;
          flex-grow: 1;
          box-sizing: border-box;
          min-width: 0;
        }

        .points-cell span {
          width: 100%;
          height: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 0.9em;
        }

        .points-cell .trophy-icon {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          height: 100%;
        }

        .break-point-badge {
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          z-index: 20;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          font-size: 3vh;
          padding: 0.4vh 1.5vw;
          color: ${isTransparent ? accentColor : indicatorTextColor};
          ${
            isTransparent
              ? "background: transparent;"
              : indicatorGradient
                ? `background: linear-gradient(to bottom, ${indicatorGradientFrom}, ${indicatorGradientTo});`
                : `background-color: ${indicatorBgColor};`
          }
        }

        .important-event {
          color: ${indicatorTextColor};
          font-weight: bold;
          text-align: center;
          padding: 3px;
          font-size: 4vh;
          height: 6vh;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.5s ease;
          z-index: 10;
          ${
            indicatorGradient
              ? `background: linear-gradient(to bottom, ${indicatorGradientFrom}, ${indicatorGradientTo});`
              : `background-color: ${indicatorBgColor};`
          }
        }

        @media (max-width: 768px) {
          .server-indicator { font-size: 12vh; }
          .set-cell { font-size: 8vh; }
          .points-cell { font-size: 14.4vh; }
          .important-event { font-size: 3vh; }
        }

        @media (min-width: 769px) and (max-width: 1200px) {
          .server-indicator { font-size: 15vh; }
          .set-cell { font-size: 10vh; }
          .points-cell { font-size: 16.8vh; }
          .important-event { font-size: 3.5vh; }
        }

        @media (min-width: 1201px) {
          .server-indicator { font-size: 18vh; }
          .set-cell { font-size: 12vh; }
          .points-cell { font-size: 21.6vh; }
          .important-event { font-size: 4vh; }
        }

        sup {
          font-size: 0.45em;
          position: relative;
          top: -0.49em;
          margin-left: 0.6em;
        }
      `}</style>

      <div className="scoreboard">
        {showBreakPoint && breakPoint && (
          <div className="break-point-badge">{`BREAK POINT ${breakPointCount.current}/${breakPointCount.total}`}</div>
        )}
        {renderTeamRow("teamA")}
        {renderTeamRow("teamB")}
      </div>

      <div className="important-event" style={{ opacity: importantEvent ? 1 : 0 }}>
        {importantEvent || ""}
      </div>
    </>
  )
}
