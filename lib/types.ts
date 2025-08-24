export interface Player {
  id: string;
  name: string;
  number?: number;
  color?: string;
  local_expire_at?: number; // ms since epoch, for temporary local-only players
}

export interface AddPlayerOptions {
  localOnly?: boolean;
  expireMs?: number;
}

export interface UpdatePlayerOptions {
  name?: string;
  number?: number;
  color?: string;
}

export interface Team {
  players: Player[];
  name?: string;
}

export interface Match {
  created_via_court_link?: boolean;
  id: string;
  isCompleted: boolean;
  createdAt: string;
  type: string;
  code?: string;
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
    sets?: any[]; // Use any[] as placeholder for set structure
    currentSet?: any; // Use any as placeholder for currentSet structure
  };
  settings: {
    theme: string;
    colors: {
      teamA: string;
      teamB: string;
      court: string;
    };
  };
  currentServer: {
    team: "teamA" | "teamB";
    playerIndex: number;
  };
  courtSides?: any;
}
