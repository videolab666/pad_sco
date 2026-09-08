import {
  getFinalSetTiebreakLength,
  getSetsToWin,
  isFinalSetGamesTo12,
  isFinalSetNoTiebreak,
  isMatchTiebreakFormat,
  shouldStartMatchTiebreakAfterSet,
  usesFinalSetGameTiebreak,
} from "./match-format-rules";
import {
  normalizeCurrentGameForScoringSystem,
  normalizeCurrentSetForFinalSet,
} from "./match-rule-change";

// Shared scoring logic for tennis/padel scoreboard (used by ScoreBoard and FullscreenScoreboard)
// Extracted from components/score-board.tsx

type TeamKey = "teamA" | "teamB";

interface CurrentGame {
  teamA: number | string;
  teamB: number | string;
  deuceCount?: number;
}

interface CurrentSet {
  teamA: number;
  teamB: number;
  games: { winner: TeamKey }[];
  currentGame: CurrentGame;
  isTiebreak: boolean;
  isSuperTiebreak?: boolean;
  tiebreak?: { teamA: number; teamB: number };
}

interface SavedSet {
  teamA: number;
  teamB: number;
  winner: TeamKey;
  tiebreak?: { teamA: number; teamB: number };
}

interface MatchSettings {
  sets: number;
  scoringSystem: "classic" | "no-ad" | "fast4";
  gamesPerSet?: number;
  gamesPerSetOverrides?: Record<number, number>;
  tiebreakEnabled: boolean;
  tiebreakType: string;
  tiebreakFormat?: string;
  tiebreakLength?: number;
  tiebreakAt?: string;
  finalSetTiebreak: boolean;
  finalSetFinish?: string;
  finalSetTiebreakLength?: number;
  goldenPointFormat?: "none" | "first-deuce" | "second-deuce" | "third-deuce";
  goldenGame: boolean;
  windbreak: boolean;
  isSuperSet?: boolean;
  superSetTarget?: number;
  superSetTiebreakAt?: number;
}

interface CourtSides {
  teamA: string;
  teamB: string;
}

interface CurrentServer {
  team: TeamKey;
  playerIndex: number;
}

interface MatchScore {
  teamA: number;
  teamB: number;
  sets: SavedSet[];
  currentSet: CurrentSet;
}

interface Match {
  isCompleted: boolean;
  winner?: TeamKey | null;
  format: string;
  settings: MatchSettings;
  score: MatchScore;
  currentServer: CurrentServer;
  courtSides: CourtSides;
  shouldChangeSides?: boolean;
  [key: string]: unknown;
}

/**
 * Applies a score increment for the specified team, respecting all match settings and rules.
 * Creates a deep copy and returns a new match object with updated state.
 *
 * @param match - The match object
 * @param team - 'teamA' or 'teamB'
 * @returns Updated match object
 */
