import { describe, it, expect } from "vitest"
import {
  applyManualHide,
  applyManualShow,
  buildPlaybackList,
  bumperEnabled,
  DEFAULT_MEDIA_TRIGGERS,
  emptyMediaState,
  evaluateMediaState,
  itemDurationSec,
  lastScoreAtFromMatchRow,
  mediaStateFromRow,
  mediaStateToRow,
  normalizeBumper,
  normalizeTriggers,
  playbackListDurationSec,
  quotaCheck,
  resolveTriggers,
  sessionStopReason,
  synthesizePlaylistItems,
  type MediaItem,
  type MediaTriggers,
  type PlaylistItemRef,
} from "../lib/media-core"

const MIN = 60_000

const item = (id: string, over: Partial<MediaItem> = {}): MediaItem => ({
  id,
  title: id,
  kind: "image",
  storagePath: `${id}.jpg`,
  sizeBytes: 1000,
  mime: "image/jpeg",
  durationSec: null,
  width: 1920,
  height: 1080,
  bgPath: null,
  isActive: true,
  ...over,
})

const video = (id: string, over: Partial<MediaItem> = {}): MediaItem =>
  item(id, { kind: "video", storagePath: `${id}.mp4`, mime: "video/mp4", durationSec: 30, ...over })

const refs = (...ids: string[]): PlaylistItemRef[] => ids.map((itemId, position) => ({ itemId, position, durationSec: null }))

describe("media-core — buildPlaybackList", () => {
  const items = [item("a"), item("b"), item("c"), item("d"), video("club")]

  it("orders by position and resolves photo duration to the default", () => {
    const entries = buildPlaybackList(items, refs("c", "a", "b"), { afterEveryN: null, minIntervalSec: null, bumperItemId: null })
    expect(entries.map((e) => e.item.id)).toEqual(["c", "a", "b"])
    expect(entries.every((e) => e.durationSec === 10)).toBe(true)
    expect(playbackListDurationSec(entries)).toBe(30)
  })

  it("skips inactive and unknown items", () => {
    const withInactive = [...items, item("off", { isActive: false })]
    const entries = buildPlaybackList(withInactive, refs("a", "off", "ghost"), { afterEveryN: null, minIntervalSec: null, bumperItemId: null })
    expect(entries.map((e) => e.item.id)).toEqual(["a"])
  })

  it("inserts the bumper after every N-th item (virtual duplicate)", () => {
    const entries = buildPlaybackList(items, refs("a", "b", "c", "d"), { afterEveryN: 2, minIntervalSec: null, bumperItemId: "club" })
    expect(entries.map((e) => `${e.item.id}${e.isBumper ? "!" : ""}`)).toEqual(["a", "b", "club!", "c", "d", "club!"])
  })

  it("throttles bumpers by minIntervalSec", () => {
    // Photos are 10s, the club bumper is a 30s video, interval 60s:
    // bumper after a (at 10s), then no candidate reaches 60s until after d (70s).
    const entries = buildPlaybackList(items, refs("a", "b", "c", "d"), { afterEveryN: 1, minIntervalSec: 60, bumperItemId: "club" })
    expect(entries.map((e) => `${e.item.id}${e.isBumper ? "!" : ""}`)).toEqual(["a", "club!", "b", "c", "d", "club!"])
  })

  it("interval-only config still inserts bumpers at boundaries once M seconds pass", () => {
    // All videos of 30s, interval 30s → bumper after every item.
    const vids = [video("v1"), video("v2"), video("v3"), video("club")]
    const entries = buildPlaybackList(vids, refs("v1", "v2", "v3"), { afterEveryN: null, minIntervalSec: 30, bumperItemId: "club" })
    expect(entries.map((e) => `${e.item.id}${e.isBumper ? "!" : ""}`)).toEqual(["v1", "club!", "v2", "club!", "v3", "club!"])
  })

  it("per-item duration override wins; videos fall back to 30s when unknown", () => {
    const unknownVideo = video("v", { durationSec: null })
    expect(itemDurationSec(unknownVideo, null)).toBe(30)
    expect(itemDurationSec(item("p"), 25)).toBe(25)
    const entries = buildPlaybackList(
      [item("p"), unknownVideo],
      [
        { itemId: "p", position: 0, durationSec: 4 },
        { itemId: "v", position: 1, durationSec: null },
      ],
      { afterEveryN: null, minIntervalSec: null, bumperItemId: null },
    )
    expect(entries.map((e) => e.durationSec)).toEqual([4, 30])
  })

  it("no bumper when id missing or config empty", () => {
    expect(bumperEnabled({ afterEveryN: null, minIntervalSec: null, bumperItemId: "x" })).toBe(false)
    expect(bumperEnabled({ afterEveryN: 2, minIntervalSec: null, bumperItemId: null })).toBe(false)
    const entries = buildPlaybackList(items, refs("a", "b"), { afterEveryN: 1, minIntervalSec: null, bumperItemId: "ghost" })
    expect(entries.some((e) => e.isBumper)).toBe(false)
  })

  it("synthesizePlaylistItems lists every active item in library order", () => {
    expect(synthesizePlaylistItems(items).map((r) => r.itemId)).toEqual(["a", "b", "c", "d", "club"])
  })
})

