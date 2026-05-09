import { NextRequest, NextResponse } from "next/server";
import { getSpotifyToken } from "@/lib/spotify-auth";
import {
  ParsedArtist,
  ParsedAlbum,
  ParsedSong,
  ParsedSpotifyData,
  SpotifyPlaylist,
} from "@/types/spotify";

export const dynamic = "force-dynamic";

// ─── Local Spotify API types ───────────────────────────────────────────────

interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  artists: Array<{ name: string }>;
  album: { name: string };
  popularity: number;
  duration_ms: number;
}

interface SpotifyTopArtist {
  id: string;
  name: string;
  uri: string;
  popularity: number;
  genres: string[];
  images: Array<{ url: string }>;
  followers: { total: number };
}

interface SpotifyProfile {
  id: string;
  display_name: string;
  email: string;
  country: string;
  product: string; // "premium" | "free" | "open"
  images: Array<{ url: string }>;
  followers: { total: number };
}

// ─── Fetcher ───────────────────────────────────────────────────────────────

async function spotifyGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("Spotify token expired or invalid");
  if (res.status === 403) throw new Error("Spotify permission denied — check OAuth scopes");
  if (res.status === 429) throw new Error("Spotify rate limit hit — try again in a moment");
  if (!res.ok) throw new Error(`Spotify error ${res.status} on ${path}`);
  return res.json();
}

// ─── Converters ───────────────────────────────────────────────────────────

function trackToSong(track: SpotifyTrack): ParsedSong {
  return {
    id: track.id,
    name: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    album: track.album.name,
    uri: track.uri,
    // Use Spotify popularity (0–100) as seeding proxy — never display as "play count"
    playCount: track.popularity,
    msPlayed: 0,
    popularity: track.popularity,
    duration_ms: track.duration_ms,
  };
}

function topArtistToParsed(artist: SpotifyTopArtist): ParsedArtist {
  return {
    name: artist.name,
    uri: artist.uri,
    totalPlays: 0,
    totalMsPlayed: 0,
    songs: [],
    albumCount: 0,
    popularity: artist.popularity,
    genres: artist.genres,
    image: artist.images[0]?.url,
  };
}

// ─── Paginated fetchers ────────────────────────────────────────────────────

async function fetchAllLikedSongs(
  token: string,
  max = 500
): Promise<Array<{ track: SpotifyTrack; added_at: string }>> {
  const limit = 50;
  const first = await spotifyGet<{
    items: Array<{ track: SpotifyTrack | null; added_at: string }>;
    total: number;
  }>(`/me/tracks?limit=${limit}&offset=0`, token);

  const items = first.items.filter(
    (i): i is { track: SpotifyTrack; added_at: string } => !!i?.track?.id
  );
  if (first.total <= limit) return items;

  // Sequential pages — avoids firing 40 simultaneous requests and hitting rate limits
  const totalToFetch = Math.min(first.total, max);
  const extraPages = Math.ceil((totalToFetch - limit) / limit);
  for (let i = 0; i < extraPages; i++) {
    const page = await spotifyGet<{ items: Array<{ track: SpotifyTrack | null; added_at: string }> }>(
      `/me/tracks?limit=${limit}&offset=${(i + 1) * limit}`,
      token
    ).catch(() => ({ items: [] as Array<{ track: SpotifyTrack | null; added_at: string }> }));
    items.push(...page.items.filter((i): i is { track: SpotifyTrack; added_at: string } => !!i?.track?.id));
  }
  return items.slice(0, max);
}

// Raw shape Spotify returns for a playlist in the /me/playlists listing
interface RawPlaylistItem {
  id: string;
  name: string;
  description?: string;
  images?: Array<{ url: string }>;
  uri: string;
  owner?: { id?: string };
  tracks?: { href?: string; total?: number } | null;
}

