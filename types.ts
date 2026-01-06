export interface Country {
  id: string;
  code: string; // ISO 2-letter code for flags
  name: string;
  color: string;
  wins: number;
  isChampion: boolean;
}

export interface ChampionRecord {
  countryId: string;
  name: string;
  code: string;
  wonAt: number; // Timestamp or order index
}

export interface GameState {
  isPlaying: boolean;
  roundWinner: Country | null;
  remainingCount: number;
}