// (item/ref factory helpers live at the top of the file)

describe("media-core — normalize/resolve triggers", () => {
  it("fills defaults, clamps junk and keeps per-court partials partial", () => {
    const t = normalizeTriggers({
      afterCompletedMin: "7",
      noScoreMin: -3,
      perCourt: { "2": { noScoreMin: 30 }, bad: { noScoreMin: 1 }, "9": {} },
    })
    expect(t.afterCompletedMin).toBe(7)
    expect(t.noScoreMin).toBe(0)
    expect(t.perCourt["2"]).toEqual({ noScoreMin: 30 })
    expect(t.perCourt["bad"]).toBeUndefined()
    expect(t.perCourt["9"]).toBeUndefined()
  })

  it("resolveTriggers overlays only the overridden keys", () => {
    const base: MediaTriggers = { ...DEFAULT_MEDIA_TRIGGERS, afterCompletedMin: 5, perCourt: { "3": { noScoreMin: 30 } } }
    const resolved = resolveTriggers(base, 3)
    expect(resolved.afterCompletedMin).toBe(5) // base preserved
    expect(resolved.noScoreMin).toBe(30) // overridden
    expect(resolved.stopOnAnyScore).toBe(true)
    expect(resolveTriggers(base, 4)).toBe(base) // untouched court → same config
  })

  it("normalizeBumper drops non-positive rules", () => {
    expect(normalizeBumper({ afterEveryN: 0, minIntervalSec: -5, bumperItemId: "x" })).toEqual({
      afterEveryN: null,
      minIntervalSec: null,
      bumperItemId: "x",
    })
    expect(normalizeBumper(undefined)).toEqual({ afterEveryN: null, minIntervalSec: null, bumperItemId: null })
  })
})

describe("media-core — evaluateMediaState (auto triggers)", () => {
  const match = (over: Partial<Parameters<typeof evaluateMediaState>[1]> = {}) => ({
    id: "m1",
    isCompleted: false,
    matchEndedAt: null,
    lastScoreAt: 1000,
    ...over,
  })

  it("starts after afterCompletedMin once per completed match", () => {
    const ended = { id: "m1", isCompleted: true, matchEndedAt: 10 * MIN, lastScoreAt: 9 * MIN }
    let s = evaluateMediaState(emptyMediaState(1), ended, DEFAULT_MEDIA_TRIGGERS, 15 * MIN)
    expect(s.isPlaying).toBe(false) // only 5 of 10 minutes passed
    s = evaluateMediaState(s, ended, DEFAULT_MEDIA_TRIGGERS, 20 * MIN)
    expect(s.isPlaying).toBe(true)
    expect(s.source).toBe("completed")
    expect(s.lastCompletedShownFor).toBe("m1")
    // Stopped (e.g. max-session) → cooldown prevents an instant restart, and
    // even after the cooldown the same match never re-triggers.
    const stopped = evaluateMediaState(s, ended, { ...DEFAULT_MEDIA_TRIGGERS, cooldownAfterStopMin: 0 }, 21 * MIN + 1)
    expect(stopped.isPlaying).toBe(true) // still playing (no stop condition yet)
    const hidden = applyManualHide(stopped, 21 * MIN)
    const again = evaluateMediaState(hidden, ended, { ...DEFAULT_MEDIA_TRIGGERS, cooldownAfterStopMin: 0 }, 40 * MIN)
    expect(again.isPlaying).toBe(false) // one session per completed match
  })

  it("idle trigger: no score change for noScoreMin", () => {
    const live = match({ lastScoreAt: 0 })
    let s = evaluateMediaState(emptyMediaState(1), live, DEFAULT_MEDIA_TRIGGERS, 10 * MIN)
    expect(s.isPlaying).toBe(false) // 10 < 15
    s = evaluateMediaState(s, live, DEFAULT_MEDIA_TRIGGERS, 16 * MIN)
    expect(s.isPlaying).toBe(true)
    expect(s.source).toBe("idle")
  })

  it("no-match trigger counts from the last time a match was seen", () => {
    const triggers = { ...DEFAULT_MEDIA_TRIGGERS, noMatchMin: 5 }
    let s = evaluateMediaState(emptyMediaState(1), match(), triggers, 0)
    expect(s.isPlaying).toBe(false)
    expect(s.lastMatchSeenAt).toBe(0)
    s = evaluateMediaState(s, null, triggers, 4 * MIN)
    expect(s.isPlaying).toBe(false)
    s = evaluateMediaState(s, null, triggers, 6 * MIN)
    expect(s.isPlaying).toBe(true)
    expect(s.source).toBe("no-match")
  })

  it("manualOnly disables every automatic trigger", () => {
    const ended = { id: "m1", isCompleted: true, matchEndedAt: 0, lastScoreAt: 0 }
    const s = evaluateMediaState(emptyMediaState(1), ended, { ...DEFAULT_MEDIA_TRIGGERS, manualOnly: true }, 999 * MIN)
    expect(s.isPlaying).toBe(false)
  })

  it("completed beats idle beats no-match", () => {
    const ended = { id: "m1", isCompleted: true, matchEndedAt: 0, lastScoreAt: 0 }
    const all = { ...DEFAULT_MEDIA_TRIGGERS, noMatchMin: 1 }
    const s1 = evaluateMediaState(emptyMediaState(1), ended, all, 60 * MIN)
    expect(s1.source).toBe("completed")
    const s2 = evaluateMediaState(emptyMediaState(1), match({ lastScoreAt: 0 }), all, 60 * MIN)
    expect(s2.source).toBe("idle")
  })
})

