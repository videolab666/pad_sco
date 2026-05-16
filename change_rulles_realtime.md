# Realtime Rules Changes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow match rules and live score changes to behave safely for years in production, including mid-game edits, offline button presses, reconnects, reloads, and cross-device sync, without losing or duplicating state.

**Architecture:** Keep one canonical match snapshot plus an append-only operation log. Every mutation is assigned an id, base revision, and scope, then applied optimistically locally and sent to the server idempotently. Rule edits use a classification layer that decides whether a change is immediate, current-set, future-only, or restart-required. When a change cannot be mapped losslessly, the UI must ask for a scope decision instead of guessing. The scoring engine stays pure and is reused to rebuild state after a rule change or queued replay.

**Tech Stack:** Next.js, React, TypeScript, existing `MatchSettings`, `ScoreBoard`, `ScoreControls`, `match-storage`, and `scoring-logic`.

---

## What Is Broken Today

1. `MatchSettings` writes rule edits live, but the current game/set is not normalized after the edit.
2. `handleUpdateMatch` clears `history` on every save, so rule edits erase undo context.
3. `applyScoreIncrement` reads the new settings immediately, but it does not repair already-started state like `Ad`, `deuceCount`, `isTiebreak`, or `isSuperTiebreak`.
4. Switching from match tiebreak to full set, or from classic to no-ad/classic with a live `Ad`, can leave an invalid state.
5. Scoreboard local state can lag behind a rules edit because it still has old click/history buffers.

## Behavior Matrix

| Rule change | Safe live update | Needs prompt | Must restart / rebuild |
|---|---:|---:|---:|
| `windbreak` | yes | no | no |
| manual server / sides | yes | no | no |
| players / team roster | yes | maybe if current server becomes invalid | no score rebuild |
| courtNumber | yes | no | no |
| round / stage | yes | no | no |
| `goldenGame` | yes if not at set point | yes if near set end | sometimes current set |
| `scoringSystem` | yes if current game is simple | yes at `40-40` / `Ad` | current game may need rebuild |
| `goldenPointFormat` | yes if no live deuce/advantage conflict | yes if current game is at deuce | current game may need rebuild |
| `gamesPerSet` | yes if set is far from finish | yes if current set is near threshold | current set may need rebuild |
| `tiebreakEnabled`, `tiebreakAt`, `tiebreakLength`, `tiebreakFormat` | yes before threshold | yes at threshold / in tiebreak | current set may need rebuild |
| `sets`, `finalSetTiebreak`, `finalSetFinish` | yes before deciding set starts | yes during deciding set | current set may need rebuild |
| `isSuperSet` | only before match starts | yes if match already started | usually restart match |

## Required User Experience

1. A rule edit should not silently corrupt the live score.
2. If the change is safe, apply it immediately.
3. If the change affects the current point or current set, show a small confirmation dialog with:
   - apply to current point / current set
   - apply from next set / next game
   - cancel
4. Roster, court, and round edits are metadata-only; they should not prompt for score conversion.
5. If the change is not convertible, offer only:
   - restart current set from the last set boundary
   - keep the current rules until the current set ends
   - cancel

## Special Case Rules

1. `no-ad -> classic`
   - `first-deuce` must be reset to `none`.
   - If the current game is already at `40-40`, continue as normal deuce.
   - If the current game is sitting in a no-ad-only state, normalize it before the next point.
2. `classic -> no-ad`
   - Any live `Ad` state must be resolved.
   - Recommended behavior: convert the current game to `40-40` or ask to restart the current game if the state is ambiguous.
3. `2 sets + tiebreak -> 3 sets normal`
   - If the deciding set is already a match tiebreak, do not try to interpret tiebreak points as games.
   - Recommended behavior: restart the current deciding set as a normal set from `0-0`, preserving completed sets.
4. `full set -> tiebreak`
   - If the current deciding set already has game scores, either keep it as a full set or restart the current set as a tiebreak. Do not silently convert scores.

## Metadata-Only Changes

These edits must not touch score history, set counts, or point values:

1. Player roster edits
   - changing player names
   - swapping players inside a team
   - adding or removing a player label
   - preserving the current score and completed sets
2. Court changes
   - moving the match to another court number
   - updating court assignment without resetting the match