export function applyScoreIncrement(match: Match, team: TeamKey): Match {
  if (!match || match.isCompleted) return match;
  const updatedMatch: Match = JSON.parse(JSON.stringify(match));
  const otherTeam: TeamKey = team === "teamA" ? "teamB" : "teamA";
  const currentSet = updatedMatch.score.currentSet;
  if (!currentSet) return updatedMatch;

  // --- Tiebreak logic ---
  if (currentSet.isTiebreak) {
    if (typeof currentSet.currentGame[team] !== "number") currentSet.currentGame[team] = 0;
    (currentSet.currentGame[team] as number)++;

    let pointsToWin = 7;
    if (currentSet.isSuperTiebreak) {
      pointsToWin = getFinalSetTiebreakLength(updatedMatch.settings);
    } else {
      pointsToWin = updatedMatch.settings.tiebreakLength || 7;
    }
    // Check for tiebreak win
    if (
      (currentSet.currentGame[team] as number) >= pointsToWin &&
      (currentSet.currentGame[team] as number) - (currentSet.currentGame[otherTeam] as number) >=
        getTiebreakWinMargin(updatedMatch.settings)
    ) {
      currentSet.tiebreak = {
        teamA: currentSet.currentGame.teamA as number,
        teamB: currentSet.currentGame.teamB as number,
      };
      currentSet[team]++;
      return winSet(team, updatedMatch);
    }
    // Switch server every 2 points (except first)
    const totalPoints = (currentSet.currentGame.teamA as number) + (currentSet.currentGame.teamB as number);
    if (totalPoints % 2 === 1) {
      switchServer(updatedMatch);
    }
    // Change sides every 6 points
    if (totalPoints > 0 && totalPoints % 6 === 0) {
      updatedMatch.shouldChangeSides = true;
    }
    return updatedMatch;
  }

  // --- Regular game logic ---
  const currentGame = currentSet.currentGame;
  const scoringSystem = updatedMatch.settings.scoringSystem || "classic";
  if (scoringSystem === "classic") {
    if (currentGame[team] === 0) {
      currentGame[team] = 15;
    } else if (currentGame[team] === 15) {
      currentGame[team] = 30;
    } else if (currentGame[team] === 30) {
      currentGame[team] = 40;
    } else if (currentGame[team] === 40) {
      if (typeof currentGame[otherTeam] === "number" && currentGame[otherTeam] < 40) {
        return winGame(team, updatedMatch);
      } else if (currentGame[otherTeam] === 40) {
        if (isGoldenPointActive(updatedMatch.settings, currentGame.deuceCount || 0)) {
          return winGame(team, updatedMatch);
        }
        currentGame[team] = "Ad";
      } else if (currentGame[otherTeam] === "Ad") {
        currentGame[team] = 40;
        currentGame[otherTeam] = 40;
        currentGame.deuceCount = (currentGame.deuceCount || 0) + 1;
      }
    } else if (currentGame[team] === "Ad") {
      return winGame(team, updatedMatch);
    }
  } else if (scoringSystem === "no-ad" || scoringSystem === "fast4") {
    if (currentGame[team] === 0) {
      currentGame[team] = 15;
    } else if (currentGame[team] === 15) {
      currentGame[team] = 30;
    } else if (currentGame[team] === 30) {
      currentGame[team] = 40;
    } else if (currentGame[team] === 40) {
      return winGame(team, updatedMatch);
    }
  }
  return updatedMatch;
}

function winGame(team: TeamKey, updatedMatch: Match): Match {
  const otherTeam: TeamKey = team === "teamA" ? "teamB" : "teamA";
  const currentSet = updatedMatch.score.currentSet;
  currentSet[team]++;
  currentSet.games.push({ winner: team });
  currentSet.currentGame = { teamA: 0, teamB: 0 };
  // Switch server
  if (!updatedMatch.settings.windbreak) {
    switchServer(updatedMatch);
  } else {
    const totalGamesAfterReset = currentSet.teamA + currentSet.teamB;
    if (totalGamesAfterReset % 2 === 1) {
      switchServer(updatedMatch);
    }
  }
  // Change sides after odd number of games
  const totalGames = currentSet.teamA + currentSet.teamB;
  if (totalGames % 2 === 1) {
    updatedMatch.shouldChangeSides = true;
  }
  // Handle Super Set rules
  if (updatedMatch.settings.isSuperSet) {
    const teamAScore = currentSet.teamA;
    const teamBScore = currentSet.teamB;
    if (teamAScore === 8 && teamBScore === 8) {
      currentSet.isTiebreak = true;
      return updatedMatch;
    }
    if (
      (teamAScore >= 8 && teamAScore - teamBScore >= 2) ||
      (teamBScore >= 8 && teamBScore - teamAScore >= 2) ||
      (teamAScore === 9 && teamBScore <= 7) ||
      (teamBScore === 9 && teamAScore <= 7)
    ) {
      return winSet(team, updatedMatch);
    }
    return updatedMatch;
  }
  // Fast4 / classic — set targets resolved by the shared getSetTargets helper.
  const scoringSystem = updatedMatch.settings.scoringSystem || "classic";
  const { gamesNeededToWin, tiebreakAt, isDecidingSet } = getSetTargets(updatedMatch);
  const useFinalSetGameTiebreak = isDecidingSet && usesFinalSetGameTiebreak(updatedMatch.settings);

  if (useFinalSetGameTiebreak) {
    if (currentSet.teamA === tiebreakAt && currentSet.teamB === tiebreakAt) {
      currentSet.isTiebreak = true;
      currentSet.isSuperTiebreak = true;
      return updatedMatch;
    }
  } else if (
    updatedMatch.settings.tiebreakEnabled &&
    !(isDecidingSet && isFinalSetNoTiebreak(updatedMatch.settings)) &&
    currentSet.teamA === tiebreakAt &&
    currentSet.teamB === tiebreakAt
  ) {
    currentSet.isTiebreak = true;
    return updatedMatch;
  }
  // Golden game — works with any gamesNeededToWin
  if (updatedMatch.settings.goldenGame) {
    const goldenAt = gamesNeededToWin - 1;
    if (
      (currentSet.teamA === goldenAt + 1 && currentSet.teamB === goldenAt) ||
      (currentSet.teamA === goldenAt && currentSet.teamB === goldenAt + 1)
    ) {
      const setWinner: TeamKey = currentSet.teamA > currentSet.teamB ? "teamA" : "teamB";
      return winSet(setWinner, updatedMatch);
    }
  }
  // Set win
  if (currentSet.teamA >= gamesNeededToWin && currentSet.teamA - currentSet.teamB >= 2) {
    return winSet("teamA", updatedMatch);
  } else if (currentSet.teamB >= gamesNeededToWin && currentSet.teamB - currentSet.teamA >= 2) {
    return winSet("teamB", updatedMatch);
  }
  // Fast4 set win (with 1 game difference)
  if (scoringSystem === "fast4") {
    if (currentSet.teamA >= gamesNeededToWin && currentSet.teamA - currentSet.teamB >= 1) {
      return winSet("teamA", updatedMatch);
    } else if (currentSet.teamB >= gamesNeededToWin && currentSet.teamB - currentSet.teamA >= 1) {
      return winSet("teamB", updatedMatch);
    }
  }
  return updatedMatch;
}