describe("media-core — stop conditions", () => {
  const live = { id: "m1", isCompleted: false, matchEndedAt: null, lastScoreAt: 0 }

  it("stopOnAnyScore: a point after the session started hides ads", () => {
    const started = { ...emptyMediaState(1), isPlaying: true, source: "idle" as const, startedAt: 20 * MIN, lastMatchId: "m1" }
    expect(sessionStopReason(started, { ...live, lastScoreAt: 19 * MIN }, DEFAULT_MEDIA_TRIGGERS, 21 * MIN)).toBeNull()
    expect(sessionStopReason(started, { ...live, lastScoreAt: 20 * MIN }, DEFAULT_MEDIA_TRIGGERS, 21 * MIN)).toBe("score")
    expect(sessionStopReason(started, { ...live, lastScoreAt: 21 * MIN }, DEFAULT_MEDIA_TRIGGERS, 21 * MIN)).toBe("score")
    const off = { ...DEFAULT_MEDIA_TRIGGERS, stopOnAnyScore: false }
    expect(sessionStopReason(started, { ...live, lastScoreAt: 22 * MIN }, off, 23 * MIN)).toBeNull()
  })

  it("stopOnNewMatch: a different active match hides ads", () => {
    // Score is stale (5min) relative to the session start (10min) so the
    // score stop does not shadow the new-match reason.
    const started = { ...emptyMediaState(1), isPlaying: true, source: "idle" as const, startedAt: 10 * MIN, lastMatchId: "m1" }
    expect(sessionStopReason(started, { ...live, id: "m2" }, DEFAULT_MEDIA_TRIGGERS, 11 * MIN)).toBe("new-match")
    // A completed match appearing is not a "new match" (the completed trigger owns it).
    expect(sessionStopReason(started, { ...live, id: "m2", isCompleted: true, matchEndedAt: 11 * MIN }, DEFAULT_MEDIA_TRIGGERS, 11 * MIN)).not.toBe("new-match")
    // No previously seen match → nothing to compare against.
    const fresh = { ...started, lastMatchId: null }
    expect(sessionStopReason(fresh, { ...live, id: "m2" }, DEFAULT_MEDIA_TRIGGERS, 11 * MIN)).toBeNull()
  })

  it("maxSessionMin caps the session; loopsLimit is enforced by the client player", () => {
    const started = { ...emptyMediaState(1), isPlaying: true, source: "idle" as const, startedAt: 10 * MIN, lastMatchId: "m1" }
    const triggers = { ...DEFAULT_MEDIA_TRIGGERS, maxSessionMin: 30 }
    expect(sessionStopReason(started, live, triggers, 39 * MIN)).toBeNull()
    expect(sessionStopReason(started, live, triggers, 40 * MIN)).toBe("max-session")
  })

  it("forced session ends at forcedUntil; auto rules may adopt it afterwards", () => {
    const t0 = 100 * MIN
    const old = { ...live, lastScoreAt: 90 * MIN }
    const s0 = applyManualShow(emptyMediaState(1), "remote", t0, 30, "pl1")
    expect(s0.forcedUntil).toBe(t0 + 30 * MIN)
    const still = evaluateMediaState(s0, old, DEFAULT_MEDIA_TRIGGERS, t0 + 29 * MIN)
    expect(still.isPlaying).toBe(true)
    expect(still.source).toBe("remote")
    // At forcedUntil with a fresh score the session dies (score stop first).
    const dead = evaluateMediaState(s0, { ...old, lastScoreAt: t0 + 25 * MIN }, DEFAULT_MEDIA_TRIGGERS, t0 + 31 * MIN)
    expect(dead.isPlaying).toBe(false)
    // At forcedUntil with a long-idle court the session survives as "idle".
    const adopted = evaluateMediaState(s0, { ...old, lastScoreAt: 0 }, DEFAULT_MEDIA_TRIGGERS, t0 + 31 * MIN)
    expect(adopted.isPlaying).toBe(true)
    expect(adopted.source).toBe("idle")
    expect(adopted.forcedUntil).toBeNull()
  })

  it("manual hide sets the cooldown window", () => {
    const playing = evaluateMediaState(emptyMediaState(1), { ...live, lastScoreAt: 0 }, DEFAULT_MEDIA_TRIGGERS, 20 * MIN)
    const hidden = applyManualHide(playing, 21 * MIN)
    const restarted = evaluateMediaState(hidden, { ...live, lastScoreAt: 0 }, DEFAULT_MEDIA_TRIGGERS, 25 * MIN)
    expect(restarted.isPlaying).toBe(false) // inside the 10-minute cooldown
    const later = evaluateMediaState(hidden, { ...live, lastScoreAt: 0 }, DEFAULT_MEDIA_TRIGGERS, 32 * MIN)
    expect(later.isPlaying).toBe(true)
  })

  it("returns the same reference when nothing changes (no redundant UPDATEs)", () => {
    const idle = evaluateMediaState(emptyMediaState(1), { ...live, lastScoreAt: 0 }, DEFAULT_MEDIA_TRIGGERS, 20 * MIN)
    const again = evaluateMediaState(idle, { ...live, lastScoreAt: 0 }, DEFAULT_MEDIA_TRIGGERS, 21 * MIN)
    expect(again).toBe(idle)
  })
})