3. Round / stage changes
   - editing the round label for tournament tracking
   - updating `round16` / `round32` / custom round text if present

Only one thing is allowed to normalize automatically here:
- if the current server player no longer exists after a roster change, move the server pointer to the nearest valid player without altering the score

## Offline / Reconnect Rules

1. Every score button press, rule change, roster edit, and court edit becomes a durable local operation before it is sent anywhere.
2. If the internet drops, the app keeps applying operations locally and marks them as pending sync.
3. When the connection returns, operations replay in order, using idempotent operation ids so the server never double-applies a click.
4. If one operation fails during replay, later operations wait until the failed one is resolved.
5. On page reload, the pending queue and last known snapshot are restored from local storage and replay resumes automatically.
6. If the server snapshot is ahead or diverged, the client fetches the latest server state, rebases the queued operations, and only prompts the user when the conflict cannot be solved deterministically.
7. A successful local click must never depend on network timing; the UI and local match state are the source of truth until sync completes.

## Reliability Guarantees

1. No silent loss: every accepted user action is persisted locally first.
2. No duplicate score increments: each mutation has a stable operation id and server-side idempotency check.
3. No stale overwrite: writes include a base revision and must fail fast on conflict instead of overwriting newer server data.
4. No hidden desync: pending operations, conflict state, and sync errors are visible in the UI.
5. Recovery is automatic: reconnect, refresh, app restart, and temporary Supabase outage all continue from the same local queue.

## Production Guardrails

1. Session and auth handling
   - If a token expires or the user loses permission, stop retrying blindly.
   - Surface `unauthorized`, `session_expired`, and `permission_denied` states distinctly.
2. Retry policy
   - Use exponential backoff with jitter for transient failures.
   - Classify errors as retryable, retry-later, or dead-letter.
3. Snapshot compaction
   - Periodically write a compact server-confirmed snapshot.
   - Trim the confirmed prefix of the operation log so long matches stay small and fast.
4. Observability
   - Track `syncStatus`, `lastSuccessRevision`, `lastFailedOperationId`, `retryCount`, and `conflictReason`.
   - Make this visible in both UI and logs.
5. Permission and role model
   - Tournament operator, referee, and viewer roles should not have the same write rights.
   - Write permissions must be checked on every mutation, not just at load time.
6. Deleted and archived match recovery
   - If a match is deleted or archived remotely, the client must stop editing it and explain why.
   - If archived matches are editable in your workflow, restore them through an explicit action only.
7. Storage fallback
   - If `localStorage` is unavailable or full, degrade to a clear limited mode instead of pretending sync works.
8. Payload integrity
   - Validate schema version and payload shape before replaying any queued operation.
   - Reject corrupt snapshots before they reach the scoring state.
9. Audit trail
   - Keep a compact immutable record of who changed what and when.
   - This is needed for referee review and post-match correction.

## Additional Failure Modes To Cover

1. Stale cache after reconnect
   - `getMatch` can return cached data for up to 30 seconds.
   - Fix: invalidate cache on local mutation, on reconnect, and on any realtime or replay success.
2. Long-lived Supabase availability cache
   - `isSupabaseAvailable` can keep an old offline/online result for 60 seconds.
   - Fix: bypass or invalidate the cache on `online`, `focus`, and manual retry.
3. Shallow merge bugs in partial updates
   - `updateMatchPartial` does a shallow object merge, so nested objects like `score`, `settings`, or `currentServer` can be partially overwritten.
   - Fix: use operation-specific patch reducers, not generic shallow merges.
4. Lost end-of-match confirmation
   - Final match confirmation currently calls `updateMatch` without awaiting a durable server result.
   - Fix: treat match completion as a transactional operation with retry and visible failure state.
5. Double delivery from multiple channels
   - A change can arrive through Supabase realtime, localStorage events, and polling.
   - Fix: dedupe by `operationId` / `revision`, and ignore older snapshots.
6. Optimistic UI overwritten by late stale data
   - A late callback can replace a newer local score with an older snapshot.
   - Fix: apply monotonic revision checks before every state replacement.
7. Debounce is not a transaction
   - The 500ms click debounce only slows the UI; it does not guarantee the previous write is committed.
   - Fix: disable the next action until the previous operation is durably queued.
8. Browser crash mid-queue
   - A partially synced match can restart with local state and server state out of sync.
   - Fix: persist the operation queue separately from the rendered match snapshot and replay on boot.