function winSet(team: TeamKey, updatedMatch: Match): Match {
  updatedMatch.score[team]++;
  const setToSave: SavedSet = {
    teamA: updatedMatch.score.currentSet.teamA,
    teamB: updatedMatch.score.currentSet.teamB,
    winner: team,
  };
  // Tiebreak score: a pre-recorded `currentSet.tiebreak` (set by a manual
  // end-tiebreak) wins; otherwise read the live currentGame of an in-play
  // tiebreak. The engine sets `currentSet.tiebreak` to the same values before
  // calling winSet, so this changes nothing for normal scoring.
  if (updatedMatch.score.currentSet.tiebreak) {
    setToSave.tiebreak = {
      teamA: updatedMatch.score.currentSet.tiebreak.teamA,
      teamB: updatedMatch.score.currentSet.tiebreak.teamB,
    };
  } else if (updatedMatch.score.currentSet.isTiebreak) {
    setToSave.tiebreak = {
      teamA: updatedMatch.score.currentSet.currentGame.teamA as number,
      teamB: updatedMatch.score.currentSet.currentGame.teamB as number,
    };
  }
  updatedMatch.score.sets.push(setToSave);

  const setsToWin = getSetsToWin(updatedMatch.settings);
  if (updatedMatch.score[team] >= setsToWin) {
    updatedMatch.isCompleted = true;
    updatedMatch.winner = team;
    return updatedMatch;
  }

  if (shouldStartMatchTiebreakAfterSet(updatedMatch.settings, updatedMatch.score)) {
    updatedMatch.score.currentSet = {
      teamA: 0,
      teamB: 0,
      games: [],
      currentGame: { teamA: 0, teamB: 0 },
      isTiebreak: true,
      isSuperTiebreak: true,
    };
  } else {
    updatedMatch.score.currentSet = {
      teamA: 0,
      teamB: 0,
      games: [],
      currentGame: { teamA: 0, teamB: 0 },
      isTiebreak: false,
    };
  }
  // B1 fix: end-of-set change of ends goes through the single `shouldChangeSides`
  // channel (consumed by ScoreControls), never a direct courtSides swap here —
  // a direct swap on top of the flag caused a double swap. Change ends when the
  // completed set's total games is odd; an even count changes after game 1 of
  // the next set, which the next set's winGame already flags.
  const completedSetGames = setToSave.teamA + setToSave.teamB;
  if (completedSetGames % 2 === 1) {
    updatedMatch.shouldChangeSides = true;
  }
  return updatedMatch;
}

