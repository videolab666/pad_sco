export interface Player {
  name: string;
  number?: number;
  color?: string;
}

export interface Team {
  players: Player[];
  name?: string;
}

export interface Match {
  id: string;
  courtNumber: number;
  teamA: Team;
  teamB: Team;
  sets: {
    number: number;
    pointsA: number;
    pointsB: number;
  }[];
  currentSet: number;
  currentPoint: number;
  score: {
    teamA: number;
    teamB: number;
  };
  settings: {
    theme: string;
    colors: {
      teamA: string;
      teamB: string;
      court: string;
    };
  };
}