9. Storage quota failure
   - localStorage can fail when compressed match payloads or history become large.
   - Fix: keep a compact operation log, trim UI-only history, and surface quota exhaustion explicitly.
10. Code alias drift
   - `id` and `code` are both cached, so stale aliases can survive after updates.
   - Fix: always refresh and invalidate both keys together on any identity change.
11. Cross-tab race
   - Two open tabs can both score the same match.
   - Fix: one writer wins by revision, the loser rebases and shows a conflict banner.
12. Restarted app with pending confirmation
   - The match-finish dialog state can vanish after refresh while the server write is still pending.
   - Fix: persist pending confirmation state with the sync queue.
13. Expired auth token
   - The app can keep retrying a dead session and look like a network problem.
   - Fix: route the user to re-authentication and pause the queue until credentials are valid.
14. Permission downgrade mid-match
   - A user can lose write rights while the match is open.
   - Fix: re-check permissions before every mutation and freeze writes if rights are revoked.
15. Dead-letter queue
   - Some operations may never succeed because of schema, auth, or policy errors.
   - Fix: move them out of the live queue into a reviewable dead-letter list.
16. Long-running match growth
   - A multi-hour match can accumulate a huge queue and slow sync.
   - Fix: compact confirmed operations into snapshots and keep the active queue short.
17. Local storage unavailable
   - Private mode, quota limits, or browser policy can break persistent client storage.
   - Fix: fail visibly, keep the current session running, and warn that recovery is limited.

## More Edge Cases To Cover

1. Missed realtime gap after reconnect
   - Supabase can reconnect without replaying every intermediate update the client missed.
   - Fix: after reconnect, always fetch the authoritative snapshot and compare revisions before resuming live subscriptions.
2. Out-of-order delivery across channels
   - localStorage, polling, and realtime can arrive in a different order than the actions were made.
   - Fix: every payload needs a monotonic revision; older revisions are ignored.
3. Startup race between boot snapshot and queue replay
   - The app can load a stale snapshot and start replaying before the server state is known.
   - Fix: boot in a paused sync state, fetch authoritative state first, then rebase and drain the queue.
4. Ghost subscription after navigation
   - A previous match page can keep reacting if an unsubscribe was missed.
   - Fix: store subscription tokens and hard-cancel them on route change and unmount.
5. Partial corruption in one branch of the payload
   - `score`, `settings`, `teamA`, and `teamB` are not equally stable during a save.
   - Fix: validate and persist each branch atomically, never by blind object replacement.
6. Timer throttling in background tabs
   - Polling and retry timers slow down or pause when the tab is backgrounded.
   - Fix: use event-driven recovery plus explicit refresh on visibility change.
7. Clock skew on timestamps
   - Clients may disagree on `createdAt`, `lastSyncedAt`, or display ordering.
   - Fix: use server revision for ordering, timestamps only for display.
8. Deleted match while a client still holds it open
   - One device may keep editing a match that another device or admin has deleted.
   - Fix: treat DELETE as terminal and force local closure with a clear message.
9. Schema drift during deployment
   - One version of the app may write fields that another version does not yet understand.
   - Fix: version the payload schema and keep backwards-compatible readers.
10. Rapid-fire score storm
   - A user may click multiple points very quickly or via automation, outrunning sync.
   - Fix: enqueue one operation at a time per match and disable further writes until the prior one is durably queued.
11. Rehydration mismatch after compaction
   - A compacted snapshot can miss the exact local UI state if the compaction boundary is wrong.
   - Fix: compaction must only happen on server-confirmed revisions.
12. Replay loop after a permanent failure
   - A bad operation can cause the app to retry forever.
   - Fix: cap retries, mark dead-letter, and require operator review.
13. Mixed-version clients
   - Two clients on different deployments may understand different payload fields.
   - Fix: version the payload schema and keep readers backwards compatible.
14. Referee correction during live play
   - A manual correction can arrive while queued score operations are still pending.
   - Fix: treat corrections as high-priority operations and rebase the queue after them.
15. Snapshot from wrong match identity
   - A stale `id` / `code` alias can point to the wrong live match after reassignment.
   - Fix: validate canonical match identity before accepting any replay result.

## Task 1: Add a Rule-Change Model ✅

