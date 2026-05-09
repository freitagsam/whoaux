// Spotify Extended Streaming History format (from data export)
export interface SpotifyStreamEntry {
  ts: string; // ISO timestamp
  username?: string;
  platform?: string;
  ms_played: number;
  conn_country?: string;
  master_metadata_track_name: string | null;
  master_metadata_album_artist_name: string | null;
  master_metadata_album_album_name: string | null;
  spotify_track_uri: string | null;
  episode_name?: string | null;
  episode_show_name?: string | null;
  reason_start?: string;
  reason_end?: string;
  shuffle?: boolean;
  skipped?: boolean | null;
  offline?: boolean;
  incognito_mode?: boolean;
}

// YourLibrary.json format
export interface SpotifyLibraryTrack {
  artist: string;
  album: string;
  track: string;
  uri: string;
}

export interface SpotifyLibraryAlbum {
  artist: string;
  album: string;
  uri: string;
}

export interface SpotifyLibraryArtist {
  name: string;
  uri: string;
}

export interface SpotifyLibrary {
  tracks: SpotifyLibraryTrack[];
  albums: SpotifyLibraryAlbum[];
  artists: SpotifyLibraryArtist[];
  shows?: unknown[];
  episodes?: unknown[];
  bannedTracks?: unknown[];
  other?: unknown[];
}

// Parsed & normalized song for use in the app
export interface ParsedSong {
  id: string; // derived from URI or generated
  name: string;
  artist: string;
  album: string;
  uri: string;
  playCount: number; // personal listens
  msPlayed: number; // total ms played personally
  artistPlayCount?: number; // total plays across all artist songs (for seeding)
}

export interface ParsedArtist {
  name: string;
  uri?: string;
  totalPlays: number;
  totalMsPlayed: number;
  songs: ParsedSong[];
  albumCount: number;
}

export interface ParsedAlbum {
  name: string;
  artist: string;
  songs: ParsedSong[];
  totalPlays: number;
}

export interface ParsedSpotifyData {
  songs: ParsedSong[];
  artists: ParsedArtist[];
  albums: ParsedAlbum[];
  likedSongs: ParsedSong[];
  topSongs: ParsedSong[];
  topArtists: ParsedArtist[];
  totalPlays: number;
  totalMsPlayed: number;
  dateRange: { start: string; end: string } | null;
}

// Bracket types
export type BracketMode = "liked" | "artist" | "album" | "top";
export type SeedingMethod = "personal" | "artist_total";
export type BracketSize = 8 | 16 | 32 | 64;

export interface BracketSong extends ParsedSong {
  seed: number;
  eliminated: boolean;
}

export interface BracketMatch {
  id: string;
  songA: BracketSong | null;
  songB: BracketSong | null;
  winnerId: string | null; // song URI
  position: number; // position in round
}

export interface BracketRound {
  roundNumber: number; // 1 = first round, increases toward final
  label: string; // "Round of 16", "Quarterfinal", etc.
  matches: BracketMatch[];
}

export interface Bracket {
  id: string;
  name: string;
  mode: BracketMode;
  filter: string; // artist name, album name, or "liked"/"top"
  seedingMethod: SeedingMethod;
  size: BracketSize;
  rounds: BracketRound[];
  currentRound: number;
  currentMatchIndex: number;
  winner: BracketSong | null;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

// Upload state
export interface UploadedFile {
  name: string;
  type: "streaming_history" | "library" | "unknown";
  data: SpotifyStreamEntry[] | SpotifyLibrary | unknown;
  size: number;
}
