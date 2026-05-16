# Unified Scoring Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate all scoring logic (applyScoreIncrement, isGamePoint, isSetPoint, isMatchPoint, getImportantPoint) into a single `lib/scoring-logic.ts`, fix all known bugs, and replace duplicated code in score-board.tsx, fullscreen-scoreboard, and vmix.

**Architecture:** Single source of truth in `lib/scoring-logic.ts`. All components import from there. score-board.tsx keeps only UI state and the confirmation dialog interceptor. No logic duplication.

**Tech Stack:** TypeScript, Next.js 14, React. No new dependencies.

---

## Current State (read before touching anything)

### Files to modify:
- `lib/scoring-logic.ts` — Engine A (only applyScoreIncrement + helpers)
- `components/score-board.tsx` — Engine B (embedded: winGame, winSet, switchServer, isGamePointIndicator, isSetPointIndicator, isMatchPointIndicator, getImportantPointIndicator)
- `app/fullscreen-scoreboard/[number]/page.tsx` — Engine C (embedded: getPointIndex, isGamePoint, isSetPoint, isMatchPoint, getImportantPoint as `const` functions inside component)
- `app/vmix/[id]/page.tsx` — Engine D (module-level: getPointIndex, isGamePoint, isSetPoint, isMatchPoint, getImportantPoint)

### Known bugs to fix during this refactor:
1. **Bug #1** `scoring-logic.ts:74-76` — Classic 40-40 calls `winGame()` instead of setting Ad
2. **Bug #2** `scoring-logic.ts:145` — Super Set 9-8 doesn't end: `teamBScore < 8` should be `teamBScore <= 7`
3. **Bug #3** All files — Tiebreak game point hardcoded at `>= 6`, ignores championship (9) and super tiebreak (9)
4. **Bug #4** `fullscreen-scoreboard` + `vmix` — `isMatchPoint` uses `match.setsToWin || 2` instead of `Math.ceil(match.settings.sets / 2)`
5. **Bug #5** All indicator functions — set winner counted by `set.teamA > set.teamB` instead of `set.winner === "teamA"`
6. **Bug #6** All indicator functions — isSetPoint only checks 5-x and 6-5, misses 7-6, 8-7, etc.
7. **Bug #7** `vmix` `isGamePoint` — doesn't return "both" for No-Ad 40-40 (fullscreen-scoreboard does it correctly)

---

## Task 1: Expand lib/scoring-logic.ts with new exports

**Files:**
- Modify: `lib/scoring-logic.ts`

### Step 1: Fix Bug #1 — Classic 40-40

In `applyScoreIncrement`, in the classic branch (line 74-76), replace:
```typescript
      } else if (currentGame[otherTeam] === 40) {
        // No-Ad / Golden Point behavior: next point wins the game
        return winGame(team, updatedMatch);
```
with:
```typescript
      } else if (currentGame[otherTeam] === 40) {
        // Deuce → Advantage
        currentGame[team] = "Ad";
```

### Step 2: Fix Bug #2 — Super Set 9-8

In `winGame`, in the Super Set block (line 145), replace:
```typescript
      (teamAScore === 9 && teamBScore < 8) ||
      (teamBScore === 9 && teamAScore < 8)
```
with:
```typescript
      (teamAScore === 9 && teamBScore <= 7) ||
      (teamBScore === 9 && teamAScore <= 7)
```

### Step 3: Add helper exports at the END of the file

Append the following exported functions after the existing `switchServer` function:

```typescript
// ─── Exported indicator helpers ───────────────────────────────────────────────

/**
 * Converts a tennis point value (0/15/30/40/"Ad") to a numeric index.
 * Used internally by indicator functions.
 */
export function getPointIndex(point: any): number {
  if (point === "Ad") return 4;
  if (point === 0) return 0;
  if (point === 15) return 1;
  if (point === 30) return 2;
  if (point === 40) return 3;
  if (typeof point === "number" && point > 40) return 4;
  return point;
}

/**
 * Returns the number of points needed to win a tiebreak.
 */
export function getTiebreakPointsToWin(match: any): number {
  const currentSet = match?.score?.currentSet;
  if (
    currentSet?.isSuperTiebreak ||
    (match.settings?.finalSetTiebreak &&
      match.score?.sets?.length + 1 === match.settings?.sets)
  ) {
    return match.settings?.finalSetTiebreakLength || 10;
  }
  if (match.settings?.tiebreakType === "championship") return 10;
  return 7;
}

/**
 * Returns which team has game point (or "both" for No-Ad 40-40 deciding point).
 * Returns false if no game point.
 */
export function isGamePoint(match: any): "teamA" | "teamB" | "both" | false {
  const currentSet = match?.score?.currentSet;
  const currentGame = currentSet?.currentGame;
  if (!currentGame) return false;

  const scoringSystem = match.settings?.scoringSystem || "classic";

  // Tiebreak game point
  if (currentSet.isTiebreak) {
    const ptw = getTiebreakPointsToWin(match);
    const a = typeof currentGame.teamA === "number" ? currentGame.teamA : 0;
    const b = typeof currentGame.teamB === "number" ? currentGame.teamB : 0;
    // Game point: winning next point would win the tiebreak (score+1 >= ptw AND diff >= 2)
    const aWins = a + 1 >= ptw && (a + 1) - b >= 2;
    const bWins = b + 1 >= ptw && (b + 1) - a >= 2;
    if (aWins && bWins) return "both";
    if (aWins) return "teamA";
    if (bWins) return "teamB";
    return false;
  }

  const ai = getPointIndex(currentGame.teamA);
  const bi = getPointIndex(currentGame.teamB);

  // No-Ad / Fast4: 40-40 is deciding point for both
  if (scoringSystem === "no-ad" || scoringSystem === "fast4") {
    if (ai === 3 && bi === 3) return "both"; // 40-40 deciding
    if (ai === 3) return "teamA"; // 40-0/15/30
    if (bi === 3) return "teamB";
    return false;
  }

  // Classic (with Ad)
  if (ai === 4) return "teamA"; // Ad
  if (bi === 4) return "teamB"; // Ad
  if (ai === 3 && bi <= 2) return "teamA"; // 40-0/15/30
  if (bi === 3 && ai <= 2) return "teamB"; // 40-0/15/30
  // 40-40 = deuce, no game point in classic
  return false;
}

/**
 * Returns which team has set point.
 * Set point = game point AND winning that game would win the set.
 */
export function isSetPoint(match: any): "teamA" | "teamB" | "both" | false {
  const currentSet = match?.score?.currentSet;
  if (!currentSet) return false;

  const gp = isGamePoint(match);
  if (!gp) return false;

  // In tiebreak: game point = set point
  if (currentSet.isTiebreak) return gp;

  const teamAGames = currentSet.teamA;
  const teamBGames = currentSet.teamB;
  const scoringSystem = match.settings?.scoringSystem || "classic";
  const settings = match.settings || {};

  // Helper: would winning next game from (a, b) win the set?
  const wouldWinSet = (a: number, b: number): boolean => {
    if (scoringSystem === "fast4") {
      // Fast4: need 4 games with diff >= 1
      return a >= 4 && a - b >= 1;
    }
    if (settings.isSuperSet) {
      // Super Set: diff >= 2 from 8+, or 9-7 exactly
      return (a >= 8 && a - b >= 2) || (a === 9 && b <= 7);
    }
    // Classic / No-Ad: 6 games with diff >= 2
    return a >= 6 && a - b >= 2;
  };

  if (gp === "both") {
    // No-Ad 40-40: check each team independently
    const aWins = wouldWinSet(teamAGames + 1, teamBGames);
    const bWins = wouldWinSet(teamBGames + 1, teamAGames);
    if (aWins && bWins) return "both";
    if (aWins) return "teamA";
    if (bWins) return "teamB";
    return false;
  }

  if (gp === "teamA" && wouldWinSet(teamAGames + 1, teamBGames)) return "teamA";
  if (gp === "teamB" && wouldWinSet(teamBGames + 1, teamAGames)) return "teamB";
  return false;
}

/**
 * Returns which team has match point.
 * Match point = set point AND winning that set would win the match.
 */
export function isMatchPoint(match: any): "teamA" | "teamB" | "both" | false {
  const sp = isSetPoint(match);
  if (!sp) return false;

  const setsToWin = Math.ceil((match.settings?.sets ?? 3) / 2);
  const completedSets = match.score?.sets ?? [];
  const teamASets = completedSets.filter((s: any) => s.winner === "teamA").length;
  const teamBSets = completedSets.filter((s: any) => s.winner === "teamB").length;

  if (sp === "both") {
    const aMP = teamASets === setsToWin - 1;
    const bMP = teamBSets === setsToWin - 1;
    if (aMP && bMP) return "both";
    if (aMP) return "teamA";
    if (bMP) return "teamB";
    return false;
  }

  if (sp === "teamA" && teamASets === setsToWin - 1) return "teamA";
  if (sp === "teamB" && teamBSets === setsToWin - 1) return "teamB";
  return false;
}

/**
 * Returns the most important current point indicator.
 * Priority: MATCH POINT > SET POINT > GAME POINT / TIEBREAK POINT.
 * Returns { type: string | null, team: "teamA" | "teamB" | "both" | null }
 */
export function getImportantPoint(match: any): { type: string | null; team: string | null } {
  if (!match?.score?.currentSet) return { type: null, team: null };

  const isTiebreak = match.score.currentSet.isTiebreak || false;

  const mp = isMatchPoint(match);
  if (mp) return { type: "MATCH POINT", team: mp };

  const sp = isSetPoint(match);
  if (sp) return { type: "SET POINT", team: sp };

  const gp = isGamePoint(match);
  if (gp) return { type: isTiebreak ? "TIEBREAK POINT" : "GAME POINT", team: gp };

  return { type: isTiebreak ? "TIEBREAK" : null, team: null };
}
```