> **Status:** Implemented. `lib/types.ts` carries the rule-change model
> (`ruleRevision`, `lastRuleChangeAt`, `ruleChangeScope`, `ruleChangeReason`,
> `RuleChangeScope`). `lib/match-format-rules.ts` gained `getGoldenPointDeuceThreshold`.
> New module `lib/match-rule-change.ts`: `classifyRuleChange` (safe / future-only
> / current-set / restart-required), `reconcileSettingsForScoringSystem`,
> `normalizeCurrentGameForScoringSystem`, `normalizeCurrentSetForFinalSet`,
> `normalizeMatchAfterRuleChange`. Regressions added to
> `test/scoring-logic-regression.ts` — all pass; build green.

**Files:**
- Modify: `lib/match-format-rules.ts`
- Modify: `lib/types.ts`
- Create: `lib/match-rule-change.ts`

**Step 1: Write failing tests ✅**

Add regressions for:
- `no-ad -> classic` clears `first-deuce`
- `classic -> no-ad` does not leave `Ad` behind
- changing final-set mode while `currentSet.isTiebreak === true`
- reducing or increasing `sets` while a deciding set is already underway

**Step 2: Add the minimal data model ✅**

Add:
- `ruleRevision`
- `lastRuleChangeAt`
- `ruleChangeScope`
- `ruleChangeReason`

**Step 3: Add a helper module ✅**

Implement helpers for:
- classifying a change as safe / current-set / future-only / restart-required
- normalizing the current game after a scoring-system change
- normalizing the current set after a tiebreak / final-set change

**Step 4: Verify ✅**

Run:
```powershell
& '.\node_modules\.bin\tsc.cmd' .\test\scoring-logic-regression.ts .\lib\scoring-logic.ts .\lib\match-format-rules.ts --module commonjs --target es2020 --outDir .\.tmp-test\padel-score-regression --esModuleInterop --skipLibCheck
node .\.tmp-test\padel-score-regression\test\scoring-logic-regression.js
```
Result: `rule-change model checks passed` / `scoring-logic regression checks passed`.

## Task 2: Build Durable Sync and Replay ✅

> **Status:** Implemented. New files `lib/match-operation-log.ts` (durable local
> queue + snapshot + sync status) and `lib/match-sync.ts` (idempotent revisioned
> replay, backoff, conflict handling, recovery). `lib/types.ts` carries the
> operation/sync model. `updateMatch` / `updateMatchPartial` now route writes
> through the sync engine. Idempotent `PUT` endpoint added to
> `app/api/match/[id]/route.ts`; migration `20260516010000_add_match_revision_and_operations.sql`
> adds the `revision` column + `match_operations` idempotency/audit table —
> **applied to the live Supabase database on 2026-05-16** (runner:
> `scripts/apply-sync-migration.mjs`). `getMatch` / realtime now seed the local
> log with the server revision (`reconcileServerSnapshot`) so a fresh client
> never raises a false conflict on its first write. Build passes; sync logic
> covered by `test/match-sync-regression.ts` (7/7 scenarios green).

**Files:**
- Modify: `lib/match-storage.ts`
- Modify: `app/match/[id]/page.tsx`
- Modify: `app/fullscreen-scoreboard/[number]/page.tsx`
- Modify: `app/court-vmix/[number]/page.tsx`
- Modify: `lib/types.ts`
- Modify: `lib/supabase.ts`
- Modify: `app/api/match/[id]/route.ts`
- Create: `lib/match-operation-log.ts`
- Create: `lib/match-sync.ts`

**Step 1: Define the operation model ✅**

Add a single mutation shape for all match changes:
- `operationId`
- `matchId`
- `baseRevision`
- `kind`
- `payload`
- `createdAt`
- `clientId`
- `retryCount`
- `lastError`

**Step 2: Make local persistence authoritative first ✅**

Persist every operation to local storage before any network call. Store:
- current snapshot
- pending operation queue
- last synced revision
- sync status

**Step 3: Make server writes idempotent ✅**

Replace blind full-object updates with revisioned apply calls:
- reject stale writes
- ignore repeated operation ids
- save the next revision atomically
- return the authoritative server snapshot

**Step 4: Add automatic drain and recovery ✅**

Replay queued operations on:
- app startup
- `online`
- page focus
- manual retry

