// Shared scoring logic for tennis/padel scoreboard (used by ScoreBoard and FullscreenScoreboard)
// Extracted from components/score-board.tsx

/**
 * Applies a score increment for the specified team, respecting all match settings and rules.
 * Mutates and returns a new match object with updated state.
 *
 * @param match - The match object (deep copy recommended before calling)
 * @param team - 'teamA' or 'teamB'
 * @returns Updated match object
 */
export function applyScoreIncrement(match, team) {
  if (!match || match.isCompleted) return match;
  const updatedMatch = { ...match };
  const otherTeam = team === "teamA" ? "teamB" : "teamA";
  const currentSet = updatedMatch.score.currentSet;
  if (!currentSet) return updatedMatch;

  // --- Tiebreak logic ---
  if (currentSet.isTiebreak) {
    if (typeof currentSet.currentGame[team] !== "number") currentSet.currentGame[team] = 0;
    currentSet.currentGame[team]++;

    // Determine points to win
    let pointsToWin = 7;
    if (
      currentSet.isSuperTiebreak ||
      (updatedMatch.settings.finalSetTiebreak && updatedMatch.score.sets.length + 1 === updatedMatch.settings.sets)
    ) {
      pointsToWin = updatedMatch.settings.finalSetTiebreakLength || 10;
    } else if (updatedMatch.settings.tiebreakType === "championship") {
      pointsToWin = 10;
    }
    // Check for tiebreak win
    if (
      currentSet.currentGame[team] >= pointsToWin &&
      currentSet.currentGame[team] - currentSet.currentGame[otherTeam] >= 2
    ) {
      // Save tiebreak score
      currentSet.tiebreak = {
        teamA: currentSet.currentGame.teamA,
        teamB: currentSet.currentGame.teamB,
      };
      // Increment set score
      currentSet[team]++;
      // Win set
      return winSet(team, updatedMatch);
    }
    // Switch server every 2 points (except first)
    const totalPoints = currentSet.currentGame.teamA + currentSet.currentGame.teamB;
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
      if (currentGame[otherTeam] < 40) {
        return winGame(team, updatedMatch);
      } else if (currentGame[otherTeam] === 40) {
        if (updatedMatch.settings.goldenPoint) {
          return winGame(team, updatedMatch);
        } else {
          currentGame[team] = "Ad";
        }
      } else if (currentGame[otherTeam] === "Ad") {
        currentGame[team] = 40;
        currentGame[otherTeam] = 40;
      }
    } else if (currentGame[team] === "Ad") {
      return winGame(team, updatedMatch);
    }
  } else if (scoringSystem === "no-ad") {
    if (currentGame[team] === 0) {
      currentGame[team] = 15;
    } else if (currentGame[team] === 15) {
      currentGame[team] = 30;
    } else if (currentGame[team] === 30) {
      currentGame[team] = 40;
    } else if (currentGame[team] === 40) {
      return winGame(team, updatedMatch);
    }
  } else if (scoringSystem === "fast4") {
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

// Helper: handle winning a game
function winGame(team, updatedMatch) {
  const otherTeam = team === "teamA" ? "teamB" : "teamA";
  const currentSet = updatedMatch.score.currentSet;
  currentSet[team]++;
  // Save minimal game info
  currentSet.games.push({ winner: team });
  // Reset current game
  currentSet.currentGame = { teamA: 0, teamB: 0 };
  // Switch server
  if (!updatedMatch.settings.windbreak) {
    switchServer(updatedMatch);
  } else {
    const totalGames = currentSet.teamA + currentSet.teamB;
    if (totalGames % 2 === 1) {
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
    if (teamAScore === 7 && teamBScore === 7) {
      return updatedMatch;
    }
    if (
      (teamAScore >= 8 && teamAScore - teamBScore >= 2) ||
      (teamBScore >= 8 && teamBScore - teamAScore >= 2) ||
      (teamAScore === 9 && teamBScore < 8) ||
      (teamBScore === 9 && teamAScore < 8)
    ) {
      return winSet(team, updatedMatch);
    }
    if ((teamAScore === 9 && teamBScore === 7) || (teamBScore === 9 && teamAScore === 7)) {
      return winSet(team, updatedMatch);
    }
    return updatedMatch;
  }
  // Fast4
  const scoringSystem = updatedMatch.settings.scoringSystem || "classic";
  const gamesNeededToWin = scoringSystem === "fast4" ? 4 : 6;
  const tiebreakAt = Number.parseInt(updatedMatch.settings.tiebreakAt?.split("-")[0] || "6");
  const isDecidingSet = updatedMatch.score.sets.length + 1 === updatedMatch.settings.sets;
  const isTwoSetsMatch =
    updatedMatch.settings.sets === 2 && updatedMatch.score.teamA === 1 && updatedMatch.score.teamB === 1;
  if (updatedMatch.settings.finalSetTiebreak && (isDecidingSet || isTwoSetsMatch)) {
    if (currentSet.teamA === tiebreakAt && currentSet.teamB === tiebreakAt) {
      currentSet.isTiebreak = true;
      currentSet.isSuperTiebreak = true;
      return updatedMatch;
    }
  } else if (
    updatedMatch.settings.tiebreakEnabled &&
    currentSet.teamA === tiebreakAt &&
    currentSet.teamB === tiebreakAt
  ) {
    currentSet.isTiebreak = true;
    return updatedMatch;
  }
  // Golden game
  if (updatedMatch.settings.goldenGame) {
    if ((currentSet.teamA === 6 && currentSet.teamB === 5) || (currentSet.teamA === 5 && currentSet.teamB === 6)) {
      const setWinner = currentSet.teamA > currentSet.teamB ? "teamA" : "teamB";
      return winSet(setWinner, updatedMatch);
    }
  }
  // Set win
  if (currentSet.teamA >= gamesNeededToWin && currentSet.teamA - currentSet.teamB >= 2) {
    return winSet("teamA", updatedMatch);
  } else if (currentSet.teamB >= gamesNeededToWin && currentSet.teamB - currentSet.teamA >= 2) {
    return winSet("teamB", updatedMatch);
  }
  // Fast4 set win
  if (scoringSystem === "fast4") {
    if (currentSet.teamA >= gamesNeededToWin && currentSet.teamA - currentSet.teamB >= 1) {
      return winSet("teamA", updatedMatch);
    } else if (currentSet.teamB >= gamesNeededToWin && currentSet.teamB - currentSet.teamA >= 1) {
      return winSet("teamB", updatedMatch);
    }
  }
  return updatedMatch;
}

// Helper: handle winning a set
function winSet(team, updatedMatch) {
  updatedMatch.score[team]++;
  const setToSave = {
    teamA: updatedMatch.score.currentSet.teamA,
    teamB: updatedMatch.score.currentSet.teamB,
    winner: team,
  };
  if (updatedMatch.score.currentSet.isTiebreak) {
    setToSave.tiebreak = {
      teamA: updatedMatch.score.currentSet.currentGame.teamA,
      teamB: updatedMatch.score.currentSet.currentGame.teamB,
    };
  }
  updatedMatch.score.sets.push(setToSave);
  const totalSets = updatedMatch.settings.sets;
  if (totalSets === 2) {
    if (updatedMatch.score[team] === 2) {
      updatedMatch.isCompleted = true;
      updatedMatch.winner = team;
      return updatedMatch;
    }
  } else {
    const setsToWin = Math.ceil(updatedMatch.settings.sets / 2);
    if (updatedMatch.score[team] >= setsToWin) {
      updatedMatch.isCompleted = true;
      updatedMatch.winner = team;
      return updatedMatch;
    }
  }
  // Super tiebreak for deciding set
  const isDecidingSet = updatedMatch.score.sets.length + 1 === updatedMatch.settings.sets;
  const isTwoSetsMatch = updatedMatch.settings.sets === 2;
  const isThirdSetTiebreak =
    updatedMatch.settings.finalSetTiebreak &&
    (isDecidingSet || (isTwoSetsMatch && updatedMatch.score.teamA === 1 && updatedMatch.score.teamB === 1));
  if (isThirdSetTiebreak) {
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
  if (updatedMatch.score.sets.length % 2 === 1) {
    updatedMatch.courtSides = {
      teamA: updatedMatch.courtSides.teamA === "left" ? "right" : "left",
      teamB: updatedMatch.courtSides.teamB === "left" ? "right" : "left",
    };
  }
  return updatedMatch;
}

// Helper: switch server
function switchServer(updatedMatch) {
  if (!updatedMatch.currentServer) return updatedMatch;
  const currentTeam = updatedMatch.currentServer.team;
  const otherTeam = currentTeam === "teamA" ? "teamB" : "teamA";
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
  return updatedMatch;
}
