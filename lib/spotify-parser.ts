import {
  SpotifyStreamEntry,
  SpotifyLibrary,
  ParsedSong,
  ParsedArtist,
  ParsedAlbum,
  ParsedSpotifyData,
  UploadedFile,
} from "@/types/spotify";

function generateId(uri: string): string {
  if (uri && uri.includes(":")) {
    return uri.split(":").pop() || uri;
  }
  return uri;
}

function detectFileType(
  filename: string,
  data: unknown
): UploadedFile["type"] {
  if (
    filename.toLowerCase().includes("streaming") ||
    filename.toLowerCase().includes("history")
  ) {
    return "streaming_history";
  }
  if (
    filename.toLowerCase().includes("library") ||
    filename.toLowerCase().includes("yourlibrary")
  ) {
    return "library";
  }
  // Try to detect by shape
  if (Array.isArray(data)) {
    const first = (data as unknown[])[0];
    if (
      first &&
      typeof first === "object" &&
      ("master_metadata_track_name" in (first as object) ||
        "ms_played" in (first as object))
    ) {
      return "streaming_history";
    }
  }
  if (data && typeof data === "object" && "tracks" in (data as object)) {
    return "library";
  }
  return "unknown";
}

export function classifyFiles(files: { name: string; data: unknown }[]): UploadedFile[] {
  return files.map((f) => ({
    name: f.name,
    type: detectFileType(f.name, f.data),
    data: f.data,
    size: JSON.stringify(f.data).length,
  }));
}