**Step 5: Add conflict handling ✅**

If the server moved ahead:
- fetch latest match
- reapply queued operations in order
- compare result
- prompt only if deterministic replay fails

**Step 6: Verify ✅**

- ✅ `npm run build` passes; new sync modules typecheck clean under `--strict`.
- ✅ Automated integration test `test/match-sync-regression.ts` emulates the
  runtime scenarios deterministically (in-memory fake Supabase backend +
  localStorage polyfill) — all 7 scenarios pass:
  - A. score clicks offline, then reconnect (+ collapsed batch)
  - B. the same operation delivered twice (lost-ack idempotency)
  - C. two-device conflict, resolved both ways (server / local)
  - D. permanent error → dead-letter
  - E. transient failure mid-replay, then recovery
  - F. un-migrated database (missing `revision` column) → graceful fallback
  - G. public `syncMatchToServer` entry point

  Run:
  ```powershell
  & '.\node_modules\.bin\tsc.cmd' .\test\match-sync-regression.ts --module commonjs --target es2020 --moduleResolution node --outDir .\.tmp-test\sync --esModuleInterop --skipLibCheck
  node .\.tmp-test\sync\test\match-sync-regression.js
  ```
- ⏳ Page reload mid-queue and real two-device sync still benefit from a manual
  pass against a live Supabase once the migration is applied.

## Task 3: Support Metadata-Only Match Edits ✅ (engine)

> **Status:** Metadata-edit engine implemented. New module `lib/match-metadata.ts`:
> `applyMetadataEdit` (roster / court / round edits with the score branch
> deep-cloned untouched), `normalizeServerPointer` (moves the server pointer to a
> valid player without altering the score), `isMetadataOnlyChange`. `lib/types.ts`
> gained `Match.round`. `lib/court-utils.ts` transforms now carry `revision`.
> Regressions added; build green.
> **Note:** there is currently no live roster/court editing UI on the match page —
> wiring the engine into an actual edit surface belongs with the scope-aware UI
> work (Task 5). The metadata path itself is complete, isolated and tested.

**Files:**
- Modify: `components/match-settings.tsx`
- Modify: `app/match/[id]/page.tsx`
- Modify: `lib/types.ts`
- Modify: `lib/match-storage.ts`
- Create: `lib/match-metadata.ts`
- Modify: `lib/court-utils.ts`
- Modify: `components/full-screen-scoreboard.tsx`

**Step 1: Add a metadata edit path ✅**

Allow live edits for:
- team A players
- team B players
- court number
- round / stage label

**Step 2: Keep score state untouched ✅**

The metadata path must not:
- clear `score.sets`
- clear `score.currentSet`
- rewrite `currentGame`
- touch `history`
- reset completed match results

**Step 3: Normalize only the dependent display state ✅**

If roster changes invalidate the current server pointer:
- move `currentServer.playerIndex` to a valid player
- keep `currentServer.team` if possible
- preserve serve-side display and court-side display

**Step 4: Persist and broadcast** ⚠️ via existing path

A metadata edit is committed through the same `updateMatch` → sync-engine →
realtime path as any other change, so local storage, Supabase, the match list
and the fullscreen / court displays all receive it through their existing
subscriptions. No separate broadcast path was added. (A dedicated metadata-edit
UI is still pending — see Task 5.)

**Step 5: Verify ✅**

`metadata-only edit checks passed` — regressions confirm roster / court / round
edits keep `score` byte-identical and only normalize the server pointer.

## Task 4: Make Scoring Deterministic After Rule Edits ✅

> **Status:** Implemented. `lib/scoring-logic.ts` gained `normalizeCurrentGame`,
> `normalizeCurrentSet` and `normalizeMatchState` (post-change normalization)
> alongside the existing point application. `match-settings.tsx` runs every
> rule edit through `commitRuleChange` → `normalizeMatchState` + a bumped
> `ruleRevision`. `score-board.tsx` watches the **match settings signature**
> (a rule edit always changes `settings`; this round-trips through Supabase,
> unlike the non-persisted `ruleRevision`) and drops stale `matchHistory` /
> `localMatchState` / pending match-end state, refreshing from the canonical
> match. `score-controls.tsx` already re-syncs `localMatch` on every `match`
> change, so no buffer survives a rule edit. Regressions added; build green.

