import { ParsedSong, ParsedArtist, ParsedAlbum, ParsedSpotifyData } from "@/types/spotify";

// --- Raw Spotify API types ---

interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

interface SpotifyArtistObject {
  id: string;
  name: string;
  uri: string;
  images?: SpotifyImage[];
}

interface SpotifyAlbumObject {
  id: string;
  name: string;
  uri: string;
  artists: SpotifyArtistObject[];
  images: SpotifyImage[];
}

interface SpotifyTrackObject {
  id: string;
  name: string;
  uri: string;
  artists: SpotifyArtistObject[];
  album: SpotifyAlbumObject;
  duration_ms: number;
  popularity: number;
}

interface SpotifyRecentlyPlayedItem {
  track: SpotifyTrackObject;
  played_at: string;
}

interface SpotifyPlaylistObject {
  id: string;
  name: string;
  description: string;
  tracks: { total: number };
  images: SpotifyImage[];
  uri: string;
}

interface PagingObject<T> {
  items: T[];
  total: number;
  next: string | null;
  offset: number;
  limit: number;
}

// --- Fetcher ---

async function spotifyFetch<T>(
  endpoint: string,
  accessToken: string
): Promise<T> {
  const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Spotify API error: ${res.status} ${endpoint}`);
  return res.json();
}

// Paginate through all items (up to maxItems)
async function fetchAllPaged<T>(
  endpoint: string,
  accessToken: string,
  maxItems = 500
): Promise<T[]> {
  const items: T[] = [];
  let url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}limit=50&offset=0`;

  while (url && items.length < maxItems) {
    const page = await spotifyFetch<PagingObject<T>>(url, accessToken);
    items.push(...page.items.filter(Boolean));
    if (!page.next) break;
    // Extract relative path from absolute next URL
    url = page.next.replace("https://api.spotify.com/v1", "");
  }

  return items.slice(0, maxItems);
}

// --- Public API functions ---

export async function fetchTopTracks(
  accessToken: string,
  timeRange: "short_term" | "medium_term" | "long_term" = "medium_term"
): Promise<SpotifyTrackObject[]> {
  const data = await spotifyFetch<PagingObject<SpotifyTrackObject>>(
    `/me/top/tracks?limit=50&time_range=${timeRange}`,
    accessToken
  );
  return data.items;
}

export async function fetchTopArtists(
  accessToken: string,
  timeRange: "short_term" | "medium_term" | "long_term" = "medium_term"
): Promise<SpotifyArtistObject[]> {
  const data = await spotifyFetch<PagingObject<SpotifyArtistObject>>(
    `/me/top/artists?limit=50&time_range=${timeRange}`,
    accessToken
  );
  return data.items;
}

export async function fetchLikedSongs(
  accessToken: string
): Promise<Array<{ track: SpotifyTrackObject; added_at: string }>> {
  return fetchAllPaged<{ track: SpotifyTrackObject; added_at: string }>(
    "/me/tracks",
    accessToken,
    500
  );
}

export async function fetchRecentlyPlayed(
  accessToken: string
): Promise<SpotifyRecentlyPlayedItem[]> {
  const data = await spotifyFetch<{ items: SpotifyRecentlyPlayedItem[] }>(
    "/me/player/recently-played?limit=50",
    accessToken
  );
  return data.items;
}

export async function fetchPlaylists(
  accessToken: string
): Promise<SpotifyPlaylistObject[]> {
  return fetchAllPaged<SpotifyPlaylistObject>("/me/playlists", accessToken, 100);
}

export async function fetchPlaylistTracks(
  playlistId: string,
  accessToken: string
): Promise<SpotifyTrackObject[]> {
  const items = await fetchAllPaged<{ track: SpotifyTrackObject | null }>(
    `/playlists/${playlistId}/tracks`,
    accessToken,
    200
  );
  return items
    .map((i) => i.track)
    .filter((t): t is SpotifyTrackObject => t !== null && !!t.id);
}

export async function fetchCurrentlyPlaying(
  accessToken: string
): Promise<{ name: string; artist: string; album: string; imageUrl?: string } | null> {
  try {
    const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 204 || !res.ok) return null;
    const data = await res.json();
    if (!data?.item) return null;
    const track = data.item as SpotifyTrackObject;
    return {
      name: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      album: track.album.name,
      imageUrl: track.album.images[0]?.url,
    };
  } catch {
    return null;
  }
}

// --- Convert Spotify API data to ParsedSpotifyData format ---

export function convertTopTracksToParsedData(
  tracks: SpotifyTrackObject[],
  timeRange: string
): ParsedSpotifyData {
  const songs: ParsedSong[] = tracks.map((track, idx) => ({
    id: track.id,
    name: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    album: track.album.name,
    uri: track.uri,
    // Spotify doesn't give play counts via API — use rank-based synthetic value
    playCount: tracks.length - idx,
    msPlayed: 0,
    artistPlayCount: tracks.length - idx,
  }));

  return buildParsedData(songs, timeRange);
}

export function convertLikedSongsToParsedData(
  liked: Array<{ track: SpotifyTrackObject; added_at: string }>
): ParsedSpotifyData {
  const songs: ParsedSong[] = liked.map((item, idx) => ({
    id: item.track.id,
    name: item.track.name,
    artist: item.track.artists.map((a) => a.name).join(", "),
    album: item.track.album.name,
    uri: item.track.uri,
    playCount: liked.length - idx,
    msPlayed: 0,
    artistPlayCount: liked.length - idx,
  }));

  return buildParsedData(songs, "liked");
}

export function convertPlaylistTracksToParsedData(
  tracks: SpotifyTrackObject[],
  playlistName: string
): ParsedSpotifyData {
  const songs: ParsedSong[] = tracks.map((track, idx) => ({
    id: track.id,
    name: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    album: track.album.name,
    uri: track.uri,
    playCount: tracks.length - idx,
    msPlayed: 0,
    artistPlayCount: tracks.length - idx,
  }));

  return buildParsedData(songs, playlistName);
}

function buildParsedData(songs: ParsedSong[], source: string): ParsedSpotifyData {
  // Build artist map
  const artistMap = new Map<string, ParsedArtist>();
  for (const song of songs) {
    const name = song.artist;
    const existing = artistMap.get(name);
    if (existing) {
      existing.songs.push(song);
      existing.totalPlays += song.playCount;
    } else {
      artistMap.set(name, {
        name,
        totalPlays: song.playCount,
        totalMsPlayed: 0,
        songs: [song],
        albumCount: 0,
      });
    }
  }

  // Count albums per artist
  for (const artist of artistMap.values()) {
    artist.albumCount = new Set(artist.songs.map((s) => s.album)).size;
  }

  const artists = Array.from(artistMap.values()).sort(
    (a, b) => b.totalPlays - a.totalPlays
  );

  // Build album map
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

  const albums = Array.from(albumMap.values()).sort(
    (a, b) => b.totalPlays - a.totalPlays
  );

  return {
    songs,
    artists,
    albums,
    likedSongs: songs,
    topSongs: songs.slice(0, 50),
    topArtists: artists.slice(0, 20),
    totalPlays: songs.reduce((acc, s) => acc + s.playCount, 0),
    totalMsPlayed: 0,
    dateRange: null,
  };
}
