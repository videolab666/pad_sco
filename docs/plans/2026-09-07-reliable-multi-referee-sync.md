# Reliable Multi-Referee Match Sync Implementation Plan

## Implementation and verification status (2026-09-09)

Tasks 1–5 are implemented; Task 6 automated unit/route/build checks pass. Release is **not deployed**. The database migration and a real deployed multi-client smoke test remain release gates.

- Server-authoritative semantic commands, ordered durable outbox, stable operation IDs and revision CAS replace competing whole-match writers. Unknown extras survive compatibility writes; operation markers remain for the lifetime of the match (not just the last 256 operations).
- Optimistic views replay pending commands over current server truth, excluding already acknowledged IDs. Equal-revision rejection snapshots restore the correct UI. Delayed ACKs cannot rewind the cache; transient errors never become fake deletion or success.
- All existing-match scoring controls and fullscreen input use the command path. Commands are enqueued before optional snapshot-cache persistence. Batch edits are one atomic command, and `decrease-point` modifies only the selected team's latest score.
- Completion is terminal except explicit `unlock-match`. Late points/tiebreak/rule writes cannot resurrect a completed match. Automatic side changes occur inside live/replayed point or conduct-stroke transitions, not once per connected referee.
- Undo preserves current court, roster, poster and unknown metadata. Roster edits no longer enter scoring undo; legacy player-edit overrides are treated as metadata. Manual side changes remain replayable.
- Per-command storage keys prevent cross-tab queue overwrites; offline commands are not silently truncated at 500 or dropped after six retries. Pending/rejected status is visible on the match page.
- Match subscriptions recover via 3-second polling plus reconnect/focus; the list recovers via 5-second polling. Empty authoritative lists do not resurrect cached rows. Creation must be acknowledged before navigation and retains canonical UUID/short-code/court/session bindings.
- Court claims are serialized in PostgreSQL. Active lookup cannot fall back to a finished match. Court release retries CAS conflicts, reports partial failures, and does not follow a concurrently reassigned match to a different court.

Verified commands:

- `npm test -- --reporter=dot`: 77 files, 687 tests passed (2026-09-09).
- `npm run build`: production build and TypeScript passed, 51 static pages generated (2026-09-09).
- `npm run typecheck`: passed (2026-09-09).
- `node scripts/test-match-court-claims.mjs --session-port`: passed simultaneous numeric/UUID claims, completion/reuse, unlock/assignment conflicts and legacy duplicate preservation on real PostgreSQL in a disposable isolated schema. The schema was removed; production matches/courts were not read or changed (2026-09-08).
- `python -u scripts/test-multi-referee-browser.py`: passed A→B and B→A scoring, offline queue/reconnect, reload, fullscreen scoring with snapshot-cache failure, and remote completion (2026-09-09). It uses the real production-built UI, two isolated Chromium contexts and intercepted shared backend responses; Realtime is deliberately inert to exercise polling. This is not a deployed Supabase end-to-end test.
- `git diff --check`: passed. Existing Windows CRLF conversion warnings are not whitespace failures.
- Independent review identified cache-before-enqueue loss, transient-read/deletion conflation and undo metadata/side replay bugs; each was fixed and regression-tested. Follow-up conduct-stroke side handling was also fixed.

### Required rollout (not performed)

1. Back up the database and inspect existing duplicate active court bindings. Do not auto-delete or silently finish historical duplicates; resolve them deliberately.
2. Apply `supabase/migrations/20260907000000_match_court_claims.sql` through the normal migration workflow, then deploy the application. The migration preserves old duplicate active matches but prevents new claims against occupied courts.
3. Reload existing referee clients to load the new command transport. Older whole-snapshot clients are conflict-guarded, but do not gain the new multi-referee behavior until refreshed.
4. On a dedicated test court, use two deployed clients: both score, disconnect/reconnect one, finish on the other, retry old pending intent, reload, and explicitly unlock. Verify the shared revision, score, active court and error notices. Also verify live Realtime delivery, not only polling.
5. Rollback must retain revision/idempotency protection. Do not blindly roll back to the old snapshot-rebase client/server or drop the claim invariant while judges are active. Prefer a forward fix; any migration rollback needs an explicit maintenance window.

The transport and court lifecycle are sport-independent. New sports still need their own scoring reducer/invariants and domain tests; no unimplemented sport is claimed to work.

## Original review checklist (2026-09-07)

The command architecture was retained. The following gaps identified during the initial review are addressed by the implementation above.

- Rebase the optimistic display by replaying pending commands over every newer authoritative snapshot. An intermediate ACK must not remove later pending clicks; another referee's realtime update must remain visible while local commands are pending.
- Rejected commands must adopt the server state, leave a visible failure, and allow subsequent valid commands to drain. Transport requests need timeouts; missing backend tables must never acknowledge unsent commands.
- Verify real route handlers with an in-memory CAS database: concurrent referees, lost ACK with failed audit insert, stale completed snapshots, and null-revision races.
- The court preflight query alone is insufficient under concurrency. Add a database invariant for new court claims without silently rewriting existing duplicate matches; test and document the migration requirement.
- Preserve extended state in court lookups; ensure realtime subscriptions recover through polling/reconnect and do not leak on unmount.
- Fix creation failure reporting and preserve court/session bindings. Do not present a local-only ghost as a successfully created shared match.
- Finish full tests, typecheck, production build and diff review. Record what was verified locally versus deployed.