/**
 * Pure public "the given team has won the current set" — deep-clones the match,
 * records the set win (set entry incl. tiebreak score, set counter, match
 * completion or next set, end-of-set side change), and returns the new match.
 *
 * Shares the engine's `winSet` logic so the manual "end tiebreak" action in
 * match settings stays in lockstep with normal scoring. The caller decides
 * whether to confirm a match-ending set.
 */
export function commitSetWin(match: Match, team: TeamKey): Match {
  const next: Match = JSON.parse(JSON.stringify(match));
  return winSet(team, next);
}

function getTiebreakWinMargin(settings: MatchSettings): number {
  return settings.tiebreakFormat === "sudden-death" ? 1 : 2;
}

/**
 * Resolves how the current set ends: how many games win it and the game count
 * at which a tiebreak starts. Honours per-set overrides, fast4 defaults and the
 * games-to-12 deciding-set format. Single source of truth — used by `winGame`
 * (set completion) and `isSetPoint` (the SET POINT indicator).
 */
export function getSetTargets(match: any): {
  gamesNeededToWin: number;
  tiebreakAt: number;
  isDecidingSet: boolean;
  finalSetGoesTo12: boolean;
} {
  const settings = match?.settings ?? {};
  const scoringSystem = settings.scoringSystem || "classic";
  const defaultGames = settings.gamesPerSet || (scoringSystem === "fast4" ? 4 : 6);
  const currentSetIndex = match?.score?.sets?.length ?? 0;
  const isDecidingSet = currentSetIndex + 1 === settings.sets;
  const finalSetGoesTo12 = isDecidingSet && isFinalSetGamesTo12(settings);
  const gamesNeededToWin = finalSetGoesTo12
    ? 12
    : settings.gamesPerSetOverrides?.[currentSetIndex] || defaultGames;
  const regularTiebreakAt = Number.parseInt(settings.tiebreakAt?.split("-")[0] || "6");
  const tiebreakAt = finalSetGoesTo12 ? 12 : regularTiebreakAt;
  return { gamesNeededToWin, tiebreakAt, isDecidingSet, finalSetGoesTo12 };
}

function isGoldenPointActive(settings: MatchSettings, deuceCount: number): boolean {
  const format = settings.goldenPointFormat || (settings.scoringSystem === "no-ad" ? "first-deuce" : "none");
  const requiredDeuce =
    format === "first-deuce" ? 0 : format === "second-deuce" ? 1 : format === "third-deuce" ? 2 : Number.POSITIVE_INFINITY;

  return deuceCount >= requiredDeuce;
}

/**
 * Advances the server to the next player. Singles → other team. Doubles → the
 * A1 → B1 → A2 → B2 rotation. Mutates `currentServer` in place. Exported as the
 * single implementation shared by the scoreboard and score-controls.
 */
export function switchServer(updatedMatch: Match): void {
  if (!updatedMatch.currentServer) return;
  const currentTeam = updatedMatch.currentServer.team;
  const otherTeam: TeamKey = currentTeam === "teamA" ? "teamB" : "teamA";
  if (updatedMatch.format === "singles") {
    updatedMatch.currentServer.team = otherTeam;
    updatedMatch.currentServer.playerIndex = 0;
  } else {
    if (currentTeam === "teamA") {
      updatedMatch.currentServer.team = "teamB";
    } else {
      updatedMatch.currentServer.team = "teamA";
      updatedMatch.currentServer.playerIndex = updatedMatch.currentServer.playerIndex === 0 ? 1 : 0;
    }
  }
}

/** Returns a new courtSides object with the two teams' sides swapped. */
export function swapCourtSides(sides: CourtSides): CourtSides {
  return {
    teamA: sides.teamA === "left" ? "right" : "left",
    teamB: sides.teamB === "left" ? "right" : "left",
  };
}

/** Complete the automatic side transition once, in both live scoring and replay. */
export function applyPendingCourtSideChange<T extends { shouldChangeSides?: boolean; courtSides?: CourtSides }>(match: T): T {
  if (!match.shouldChangeSides || !match.courtSides) return match;
  return { ...match, courtSides: swapCourtSides(match.courtSides), shouldChangeSides: false };
}

