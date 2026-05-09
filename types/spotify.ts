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

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description?: string;
  images: Array<{ url: string }>;
  tracks: { total: number } | null;
  uri: string;
}

// Parsed & normalized song for use in the app
export interface ParsedSong {
  id: string;
  name: string;
  artist: string;
  album: string;
  uri: string;
  playCount: number;        // real listens (upload) or seeding score (oauth — do NOT display as plays)
  msPlayed: number;         // real total ms played (upload only, always 0 for oauth)
  artistPlayCount?: number; // total plays across all artist songs (for bracket seeding)
  popularity?: number;      // Spotify popularity score 0–100 (oauth only)
  duration_ms?: number;     // track duration in ms
}

export interface ParsedArtist {
  name: string;
  uri?: string;
  totalPlays: number;       // real from upload; synthetic from oauth (do NOT display for oauth)
  totalMsPlayed: number;    // real from upload; always 0 for oauth
  songs: ParsedSong[];
  albumCount: number;
  popularity?: number;      // Spotify artist popularity 0–100 (oauth only)
  genres?: string[];        // Spotify-assigned genres (oauth only)
  image?: string;           // Artist image URL (oauth only)
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

  // "oauth" = connected via Spotify login; "upload" = Spotify data export file
  dataSource?: "oauth" | "upload";

  // OAuth-only: Spotify's algorithmic top tracks per time range
  topTracksByTimeRange?: {
    short: ParsedSong[];   // ~4 weeks
    medium: ParsedSong[];  // ~6 months
    long: ParsedSong[];    // all time
  };

  // OAuth-only: Spotify's algorithmic top artists per time range
  topArtistsByTimeRange?: {
    short: ParsedArtist[];
    medium: ParsedArtist[];
    long: ParsedArtist[];
  };

  // OAuth-only: recently played tracks (up to 50)
  recentlyPlayed?: ParsedSong[];

  // OAuth-only: user's playlists
  playlists?: SpotifyPlaylist[];

  // OAuth-only: Spotify profile info
  userProfile?: {
    name: string;
    email?: string;
    image?: string;
    country?: string;
    product?: string;    // "premium" | "free" | "open"
    followers?: number;
  };

  // Upload-only: detailed listening patterns from streaming history
  listeningPatterns?: {
    hourlyDistribution: number[];           // 24 entries (hour 0–23)
    dailyDistribution: number[];            // 7 entries (0 = Sunday)
    skipRate: number;                       // 0.0 – 1.0
    platformCounts: Record<string, number>; // e.g. { "iOS": 1200, "Android": 400 }
    shuffleRatio: number;                   // 0.0 – 1.0
  };
}

// Bracket types
export type BracketMode = "liked" | "artist" | "album" | "top" | "playlist";
export type SeedingMethod = "personal" | "artist_total" | "popularity";
export type BracketSize = 8 | 16 | 32 | 64;

export interface BracketSong extends ParsedSong {
  seed: number;
  eliminated: boolean;
}

export interface BracketMatch {
  id: string;
  songA: BracketSong | null;
  songB: BracketSong | null;
  winnerId: string | null; // winning song URI
  position: number;
}

export interface BracketRound {
  roundNumber: number; // 1 = first round
  label: string;       // "Round of 16", "Quarterfinal", etc.
  matches: BracketMatch[];
}

export interface Bracket {
  id: string;
  name: string;
  mode: BracketMode;
  filter: string;
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