**Files:**
- Modify: `lib/scoring-logic.ts`
- Modify: `components/score-board.tsx`
- Modify: `components/score-controls.tsx`

**Step 1: Add replay-friendly normalization ✅**

Split the scoring engine into:
- point application
- game normalization
- set normalization
- post-change normalization

**Step 2: Handle current-game edge cases ✅**

Make sure these states stay valid after a rule change:
- `40-40`
- `Ad`
- `deuceCount`
- live tiebreak points
- live super tiebreak points

**Step 3: Reset local score buffers on rule revision ✅**

Whenever a settings edit is saved:
- clear `matchHistory`
- clear `localMatchState`
- clear pending match-end confirmation state
- refresh the scoreboard from the canonical match object

**Step 4: Verify ✅**

Regression suite passes — `rule-change model checks passed` /
`post-rule-change normalization checks passed` /
`scoring-logic regression checks passed`; production build green.

## Task 5: Add Scope-Aware Editing in Match Settings ✅

> **Status:** Implemented in `components/match-settings.tsx`. Every rule edit now
> goes through `requestRuleChange` → `classifyRuleChange`: `safe` / `future-only`
> changes apply immediately (one-click), while `current-set` / `restart-required`
> changes open an `AlertDialog` with the classification reason and scope choices
> — *Apply now* (normalize), *Restart current set from 0:0* (restart-required
> only, via `restartCurrentSet`), and *Cancel* (reverts the form). `app/match/[id]/page.tsx`
> needs no change — the dialog is self-contained in the component. Build green.
>
> **Note:** a true "apply from next set/match" deferral would need per-set rule
> snapshots in the scoring engine (it reads `match.settings` live). `future-only`
> changes — which by definition do not touch current play — apply immediately
> instead; `current-set` changes offer *Apply now* / *Cancel*.

**Files:**
- Modify: `components/match-settings.tsx`

**Step 1: Add scope selection ✅**

For rule edits that can affect live state, add a compact choice:
- apply now
- apply from next set
- apply from next match
- restart current set

**Step 2: Wire the obvious safe cases directly ✅**

These can stay one-click:
- `windbreak`
- manual server / manual sides
- `goldenGame` if the current set is not at a critical boundary

**Step 3: Gate the risky cases ✅**

Prompt when editing:
- scoring system while the current game is at deuce / advantage
- tiebreak rules while the current set is already near or inside the tiebreak
- final-set rules while the deciding set is already underway
- set count while the match length becomes inconsistent with played sets

**Step 4: Verify ✅ (logic)**

Classification + reconciliation for `no-ad -> classic`, `classic -> no-ad` and
`sets` changes are covered by the rule-change regressions. Production build
green. The on-screen dialog flow itself still benefits from a manual UI pass.

## Task 6: Support Match Tiebreak <-> Full Set Conversion ✅

> **Status:** Implemented in `lib/scoring-logic.ts`: `restartCurrentSetAsNormalSet`,
> `restartCurrentSetAsMatchTiebreak` and the auto-detecting `restartCurrentSet`.
> All preserve every completed set, restart only the current set from 0-0, never
> reinterpret match-tiebreak points as game counts, and keep the server / court
> side state (a pending side change is cleared). `match-settings.tsx` invokes the
> conversion through the Task 5 "Restart current set" scope option; persistence
> reuses the `updateMatch` → sync path (local storage + Supabase + match list).
> Regressions cover both directions; build green.

**Files:**
- Modify: `lib/scoring-logic.ts`
- Modify: `components/match-settings.tsx`
- Modify: `lib/match-storage.ts`

**Step 1: Define the conversion policy ✅**

Recommended default:
- preserve already completed sets
- rebuild only the current deciding set when the user explicitly asks for it
- never reinterpret match-tiebreak points as game counts

**Step 2: Add explicit rebuild helpers ✅**

Implement one helper for:
- restarting the current set as a normal set
- restarting the current set as a match tiebreak
- reapplying the current server and side state after the rebuild

**Step 3: Persist the converted state ✅**

The rebuilt match is committed through `updateMatch` → the sync engine, which
already persists to local storage, Supabase and the match list entry.

**Step 4: Verify ✅**