### Step 4: Verify the file compiles (no TypeScript errors)

Run:
```bash
cd "c:/WORK/padel-score1 пароль 111 - все работает СУПЕР"
npx tsc --noEmit --skipLibCheck 2>&1 | head -40
```
Expected: no errors related to scoring-logic.ts

### Step 5: Commit
```bash
git add lib/scoring-logic.ts
git commit -m "feat: add unified scoring indicators to scoring-logic.ts, fix Classic 40-40 and Super Set 9-8 bugs"
```

---

## Task 2: Refactor components/score-board.tsx

**Files:**
- Modify: `components/score-board.tsx`

### Step 1: Add imports at the top

Find the existing import section (around line 1-21). After the existing imports, add:
```typescript
import { applyScoreIncrement, getImportantPoint } from "@/lib/scoring-logic"
```

### Step 2: Replace handleScoreClick scoring logic

The current `handleScoreClick` (lines ~150-326) contains ~170 lines of embedded scoring logic. Replace the inner scoring block with a call to `applyScoreIncrement`.

Find this block (lines ~191-325 inside handleScoreClick):
```typescript
    const otherTeam = team === "teamA" ? "teamB" : "teamA"

    // Check if sides need to be changed
    if (updatedMatch.shouldChangeSides) {
```
through to:
```typescript
    // Оптимизация: обновляем UI немедленно, не дожидаясь завершения операции сохранения
    updateMatch(updatedMatch)
  }
```

Replace with:
```typescript
    // Handle pending side change before scoring
    if (updatedMatch.shouldChangeSides) {
      updatedMatch.courtSides = {
        teamA: updatedMatch.courtSides.teamA === "left" ? "right" : "left",
        teamB: updatedMatch.courtSides.teamB === "left" ? "right" : "left",
      }
      updatedMatch.shouldChangeSides = false
    }

    // Apply score using unified engine
    const resultMatch = applyScoreIncrement(updatedMatch, team)

    // If the engine completed the match, show confirmation dialog instead of saving directly
    if (resultMatch.isCompleted && !currentMatchState.isCompleted) {
      setPendingMatchUpdate(resultMatch)
      setPreviousMatchState(previousState)
      setLocalMatchState(resultMatch)
      setShowMatchEndDialog(true)
      return
    }

    setLocalMatchState(resultMatch)
    updateMatch(resultMatch)
  }
```

### Step 3: Replace getImportantEventText