async function fetchAllPlaylists(token: string): Promise<SpotifyPlaylist[]> {
  const limit = 50;
  const first = await spotifyGet<{ items: RawPlaylistItem[]; total: number }>(
    `/me/playlists?limit=${limit}&offset=0`,
    token
  );
  const raw = first.items.filter((p) => !!p?.id);

  if (first.total > limit) {
    const extraPages = Math.ceil((first.total - limit) / limit);
    // Sequential to stay within rate limits
    for (let i = 0; i < extraPages; i++) {
      const page = await spotifyGet<{ items: RawPlaylistItem[] }>(
        `/me/playlists?limit=${limit}&offset=${(i + 1) * limit}`,
        token
      ).catch(() => ({ items: [] as RawPlaylistItem[] }));
      raw.push(...page.items.filter((p) => !!p?.id));
    }
  }

  // Some Spotify playlist types (Daylist, AI playlists, radio) return tracks: null.
  // Fetch the real count for up to 10 of these sequentially.
  const needsCount = raw.filter(p => p.tracks?.total == null).slice(0, 10);
  for (const p of needsCount) {
    const res = await spotifyGet<{ tracks?: { total?: number } | null }>(
      `/playlists/${p.id}?fields=tracks.total`,
      token
    ).catch(() => ({ tracks: null }));
    const total = res?.tracks?.total;
    if (total != null) p.tracks = { total };
  }
  if (needsCount.length > 0) {
    console.log(`[spotify/sync] Refreshed track counts for ${needsCount.length} playlists`);
  }

  return raw.map((p): SpotifyPlaylist => ({
    id: p.id,
    name: p.name,
    description: p.description,
    images: p.images ?? [],
    uri: p.uri,
    ownerId: p.owner?.id,
    tracks: p.tracks?.total != null ? { total: p.tracks.total } : null,
  }));
}