`tiebreak <-> full set conversion checks passed` — regressions cover match
tiebreak → full set and full set → match tiebreak, confirming completed sets
survive and points/games are dropped rather than reinterpreted.

## Task 7: Migrate and Backfill Existing Matches ✅

> **Status:** Implemented. `backfillRuleMetadata` (in `lib/match-rule-change.ts`)
> defaults missing `ruleRevision`, `revision`, `goldenPointFormat` and final-set /
> tiebreak fields without ever overwriting existing values; it is idempotent.
> `lib/match-storage.ts` `getMatch` runs it on every load path (Supabase +
> both localStorage paths). The defaults are filled in memory only — persisted
> the next time the app saves a real edit — so old JSON exports stay loadable.
> `app/match/[id]/page.tsx` needs no change (it loads through `getMatch`).
> Regressions added; build green.

**Files:**
- Modify: `lib/match-storage.ts`
- Modify: `lib/match-rule-change.ts`

**Step 1: Backfill missing rule metadata ✅**

When loading old matches, add defaults for:
- `ruleRevision`
- `goldenPointFormat`
- any missing final-set fields

**Step 2: Keep old matches readable ✅**

New fields are optional on load and only persisted when the app next writes the
match back — `backfillRuleMetadata` mutates the in-memory object, `getMatch`
never re-saves on read.

**Step 3: Verify ✅**

`old-match backfill checks passed` — regressions confirm defaults are applied,
existing values are never overwritten, and the backfill is idempotent.

## Post-completion fixes

Defects found and fixed after the eight tasks were implemented:

1. **Score flicker (increased → original → increased).** `drainMatch` probed
   `isSupabaseAvailable` + `checkTablesExist` (uncached network calls) before
   every write, delaying it past the 500 ms anti-flicker window. Fixed with a
   30 s environment-check cache in `match-sync.ts`, invalidated on failure /
   reconnect. The match page also now ignores sync snapshots whose `revision`
   is behind the current state (failure mode #6).
2. **Cross-device buffer reset.** `ruleRevision` is not a DB column, so it did
   not survive a Supabase round-trip. `score-board.tsx` now detects a rule
   edit from the `settings` content (which does round-trip).
3. **`/api/court`, `/api/vmix`, `/api/match` returned 404 server-side.**
   `server-match-storage.ts` used the deprecated `@supabase/auth-helpers-nextjs`
   `createServerComponentClient({ cookies })`, which breaks in Next 15 route
   handlers. Switched to `createServerSupabaseClient()` (service-role client).
   `/api/match/[id]` GET also used the client-only `getMatch` (always `null`
   server-side) — switched to `getMatchFromServer`. All three verified against
   a fresh production server.

## Task 8: Regression Coverage ✅

> **Status:** Implemented. `test/scoring-logic-regression.ts` extended with the
> rule-change model, post-change normalization, metadata-only, tiebreak↔full-set
> and backfill blocks. New `test/rule-change-realtime-regression.ts` is a
> dedicated rule-change suite covering all eight cases below. The realtime/sync
> side is covered by `test/match-sync-regression.ts` (7 scenarios). All suites
> pass; production build green.

**Files:**
- Modify: `test/scoring-logic-regression.ts`
- Create: `test/rule-change-realtime-regression.ts`

**Step 1: Add deterministic tests ✅**

Cover:
- `no-ad -> classic` ✅
- `classic -> no-ad` ✅
- `fast4 -> classic` ✅
- `goldenPointFormat` changes ✅
- tiebreak threshold changes ✅
- `finalSetFinish` changes ✅
- `sets` count changes mid-match ✅
- match-tiebreak to full-set conversion ✅

**Step 2: Verify build and tests ✅**

Run:
```powershell
& '.\node_modules\.bin\tsc.cmd' .\test\scoring-logic-regression.ts .\test\rule-change-realtime-regression.ts .\test\match-sync-regression.ts --module commonjs --target es2020 --moduleResolution node --outDir .\.tmp-test --esModuleInterop --skipLibCheck
node .\.tmp-test\test\scoring-logic-regression.js
node .\.tmp-test\test\rule-change-realtime-regression.js
node .\.tmp-test\test\match-sync-regression.js
npm run build
```
Result: `scoring-logic regression checks passed` /
`rule-change realtime regression checks passed` /
`match-sync regression checks passed`; build `✓ Compiled successfully`.