// ─── Exported indicator helpers ───────────────────────────────────────────────

export function getPointIndex(point: unknown): number {
  if (point === "Ad") return 4;
  if (point === 0) return 0;
  if (point === 15) return 1;
  if (point === 30) return 2;
  if (point === 40) return 3;
  if (typeof point === "number" && point > 40) return 4;
  return point as number;
}

export function getTiebreakPointsToWin(match: any): number {
  const currentSet = match?.score?.currentSet;
  if (currentSet?.isSuperTiebreak) {
    return getFinalSetTiebreakLength(match.settings);
  }
  if (match.settings?.tiebreakLength) return match.settings.tiebreakLength;
  return 7;
}

function getTiebreakPointMargin(settings: any): number {
  return settings?.tiebreakFormat === "sudden-death" ? 1 : 2;
}

export function isGamePoint(match: any): TeamKey | "both" | false {
  // A finished match has no live point — every indicator must be silent.
  // isSetPoint / isMatchPoint delegate here, so this guard covers all three.
  if (match?.isCompleted) return false;
  const currentSet = match?.score?.currentSet;
  const currentGame = currentSet?.currentGame;
  if (!currentGame) return false;

  const scoringSystem = match.settings?.scoringSystem || "classic";

  if (currentSet.isTiebreak) {
    const ptw = getTiebreakPointsToWin(match);
    const margin = getTiebreakPointMargin(match.settings);
    const a = typeof currentGame.teamA === "number" ? currentGame.teamA : 0;
    const b = typeof currentGame.teamB === "number" ? currentGame.teamB : 0;
    const aWins = a + 1 >= ptw && (a + 1) - b >= margin;
    const bWins = b + 1 >= ptw && (b + 1) - a >= margin;
    if (aWins && bWins) return "both";
    if (aWins) return "teamA";
    if (bWins) return "teamB";
    return false;
  }

  const ai = getPointIndex(currentGame.teamA);
  const bi = getPointIndex(currentGame.teamB);

  const deuceCount = currentGame.deuceCount || 0;
  const goldenFormat = match.settings?.goldenPointFormat || (scoringSystem === "no-ad" ? "first-deuce" : "none");
  const goldenDeuce =
    goldenFormat === "first-deuce" ||
    (goldenFormat === "second-deuce" && deuceCount >= 1) ||
    (goldenFormat === "third-deuce" && deuceCount >= 2);

  if (ai === 3 && bi === 3 && goldenDeuce) return "both";

  if (scoringSystem === "no-ad" || scoringSystem === "fast4") {
    if (ai === 3 && bi === 3) return "both";
    if (ai === 3) return "teamA";
    if (bi === 3) return "teamB";
    return false;
  }

  if (ai === 4) return "teamA";
  if (bi === 4) return "teamB";
  if (ai === 3 && bi <= 2) return "teamA";
  if (bi === 3 && ai <= 2) return "teamB";
  return false;
}