// ─── Route handler ────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { token, errorResponse, setCookies } = await getSpotifyToken(request);
  if (!token) return errorResponse!;

  try {
    // Run all 10 Spotify API calls in parallel
    const [
      likedResult,
      recentResult,
      playlistsResult,
      profileResult,
      topTracksShortResult,
      topTracksMediumResult,
      topTracksLongResult,
      topArtistsShortResult,
      topArtistsMediumResult,
      topArtistsLongResult,
    ] = await Promise.allSettled([
      fetchAllLikedSongs(token),
      spotifyGet<{ items: Array<{ track: SpotifyTrack; played_at: string }> }>(
        "/me/player/recently-played?limit=50",
        token
      ),
      fetchAllPlaylists(token),
      spotifyGet<SpotifyProfile>("/me", token),
      spotifyGet<{ items: SpotifyTrack[] }>(
        "/me/top/tracks?limit=50&time_range=short_term",
        token
      ),
      spotifyGet<{ items: SpotifyTrack[] }>(
        "/me/top/tracks?limit=50&time_range=medium_term",
        token
      ),
      spotifyGet<{ items: SpotifyTrack[] }>(
        "/me/top/tracks?limit=50&time_range=long_term",
        token
      ),
      spotifyGet<{ items: SpotifyTopArtist[] }>(
        "/me/top/artists?limit=50&time_range=short_term",
        token
      ),
      spotifyGet<{ items: SpotifyTopArtist[] }>(
        "/me/top/artists?limit=50&time_range=medium_term",
        token
      ),
      spotifyGet<{ items: SpotifyTopArtist[] }>(
        "/me/top/artists?limit=50&time_range=long_term",
        token
      ),
    ]);

    // Graceful degradation — use whatever succeeded
    const likedItems =
      likedResult.status === "fulfilled" ? likedResult.value : [];

    const recentItems =
      recentResult.status === "fulfilled"
        ? recentResult.value.items.filter((i) => !!i?.track?.id)
        : [];

    // Only include playlists the user owns — followed/Spotify-generated ones return 403
    // on track fetching, and we want the playlist list to only show actionable items.
    const userId = profileResult.status === "fulfilled" ? profileResult.value.id : null;
    const allFetchedPlaylists = playlistsResult.status === "fulfilled" ? playlistsResult.value : [];
    const playlists: SpotifyPlaylist[] = userId
      ? allFetchedPlaylists.filter((pl) => pl.ownerId === userId)
      : allFetchedPlaylists;
    console.log(`[spotify/sync] userId=${userId ?? "unknown"} playlists: ${allFetchedPlaylists.length} total → ${playlists.length} owned`);

    const profile =
      profileResult.status === "fulfilled" ? profileResult.value : null;

    const topTracksShort =
      topTracksShortResult.status === "fulfilled"
        ? topTracksShortResult.value.items.filter(Boolean)
        : [];

    const topTracksMedium =
      topTracksMediumResult.status === "fulfilled"
        ? topTracksMediumResult.value.items.filter(Boolean)
        : [];

    const topTracksLong =
      topTracksLongResult.status === "fulfilled"
        ? topTracksLongResult.value.items.filter(Boolean)
        : [];

    const topArtistsShort =
      topArtistsShortResult.status === "fulfilled"
        ? topArtistsShortResult.value.items.filter(Boolean)
        : [];

    const topArtistsMedium =
      topArtistsMediumResult.status === "fulfilled"
        ? topArtistsMediumResult.value.items.filter(Boolean)
        : [];

    const topArtistsLong =
      topArtistsLongResult.status === "fulfilled"
        ? topArtistsLongResult.value.items.filter(Boolean)
        : [];

    console.log("[spotify/sync] API results:", {
      liked: likedResult.status === "fulfilled" ? likedResult.value.length : `FAILED: ${likedResult.reason}`,
      recent: recentResult.status === "fulfilled" ? recentResult.value.items.length : `FAILED: ${recentResult.reason}`,
      playlists: playlistsResult.status === "fulfilled" ? playlistsResult.value.length : `FAILED: ${playlistsResult.reason}`,
      profile: profileResult.status === "fulfilled" ? profileResult.value.display_name : `FAILED: ${profileResult.reason}`,
      topTracksMedium: topTracksMediumResult.status === "fulfilled" ? topTracksMediumResult.value.items.length : `FAILED: ${topTracksMediumResult.reason}`,
      topArtistsMedium: topArtistsMediumResult.status === "fulfilled" ? topArtistsMediumResult.value.items.length : `FAILED: ${topArtistsMediumResult.reason}`,
    });

    // Need at least liked OR recently played OR top tracks to do anything useful
    const hasData =
      likedItems.length > 0 ||
      recentItems.length > 0 ||
      topTracksMedium.length > 0;

    if (!hasData) {
      const firstError =
        likedResult.status === "rejected" ? likedResult.reason?.message :
        recentResult.status === "rejected" ? recentResult.reason?.message :
        "All Spotify requests failed";
      return NextResponse.json({ error: firstError }, { status: 502 });
    }

    // ── Build liked songs list ─────────────────────────────────────────────
    // Seeded by recency in library (recently liked = higher score) + boost if recently played
    const recentCountMap = new Map<string, number>();
    for (const item of recentItems) {
      recentCountMap.set(item.track.uri, (recentCountMap.get(item.track.uri) ?? 0) + 1);
    }

    const likedSongs: ParsedSong[] = likedItems.map((item, idx) => ({
      id: item.track.id,
      name: item.track.name,
      artist: item.track.artists.map((a) => a.name).join(", "),
      album: item.track.album.name,
      uri: item.track.uri,
      // playCount = Spotify popularity (0–100, stream-based) boosted by recent plays.
      // Popularity is real data; the recent-play boost ensures your personal activity
      // nudges loved songs slightly higher. Never display this number as "play count."
      playCount: (item.track.popularity > 0 ? item.track.popularity : 50)
        + (recentCountMap.get(item.track.uri) ?? 0) * 3,
      msPlayed: 0,
      popularity: item.track.popularity,
      duration_ms: item.track.duration_ms,
    }));

    // Recently played tracks not already in liked songs (for bracket pool)
    const likedUris = new Set(likedSongs.map((s) => s.uri));
    const seenRecent = new Set<string>();
    const recentExtra: ParsedSong[] = [];
    for (const item of recentItems) {
      if (likedUris.has(item.track.uri) || seenRecent.has(item.track.uri)) continue;
      seenRecent.add(item.track.uri);
      recentExtra.push({
        id: item.track.id,
        name: item.track.name,
        artist: item.track.artists.map((a) => a.name).join(", "),
        album: item.track.album.name,
        uri: item.track.uri,
        playCount: (item.track.popularity > 0 ? item.track.popularity : 50)
          + (recentCountMap.get(item.track.uri) ?? 0) * 3,
        msPlayed: 0,
        popularity: item.track.popularity,
        duration_ms: item.track.duration_ms,
      });
    }

    const allSongs = [...likedSongs, ...recentExtra];

    // Supplement with Spotify top tracks not already in the pool.
    // Ensures artists/albums are always populated even when liked songs / recently
    // played APIs fail or the user has an empty library.
    const allSongsUriSet = new Set(allSongs.map((s) => s.uri));
    for (const track of [...topTracksMedium, ...topTracksShort, ...topTracksLong]) {
      if (!allSongsUriSet.has(track.uri)) {
        allSongsUriSet.add(track.uri);
        allSongs.push(trackToSong(track));
      }
    }
    allSongs.sort((a, b) => b.playCount - a.playCount);

    // ── Build artist map from liked + recently played ──────────────────────
    const artistMap = new Map<string, ParsedArtist>();
    for (const song of allSongs) {
      const existing = artistMap.get(song.artist);
      if (existing) {
        existing.songs.push(song);
        existing.totalPlays += song.playCount;
      } else {
        artistMap.set(song.artist, {
          name: song.artist,
          totalPlays: song.playCount,
          totalMsPlayed: 0,
          songs: [song],
          albumCount: 0,
        });
      }
    }
    for (const artist of artistMap.values()) {
      artist.albumCount = new Set(artist.songs.map((s) => s.album)).size;
    }
    const artists = Array.from(artistMap.values()).sort((a, b) => b.totalPlays - a.totalPlays);

    // ── Build album map ────────────────────────────────────────────────────
    const albumMap = new Map<string, ParsedAlbum>();
    for (const song of allSongs) {
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
    const albums = Array.from(albumMap.values()).sort((a, b) => b.totalPlays - a.totalPlays);

    // ── Convert top tracks & artists ───────────────────────────────────────
    const topTracksShortParsed = topTracksShort.map(trackToSong);
    const topTracksMediumParsed = topTracksMedium.map(trackToSong);
    const topTracksLongParsed = topTracksLong.map(trackToSong);

    const topArtistsShortParsed = topArtistsShort.map(topArtistToParsed);
    const topArtistsMediumParsed = topArtistsMedium.map(topArtistToParsed);
    const topArtistsLongParsed = topArtistsLong.map(topArtistToParsed);

    // ── Recently played list (deduped, for dashboard display) ──────────────
    const recentlyPlayedDisplay: ParsedSong[] = [];
    const seenForRecent = new Set<string>();
    for (const item of recentItems) {
      if (seenForRecent.has(item.track.uri)) continue;
      seenForRecent.add(item.track.uri);
      recentlyPlayedDisplay.push({
        id: item.track.id,
        name: item.track.name,
        artist: item.track.artists.map((a) => a.name).join(", "),
        album: item.track.album.name,
        uri: item.track.uri,
        playCount: 0,
        msPlayed: 0,
        popularity: item.track.popularity,
        duration_ms: item.track.duration_ms,
      });
    }

    const result: ParsedSpotifyData = {
      songs: allSongs,
      artists,
      albums,
      likedSongs,
      // topSongs = Spotify's algorithmic top tracks (medium term) — used for "My Top Songs" bracket
      topSongs: topTracksMediumParsed.length > 0 ? topTracksMediumParsed : allSongs.slice(0, 50),
      // topArtists = Spotify's algorithmic top artists (medium term) — used for dashboard charts
      topArtists: topArtistsMediumParsed.length > 0 ? topArtistsMediumParsed : artists.slice(0, 20),
      totalPlays: 0,       // not available via OAuth — never fabricate this
      totalMsPlayed: 0,    // not available via OAuth — never fabricate this
      dateRange: null,
      dataSource: "oauth",
      topTracksByTimeRange: {
        short: topTracksShortParsed,
        medium: topTracksMediumParsed,
        long: topTracksLongParsed,
      },
      topArtistsByTimeRange: {
        short: topArtistsShortParsed,
        medium: topArtistsMediumParsed,
        long: topArtistsLongParsed,
      },
      recentlyPlayed: recentlyPlayedDisplay,
      playlists,
      userProfile: profile
        ? {
            id: profile.id,
            name: profile.display_name,
            email: profile.email,
            image: profile.images[0]?.url,
            country: profile.country,
            product: profile.product,
            followers: profile.followers?.total,
          }
        : undefined,
    };

    if (process.env.NODE_ENV === "development") {
      console.log("[spotify/sync] Built result:", {
        songs: result.songs.length,
        likedSongs: result.likedSongs.length,
        topSongs: result.topSongs.length,
        artists: result.artists.length,
        albums: result.albums.length,
        playlists: result.playlists?.length ?? 0,
        recentlyPlayed: result.recentlyPlayed?.length ?? 0,
      });
    }

    const response = NextResponse.json(result);
    setCookies(response);
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Spotify sync error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