export function parseSpotifyData(files: UploadedFile[]): ParsedSpotifyData {
  const streamingFiles = files.filter((f) => f.type === "streaming_history");
  const libraryFiles = files.filter((f) => f.type === "library");

  // Build song play counts from streaming history
  const songMap = new Map<
    string,
    {
      name: string;
      artist: string;
      album: string;
      uri: string;
      playCount: number;
      msPlayed: number;
    }
  >();

  const artistMap = new Map<
    string,
    {
      name: string;
      totalPlays: number;
      totalMsPlayed: number;
      songs: Set<string>;
    }
  >();

  let earliestDate: Date | null = null;
  let latestDate: Date | null = null;
  let totalPlays = 0;
  let totalMsPlayed = 0;

  // Listening pattern accumulators
  const hourlyDistribution = new Array<number>(24).fill(0);
  const dailyDistribution = new Array<number>(7).fill(0);
  const platformCounts: Record<string, number> = {};
  let skippedCount = 0;
  let shuffleOnCount = 0;
  let patternTotal = 0; // entries counted for patterns (before skip filter)

  for (const file of streamingFiles) {
    const entries = file.data as SpotifyStreamEntry[];
    if (!Array.isArray(entries)) continue;

    for (const entry of entries) {
      if (!entry.master_metadata_track_name || !entry.spotify_track_uri) continue;
      // Skip podcasts/episodes
      if (entry.episode_name) continue;
      // Count for patterns before the 15s filter
      if (entry.ms_played > 0) {
        patternTotal += 1;
        if (entry.skipped === true || entry.reason_end === "fwdbtn") skippedCount += 1;
        if (entry.shuffle === true) shuffleOnCount += 1;
        if (entry.platform) {
          const p = normalizePlatform(entry.platform);
          platformCounts[p] = (platformCounts[p] ?? 0) + 1;
        }
        const date = new Date(entry.ts);
        if (!isNaN(date.getTime())) {
          hourlyDistribution[date.getHours()] += 1;
          dailyDistribution[date.getDay()] += 1;
        }
      }

      // Skip very short plays (under 15 seconds = likely skip)
      if (entry.ms_played < 15000) continue;

      const uri = entry.spotify_track_uri;
      const name = entry.master_metadata_track_name;
      const artist = entry.master_metadata_album_artist_name || "Unknown Artist";
      const album = entry.master_metadata_album_album_name || "Unknown Album";

      const existing = songMap.get(uri);
      if (existing) {
        existing.playCount += 1;
        existing.msPlayed += entry.ms_played;
      } else {
        songMap.set(uri, { name, artist, album, uri, playCount: 1, msPlayed: entry.ms_played });
      }

      // Artist tracking
      const artistEntry = artistMap.get(artist);
      if (artistEntry) {
        artistEntry.totalPlays += 1;
        artistEntry.totalMsPlayed += entry.ms_played;
        artistEntry.songs.add(uri);
      } else {
        artistMap.set(artist, {
          name: artist,
          totalPlays: 1,
          totalMsPlayed: entry.ms_played,
          songs: new Set([uri]),
        });
      }

      totalPlays += 1;
      totalMsPlayed += entry.ms_played;

      const date = new Date(entry.ts);
      if (!isNaN(date.getTime())) {
        if (!earliestDate || date < earliestDate) earliestDate = date;
        if (!latestDate || date > latestDate) latestDate = date;
      }
    }
  }

  // Convert to arrays and assign artist play counts
  const songs: ParsedSong[] = Array.from(songMap.values()).map((s) => {
    const artistData = artistMap.get(s.artist);
    return {
      id: generateId(s.uri),
      name: s.name,
      artist: s.artist,
      album: s.album,
      uri: s.uri,
      playCount: s.playCount,
      msPlayed: s.msPlayed,
      artistPlayCount: artistData?.totalPlays ?? s.playCount,
    };
  });

  songs.sort((a, b) => b.playCount - a.playCount);

  // Build artist list
  const artists: ParsedArtist[] = Array.from(artistMap.entries()).map(([name, data]) => {
    const artistSongs = songs.filter((s) => s.artist === name);
    const albumNames = [...new Set(artistSongs.map((s) => s.album))];
    return {
      name,
      totalPlays: data.totalPlays,
      totalMsPlayed: data.totalMsPlayed,
      songs: artistSongs,
      albumCount: albumNames.length,
    };
  });

  artists.sort((a, b) => b.totalPlays - a.totalPlays);

  // Build album list
  const albumMap = new Map<string, ParsedAlbum>();
  for (const song of songs) {
    const key = `${song.album}::${song.artist}`;
    const existing = albumMap.get(key);
    if (existing) {
      existing.songs.push(song);
      existing.totalPlays += song.playCount;
    } else {
      albumMap.set(key, {
        name: song.album,
        artist: song.artist,
        songs: [song],
        totalPlays: song.playCount,
      });
    }
  }

  const albums: ParsedAlbum[] = Array.from(albumMap.values()).sort(
    (a, b) => b.totalPlays - a.totalPlays
  );

  // Liked songs from library
  let likedSongs: ParsedSong[] = [];
  for (const file of libraryFiles) {
    const library = file.data as SpotifyLibrary;
    if (!library?.tracks) continue;

    for (const track of library.tracks) {
      if (!track.uri) continue;
      const existing = songs.find((s) => s.uri === track.uri);
      if (existing) {
        likedSongs.push(existing);
      } else {
        // Song in library but not in streaming history
        likedSongs.push({
          id: generateId(track.uri),
          name: track.track,
          artist: track.artist,
          album: track.album,
          uri: track.uri,
          playCount: 0,
          msPlayed: 0,
        });
      }
    }
  }

  // If no library file, liked songs = all tracked songs (fallback)
  if (likedSongs.length === 0 && songs.length > 0) {
    likedSongs = songs.slice(0, Math.min(songs.length, 200));
  }

  const listeningPatterns =
    patternTotal > 0
      ? {
          hourlyDistribution,
          dailyDistribution,
          skipRate: skippedCount / patternTotal,
          platformCounts,
          shuffleRatio: shuffleOnCount / patternTotal,
        }
      : undefined;

  return {
    songs,
    artists,
    albums,
    likedSongs,
    topSongs: songs.slice(0, 50),
    topArtists: artists.slice(0, 20),
    totalPlays,
    totalMsPlayed,
    dateRange:
      earliestDate && latestDate
        ? {
            start: earliestDate.toISOString(),
            end: latestDate.toISOString(),
          }
        : null,
    dataSource: "upload" as const,
    listeningPatterns,
  };
}

// Normalize Spotify platform strings into readable labels
function normalizePlatform(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("ios") || lower.includes("iphone") || lower.includes("ipad")) return "iOS";
  if (lower.includes("android")) return "Android";
  if (lower.includes("windows")) return "Windows";
  if (lower.includes("mac") || lower.includes("osx")) return "Mac";
  if (lower.includes("web") || lower.includes("browser")) return "Web";
  if (lower.includes("cast") || lower.includes("speaker")) return "Speaker";
  return "Other";
}

export function formatPlaytime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function formatPlayCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}