Find `getImportantEventText` function (lines ~943-960):
```typescript
  const getImportantEventText = () => {
    if (!match || !match.score) return null

    // Проверяем, завершен ли матч
    if (match.isCompleted) {
      return "MATCH IS OVER"
    }

    const importantPoint = getImportantPointIndicator(match)

    // Возвращаем тип важного события, если оно есть
    if (importantPoint.type) {
      return importantPoint.type
    }

    return null
  }
```

Replace with:
```typescript
  const getImportantEventText = () => {
    if (!match || !match.score) return null
    if (match.isCompleted) return "MATCH IS OVER"
    const { type } = getImportantPoint(match)
    return type || null
  }
```

### Step 4: Remove dead local functions

Delete the following functions entirely from score-board.tsx:
- `winGame` (local version, lines ~411-547)
- `winSet` (local version, lines ~549-655)
- `switchServer` (local version, lines ~690-714)
- `getPointIndex` (lines ~718-735)
- `isGamePointIndicator` (lines ~737-814)
- `isSetPointIndicator` (lines ~816-872)
- `isMatchPointIndicator` (lines ~874-906)
- `getImportantPointIndicator` (lines ~908-941)

**IMPORTANT:** Keep these functions that are NOT part of the scoring engine:
- `handleScoreDecrease` (undo within game — simple decrement, no engine needed)
- `handleCompleteMatch` (dialog confirmation)
- `handleCancelMatchCompletion` (dialog cancel)
- `isServing`
- `getServeSide`
- `manualSwitchServer` (calls external event, not the removed switchServer)
- All state, useEffect, JSX

### Step 5: Verify no references to removed functions remain

Run:
```bash
grep -n "winGame\|winSet\|switchServer\|getPointIndex\|isGamePointIndicator\|isSetPointIndicator\|isMatchPointIndicator\|getImportantPointIndicator" "components/score-board.tsx"
```
Expected: 0 matches (or only in comments).

### Step 6: Check TypeScript
```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -40
```
Expected: no errors

### Step 7: Commit
```bash
git add components/score-board.tsx
git commit -m "refactor: replace embedded scoring engine in score-board.tsx with unified scoring-logic.ts"
```

---

## Task 3: Refactor app/fullscreen-scoreboard/[number]/page.tsx

**Files:**
- Modify: `app/fullscreen-scoreboard/[number]/page.tsx`

### Step 1: Update import

The file already imports `applyScoreIncrement` (line 10):
```typescript
import { applyScoreIncrement } from "@/lib/scoring-logic"
```
Change to also import `getImportantPoint`:
```typescript
import { applyScoreIncrement, getImportantPoint } from "@/lib/scoring-logic"
```

### Step 2: Delete local indicator functions

Delete these `const` functions defined inside the component (lines ~632-904):
- `getPointIndex` (lines ~632-649)
- `isGamePoint` (lines ~652-730)
- `isSetPoint` (lines ~733-803)
- `isMatchPoint` (lines ~806-847)
- `getImportantPoint` (lines ~850-904) — NOTE: the local one shadows the import, so delete local version and keep the import

### Step 3: Update getImportantEvent

Find `getImportantEvent` (lines ~906-927):
```typescript
  const getImportantEvent = () => {
    if (!match || !match.score) return null
    if (match.isCompleted) {
      return translations[language].scoreboard.matchCompleted || "MATCH IS OVER"
    }
    const importantPoint = getImportantPoint(match)
    if (importantPoint.type && importantPoint.type !== "GAME") {
      if (importantPoint.team === "both") {
        return importantPoint.type
      }
      return importantPoint.type
    }
    return null
  }
```

Replace with (simplified, using imported function):
```typescript
  const getImportantEvent = () => {
    if (!match || !match.score) return null
    if (match.isCompleted) {
      return translations[language].scoreboard.matchCompleted || "MATCH IS OVER"
    }
    const { type } = getImportantPoint(match)
    return (type && type !== "TIEBREAK") ? type : null
  }
```

### Step 4: Verify no references to deleted functions
```bash
grep -n "getPointIndex\|isGamePoint\|isSetPoint\|isMatchPoint\|getImportantPoint" "app/fullscreen-scoreboard/[number]/page.tsx"
```
Expected: only the import line and the usages of `getImportantPoint` (imported).