export function isSetPoint(match: any): TeamKey | "both" | false {
  const currentSet = match?.score?.currentSet;
  if (!currentSet) return false;

  const gp = isGamePoint(match);
  if (!gp) return false;

  if (currentSet.isTiebreak) return gp;

  const teamAGames = currentSet.teamA as number;
  const teamBGames = currentSet.teamB as number;
  const scoringSystem = match.settings?.scoringSystem || "classic";
  const settings = match.settings || {};

  const wouldWinSet = (a: number, b: number): boolean => {
    // Targets honour per-set overrides / games-to-12 via getSetTargets, and the
    // win conditions mirror winGame exactly (super set, golden game, fast4).
    const { gamesNeededToWin } = getSetTargets(match);

    if (settings.isSuperSet) {
      return (a >= 8 && a - b >= 2) || (a === 9 && b <= 7);
    }
    // Golden game: a one-game margin wins exactly at gamesNeededToWin.
    if (settings.goldenGame && a === gamesNeededToWin && b === gamesNeededToWin - 1) {
      return true;
    }
    if (scoringSystem === "fast4") {
      return a >= gamesNeededToWin && a - b >= 1;
    }
    return a >= gamesNeededToWin && a - b >= 2;
  };

  if (gp === "both") {
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

export function isMatchPoint(match: any): TeamKey | "both" | false {
  const sp = isSetPoint(match);
  if (!sp) return false;

  const setsToWin = getSetsToWin(match.settings);
  const completedSets: any[] = match.score?.sets ?? [];
  const teamASets = completedSets.filter((s) => s.winner === "teamA").length;
  const teamBSets = completedSets.filter((s) => s.winner === "teamB").length;

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

// ─── Post-rule-change normalization (Task 4) ───────────────────────────────────
//
// The scoring engine is split into point application (applyScoreIncrement) and
// the normalization passes below. After a rule edit or a queued-operation
// replay, the engine cannot assume the in-progress game/set is still valid for
// the new rules — these passes repair it so scoring can continue deterministically.

/** Coerces a tiebreak point cell to a non-negative integer. */
function coerceTiebreakPoint(value: unknown): number {
  const n = typeof value === "number" ? value : 0;
  return n < 0 ? 0 : Math.floor(n);
}

/**
 * Game normalization — makes the current game valid for the active rules.
 * Handles the `40-40`, `Ad`, `deuceCount` and live tiebreak-point edge cases.
 * Mutates the match in place.
 */
export function normalizeCurrentGame(match: Match): void {
  const currentSet = match?.score?.currentSet;
  const currentGame = currentSet?.currentGame;
  if (!currentSet || !currentGame) return;

  if (currentSet.isTiebreak) {
    currentGame.teamA = coerceTiebreakPoint(currentGame.teamA);
    currentGame.teamB = coerceTiebreakPoint(currentGame.teamB);
    delete currentGame.deuceCount;
    return;
  }

  // Collapse advantage for no-ad / fast4 and clear the deuce counter there.
  normalizeCurrentGameForScoringSystem(currentGame, match.settings as any);

  const system = match.settings?.scoringSystem || "classic";
  if (system === "classic") {
    // In classic scoring "Ad" is only valid when the opponent sits at 40.
    if (currentGame.teamA === "Ad" && currentGame.teamB !== 40) currentGame.teamA = 40;
    if (currentGame.teamB === "Ad" && currentGame.teamA !== 40) currentGame.teamB = 40;
  }

  // The deuce counter is only meaningful at 40-40 / advantage.
  const atDeuce =
    currentGame.teamA === "Ad" ||
    currentGame.teamB === "Ad" ||
    (currentGame.teamA === 40 && currentGame.teamB === 40);
  if (!atDeuce && currentGame.deuceCount) currentGame.deuceCount = 0;
}

/**
 * Set normalization — repairs current-set flags and counters (negative game
 * counts, a super tiebreak that lost its tiebreak flag, an empty tiebreak the
 * format no longer wants). Mutates the match in place.
 */
export function normalizeCurrentSet(match: Match): void {
  const currentSet = match?.score?.currentSet;
  if (!currentSet) return;
  if (currentSet.teamA < 0) currentSet.teamA = 0;
  if (currentSet.teamB < 0) currentSet.teamB = 0;
  // A super tiebreak is always a tiebreak.
  if (currentSet.isSuperTiebreak) currentSet.isTiebreak = true;
  normalizeCurrentSetForFinalSet(currentSet, match.settings as any);
}

/**
 * Post-change normalization — the entry point used after a rule edit or a
 * queued-operation replay. Deep-clones the match, repairs the current game and
 * set, and returns a match the scoring engine can safely continue from.
 */
export function normalizeMatchState(match: Match): Match {
  if (!match) return match;
  const next: Match = JSON.parse(JSON.stringify(match));
  normalizeCurrentGame(next);
  normalizeCurrentSet(next);
  return next;
}

/**
 * Recomputes the sets-won counters and the match outcome from the completed
 * sets and the current `setsToWin`. A rule edit can change how many sets win
 * the match (`sets`, final-set / match-tiebreak format), so after such an edit
 * a finished match could otherwise keep running — or a still-open match could
 * stay flagged complete. Deep-clones — the input is not mutated.
 */
export function recomputeMatchCompletion(match: Match): Match {
  if (!match || !match.score) return match;
  const next: Match = JSON.parse(JSON.stringify(match));
  const sets: SavedSet[] = next.score.sets ?? [];
  next.score.teamA = sets.filter((s) => s.winner === "teamA").length;
  next.score.teamB = sets.filter((s) => s.winner === "teamB").length;

  const setsToWin = getSetsToWin(next.settings);
  if (next.score.teamA >= setsToWin) {
    next.isCompleted = true;
    next.winner = "teamA";
  } else if (next.score.teamB >= setsToWin) {
    next.isCompleted = true;
    next.winner = "teamB";
  } else {
    next.isCompleted = false;
    next.winner = null;
  }
  return next;
}

// ─── Match tiebreak <-> full set conversion (Task 6) ───────────────────────────
//
// Conversion policy:
//  - already completed sets are always preserved,
//  - only the current deciding set is rebuilt, and only on an explicit request,
//  - match-tiebreak points are never reinterpreted as game counts — the set is
//    restarted from 0-0 instead.
// The server and court-side state survive the rebuild (deep-cloned); a pending
// side change is cleared because the set begins fresh.

function buildFreshCurrentSet(asMatchTiebreak: boolean): CurrentSet {
  const set: CurrentSet = {
    teamA: 0,
    teamB: 0,
    games: [],
    currentGame: { teamA: 0, teamB: 0 },
    isTiebreak: asMatchTiebreak,
  };
  if (asMatchTiebreak) set.isSuperTiebreak = true;
  return set;
}

/** Restarts the current set as a normal game-based set; completed sets kept. */
export function restartCurrentSetAsNormalSet(match: Match): Match {
  const next: Match = JSON.parse(JSON.stringify(match));
  next.score.currentSet = buildFreshCurrentSet(false);
  next.shouldChangeSides = false;
  return next;
}

/** Restarts the current set as a match (super) tiebreak; completed sets kept. */
export function restartCurrentSetAsMatchTiebreak(match: Match): Match {
  const next: Match = JSON.parse(JSON.stringify(match));
  next.score.currentSet = buildFreshCurrentSet(true);
  next.shouldChangeSides = false;
  return next;
}

/**
 * Rebuilds the current set from 0-0, preserving every completed set and
 * auto-choosing a match tiebreak vs a normal set from the active format. Used
 * by the "restart current set" scope option. Deep-clones — input not mutated.
 */
export function restartCurrentSet(match: Match): Match {
  if (!match) return match;
  const completedSets = match.score?.sets?.length ?? 0;
  const totalSets = Number((match.settings as any)?.sets) || 3;
  const isDecidingSet = completedSets + 1 === totalSets;
  const asMatchTiebreak = isDecidingSet && isMatchTiebreakFormat(match.settings as any);
  return asMatchTiebreak ? restartCurrentSetAsMatchTiebreak(match) : restartCurrentSetAsNormalSet(match);
}

export function getImportantPoint(match: any): { type: string | null; team: string | null } {
  if (!match?.score?.currentSet) return { type: null, team: null };
  // A finished match shows no important-point banner (SET POINT / TIEBREAK / …).
  if (match.isCompleted) return { type: null, team: null };

  const isTiebreak = match.score.currentSet.isTiebreak || false;

  const mp = isMatchPoint(match);
  if (mp) return { type: "MATCH POINT", team: mp };

  const sp = isSetPoint(match);
  if (sp) return { type: "SET POINT", team: sp };

  const gp = isGamePoint(match);
  if (gp) return { type: isTiebreak ? "TIEBREAK POINT" : "GAME POINT", team: gp };

  return { type: isTiebreak ? "TIEBREAK" : null, team: null };
}

/**
 * Break point — a game point held by the *receiving* team (a chance to break
 * the opponent's serve). Returns the team with the break point, or false.
 * `isGamePoint` already returns false for a completed match, so this does too.
 */
export function isBreakPoint(match: any): TeamKey | "both" | false {
  if (!match?.score?.currentSet || !match.currentServer) return false;
  const gp = isGamePoint(match);
  if (!gp) return false;
  // Game point is a break point when it is NOT the serving team's.
  return gp !== match.currentServer.team ? gp : false;
}

/** Break-point counter for the current game (1/1 when active, else 0/0). */
export function getBreakPointCount(match: any): { current: number; total: number } {
  return isBreakPoint(match) ? { current: 1, total: 1 } : { current: 0, total: 0 };
}