Implementation substitutions: terminal guards live in the route/reducer rather than a separate `match-transition-invariants.ts`; atomic operation markers live in `lib/match-operation-id.ts`. The old one-shot command helper may remain for compatibility; production UI uses the durable outbox.

**Goal:** Make the server the authoritative match state so multiple referees can safely score and edit the same match without lost points, stale overwrites, match resurrection, or phantom sets.

**Architecture:** Existing matches are mutated by durable, idempotent semantic commands. Clients may render optimistic state, but only a server response or realtime snapshot advances the authoritative revision. Legacy full-snapshot writes remain guarded for compatibility and are never automatically rebased over newer server state.

**Tech Stack:** Next.js route handlers, TypeScript, React hooks, Supabase/Postgres, Vitest, localStorage durable outbox, Supabase Realtime.

---

### Task 1: Protect server state transitions and idempotency

**Files:**
- Create: `lib/match-transition-invariants.ts`
- Modify: `lib/match-extended-state.ts`
- Modify: `app/api/match/[id]/route.ts`
- Modify: `app/api/match/[id]/command/route.ts`
- Test: `test/match-transition-invariants.test.ts`

1. Write failing tests proving a completed match cannot become active through a snapshot or any command except `unlock-match`.
2. Write a failing test proving an operation id stored with the match survives an audit-log insert failure and is recognized on retry.
3. Run the focused tests and confirm the expected failures.
4. Add a match-lifetime `appliedOperationIds` list inside `matches.extras`, written atomically with the match row.
5. Add transition validation before PUT/command writes and preserve unknown/current extras during compatibility snapshot writes.
6. Run the focused tests and confirm they pass.

### Task 2: Replace unsafe snapshot conflict rebasing with a durable command outbox

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/match-operation-log.ts`
- Modify: `lib/match-sync.ts`
- Modify: `lib/match-command-client.ts`
- Test: `test/match-sync-api-transport.test.ts`
- Test: `test/match-command-client.test.ts`

1. Replace the existing test that expects stale snapshot rebasing with a failing regression test: a stale active snapshot must be discarded in favor of a newer completed server snapshot and must never be PUT again.
2. Add failing tests for ordered command delivery, stable operation ids, offline retention, conflict retry, and authoritative response snapshots.
3. Add `command` operations to the durable local queue and drain them sequentially without collapsing.
4. Keep transient command failures queued indefinitely with bounded exponential backoff; dead-letter only permanent invalid operations.
5. On snapshot conflict, adopt the server snapshot and remove the stale snapshot instead of changing its base revision.
6. Publish authoritative command/snapshot acknowledgements to mounted hooks.
7. Run focused sync tests.

### Task 3: Make the React hook own optimistic and authoritative state

**Files:**
- Modify: `hooks/use-match.ts`
- Modify: `lib/match-storage.ts`
- Test: `test/use-match.test.tsx`

1. Write failing tests proving `localOnly` does not invent a server revision, command updates enter the durable outbox, and an authoritative ACK/realtime update replaces optimistic state.
2. Extend `updateMatch` options with `{ command, args, clientId }`.
3. Enqueue the semantic command before persisting optional local optimism, without a snapshot push or revision bump.
4. Track pending command state separately from server revision and accept newer server snapshots from other referees.
5. Run hook tests.

### Task 4: Route every match-page mutation through semantic commands

**Files:**
- Modify: `lib/remote-commands.ts`
- Modify: `components/score-board.tsx`
- Modify: `components/score-controls.tsx`
- Modify: `components/match-settings.tsx`
- Modify: `components/adjust-score-dialog.tsx`
- Modify: `components/end-match-dialog.tsx`
- Modify: extended controls under `components/`
- Test: `test/remote-commands.test.ts`
- Test: component tests under `test/components/`

1. Add failing reducer tests for tiebreak start/end, timers, timeouts, handicap, Power Play, new balls, rally statistics, official calls, result-poster settings/audit, journal repair, and tiebreak choice.
2. Implement each command by calling the existing pure domain helper on the latest server match.
3. Convert every existing-match `updateMatch(...)` call to `{ command, args }`; retain raw snapshots only for match creation/import.
4. Remove direct fire-and-forget command calls and double revision bumps from scoreboard flows.
5. Confirm a match completed by the final point treats `finish` as idempotent and cancel uses only `unlock-match` after the point command is ordered.
6. Run reducer and component tests.

### Task 5: Align fullscreen and court lifecycle behavior

**Files:**
- Modify: `app/fullscreen-scoreboard/[number]/page.tsx`
- Modify: `lib/court-utils.ts`
- Modify: `lib/server-match-storage.ts`
- Modify: `app/api/courts/free/route.ts`
- Test: court/fullscreen-related tests

1. Route fullscreen scoring through the same durable command outbox.
2. Separate active-match lookup from last-completed-result lookup so a closed match cannot masquerade as active.
3. Make court release report partial conflicts as failure and retry against the fresh revision rather than returning success after only one row.
4. Add a migration/invariant preventing more than one active match per canonical court where the existing schema permits it.
5. Run court tests.

### Task 6: Verify concurrency, compatibility, and build

**Files:**
- Create or modify integration tests under `test/`

1. Run the two-referee interleaving test: A point, B point, A finish, stale B metadata change.
2. Verify both points are present, completion remains terminal, and no third set/tiebreak appears.
3. Run lost-response/idempotency and offline-replay tests.
4. Run all Vitest tests.
5. Run `npm run typecheck`.
6. Run `npm run build`.
7. Inspect `git diff --check`, the final diff, and working-tree status; preserve unrelated user files.