### Step 5: Check TypeScript
```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -40
```

### Step 6: Commit
```bash
git add "app/fullscreen-scoreboard/[number]/page.tsx"
git commit -m "refactor: replace embedded indicators in fullscreen-scoreboard with unified scoring-logic.ts"
```

---

## Task 4: Refactor app/vmix/[id]/page.tsx

**Files:**
- Modify: `app/vmix/[id]/page.tsx`

### Step 1: Add import

At the top of the file (after existing imports), add:
```typescript
import { getImportantPoint, isGamePoint, isSetPoint, isMatchPoint } from "@/lib/scoring-logic"
```

### Step 2: Delete module-level functions

Delete these module-level functions (lines ~64-330):
- `getPointIndex` (lines ~64-81)
- `isGamePoint` (lines ~83-158)
- `isSetPoint` (lines ~160-231)
- `isMatchPoint` (lines ~233-275)
- `getImportantPoint` (lines ~277-330)

### Step 3: Remove console.log debug calls inside component

At line ~1020-1024:
```typescript
  console.log("Важный момент матча:", importantPoint)
  console.log("Game Point:", isGamePoint(match))
  console.log("Set Point:", isSetPoint(match))
  console.log("Match Point:", isMatchPoint(match))
```
These still work since `isGamePoint`, `isSetPoint`, `isMatchPoint` are now imported. Keep or remove as needed.

### Step 4: Verify
```bash
grep -n "getPointIndex" "app/vmix/[id]/page.tsx"
```
Expected: 0 matches.

### Step 5: Check TypeScript
```bash
npx tsc --noEmit --skipLibCheck 2>&1 | head -40
```

### Step 6: Commit
```bash
git add "app/vmix/[id]/page.tsx"
git commit -m "refactor: replace embedded indicators in vmix with unified scoring-logic.ts"
```

---

## Task 5: Final verification pass

### Step 1: Search for any remaining duplicates
```bash
cd "c:/WORK/padel-score1 пароль 111 - все работает СУПЕР"
grep -rn "isGamePointIndicator\|isSetPointIndicator\|isMatchPointIndicator\|getImportantPointIndicator" --include="*.ts" --include="*.tsx" .
```
Expected: 0 matches.

```bash
grep -rn "function winGame\|const winGame\|function winSet\|const winSet" --include="*.ts" --include="*.tsx" .
```
Expected: only in `lib/scoring-logic.ts` (as private helpers).

### Step 2: Verify the three consumer files use unified imports
```bash
grep -n "from.*scoring-logic" components/score-board.tsx app/fullscreen-scoreboard/*/page.tsx app/vmix/*/page.tsx
```
Expected: all three files have imports from `@/lib/scoring-logic`.

### Step 3: Full TypeScript check
```bash
npx tsc --noEmit --skipLibCheck 2>&1
```
Expected: 0 errors.

### Step 4: Manual smoke test
Open the app and verify:
- Classic mode 40-40: should go to "Ad" (not end game)
- No-Ad 40-40: next point wins
- Tiebreak game point shows at 6-5 (regular) and 9-8 (championship)
- Set point shows at 5-4, 6-5, and also at 7-6 (if no tiebreak)
- Match point shows when one set away from winning

### Step 5: Final commit
```bash
git add -A
git commit -m "chore: final cleanup — unified scoring engine complete"
```

---

## Summary of All Bugs Fixed

| Bug | Location | Fix |
|-----|----------|-----|
| Classic 40-40 → winGame | scoring-logic.ts:74 | → `currentGame[team] = "Ad"` |
| Super Set 9-8 no end | scoring-logic.ts:145 | `< 8` → `<= 7` |
| Tiebreak GP hardcoded at 6 | all 3 components | use `getTiebreakPointsToWin()` |
| setsToWin from wrong field | fullscreen + vmix | `Math.ceil(settings.sets/2)` |
| Set winner by game count | all 3 components | use `set.winner` field |
| Set point > 6-6 missing | all 3 components | `wouldWinSet()` simulation |
| No-Ad 40-40 GP not "both" | vmix | return "both" |
