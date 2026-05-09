import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ParsedArtist, ParsedAlbum, ParsedSong, ParsedSpotifyData } from "@/types/spotify";

// Force dynamic so Next.js never caches this route
export const dynamic = "force-dynamic";

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

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json(
      { error: session?.error === "RefreshAccessTokenError"
          ? "Your Spotify session expired. Please sign in again."
          : "Not signed in" },
      { status: 401 }
    );
  }

  if (session.error) {
    return NextResponse.json(
      { error: "Your Spotify session expired. Please sign in again." },
      { status: 401 }
    );
  }

  const token = session.accessToken;

  try {
    // Three parallel requests — fast, no pagination
    const [likedResult, recentResult, playlistsResult] = await Promise.allSettled([
      spotifyGet<{ items: Array<{ track: SpotifyTrack | null; added_at: string }> }>(
        "/me/tracks?limit=50",
        token
      ),
      spotifyGet<{ items: Array<{ track: SpotifyTrack; played_at: string }> }>(
        "/me/player/recently-played?limit=50",
        token
      ),
      spotifyGet<{ items: SpotifyPlaylist[] }>(
        "/me/playlists?limit=50",
        token
      ),
    ]);

    // Graceful degradation — use whatever succeeded
    const likedItems =
      likedResult.status === "fulfilled"
        ? likedResult.value.items.filter((i): i is { track: SpotifyTrack; added_at: string } => !!i?.track?.id)
        : [];

    const recentItems =
      recentResult.status === "fulfilled"
        ? recentResult.value.items.filter((i) => !!i?.track?.id)
        : [];

    const playlists =
      playlistsResult.status === "fulfilled"
        ? playlistsResult.value.items.filter(Boolean)
        : [];

    // Log any partial failures in dev
    if (process.env.NODE_ENV === "development") {
      if (likedResult.status === "rejected") console.error("Liked songs failed:", likedResult.reason);
      if (recentResult.status === "rejected") console.error("Recently played failed:", recentResult.reason);
      if (playlistsResult.status === "rejected") console.error("Playlists failed:", playlistsResult.reason);
    }

    // If all three failed, something is fundamentally wrong
    if (!likedItems.length && !recentItems.length && !playlists.length) {
      const firstError =
        likedResult.status === "rejected" ? likedResult.reason?.message :
        recentResult.status === "rejected" ? recentResult.reason?.message :
        "All Spotify requests failed";
      return NextResponse.json({ error: firstError }, { status: 502 });
    }

    // Count recent plays per track URI for seeding boost
    const recentCountMap = new Map<string, number>();
    for (const item of recentItems) {
      recentCountMap.set(item.track.uri, (recentCountMap.get(item.track.uri) ?? 0) + 1);
    }

    // Build liked songs list (seeded by recency in library + recent plays)
    const likedSongs: ParsedSong[] = likedItems.map((item, idx) => ({
      id: item.track.id,
      name: item.track.name,
      artist: item.track.artists.map((a) => a.name).join(", "),
      album: item.track.album.name,
      uri: item.track.uri,
      playCount: (50 - idx) + (recentCountMap.get(item.track.uri) ?? 0) * 5,
      msPlayed: 0,
    }));

    // Add recently played songs not already in liked
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
        playCount: recentCountMap.get(item.track.uri) ?? 1,
        msPlayed: 0,
      });
    }

    const allSongs = [...likedSongs, ...recentExtra].sort((a, b) => b.playCount - a.playCount);

    // Build artist map
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

    // Build album map
    const albumMap = new Map<string, ParsedAlbum>();
    for (const song of allSongs) {
      const key = `${song.album}::${song.artist}`;
      const existing = albumMap.get(key);
      if (existing) {
        existing.songs.push(song);
        existing.totalPlays += song.playCount;
      } else {
        albumMap.set(key, { name: song.album, artist: song.artist, songs: [song], totalPlays: song.playCount });
      }
    }
    const albums = Array.from(albumMap.values()).sort((a, b) => b.totalPlays - a.totalPlays);

    const result: ParsedSpotifyData & { playlists: SpotifyPlaylist[] } = {
      songs: allSongs,
      artists,
      albums,
      likedSongs,
      topSongs: allSongs.slice(0, 50),
      topArtists: artists.slice(0, 20),
      totalPlays: allSongs.reduce((acc, s) => acc + s.playCount, 0),
      totalMsPlayed: 0,
      dateRange: null,
      playlists,
    };

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Spotify sync error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  artists: Array<{ name: string }>;
  album: { name: string };
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: Array<{ url: string }>;
  tracks: { total: number };
  uri: string;
}