describe("media-core — quota", () => {
  it("rejects uploads past the limit and treats 0 as unlimited", () => {
    expect(quotaCheck({ usedBytes: 900, limitBytes: 1000 }, 50).ok).toBe(true)
    expect(quotaCheck({ usedBytes: 900, limitBytes: 1000 }, 200).ok).toBe(false)
    const unlimited = quotaCheck({ usedBytes: 10 ** 12, limitBytes: 0 }, 10 ** 9)
    expect(unlimited.ok).toBe(true)
    expect(unlimited.remainingBytes).toBe(Number.POSITIVE_INFINITY)
  })
})

describe("media-core — row mapping", () => {
  it("state row round-trips through mediaStateToRow/mediaStateFromRow", () => {
    const s = applyManualShow(emptyMediaState(3), "manual", 1000, 5)
    const row = mediaStateToRow(s)
    expect(row).toMatchObject({ court_number: 3, is_playing: true, trigger_source: "manual" })
    const back = mediaStateFromRow(row, 3)
    expect(back.startedAt).toBe(1000)
    expect(back.forcedUntil).toBe(1000 + 5 * MIN)
    expect(back.source).toBe("manual")
  })

  it("lastScoreAtFromMatchRow prefers the newest point event, falls back to updated_at", () => {
    const withEvents = {
      updated_at: "2026-01-01T00:00:00Z",
      extras: { events: [{ type: "point", at: "2026-01-01T00:01:00Z" }, { type: "toss", at: "2026-01-01T00:02:00Z" }] },
    }
    expect(lastScoreAtFromMatchRow(withEvents)).toBe(Date.parse("2026-01-01T00:01:00Z"))
    expect(lastScoreAtFromMatchRow({ updated_at: "2026-01-01T00:03:00Z" })).toBe(Date.parse("2026-01-01T00:03:00Z"))
    expect(lastScoreAtFromMatchRow({})).toBeNull()
  })
})
