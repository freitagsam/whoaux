import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { ParsedSong } from "@/types/spotify";

export const dynamic = "force-dynamic";

interface SimpleTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  artists: Array<{ name: string }>;
  track_number: number;
}

interface FullTrack extends SimpleTrack {
  album: { name: string };
  popularity: number;
}

async function spotifyGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("Spotify token expired — please re-sync.");
  if (res.status === 403) throw new Error("Spotify access denied.");
  if (res.status === 429) throw new Error("Spotify rate limit — try again in a moment.");
  if (!res.ok) throw new Error(`Spotify ${res.status} on ${path}`);
  return res.json();
}

async function fetchAlbumTracks(albumId: string, token: string): Promise<SimpleTrack[]> {
  const limit = 50;
  const first = await spotifyGet<{ items: SimpleTrack[]; total: number }>(
    `/albums/${albumId}/tracks?market=from_token&limit=${limit}&offset=0`,
    token
  );
  const items = [...(first.items ?? [])];
  if (first.total > limit) {
    const extraPages = Math.ceil((first.total - limit) / limit);
    const pages = await Promise.all(
      Array.from({ length: extraPages }, (_, i) =>
        spotifyGet<{ items: SimpleTrack[] }>(
          `/albums/${albumId}/tracks?market=from_token&limit=${limit}&offset=${(i + 1) * limit}`,
          token
        ).catch(() => ({ items: [] as SimpleTrack[] }))
      )
    );
    for (const page of pages) items.push(...(page.items ?? []));
  }
  return items.filter((t) => !!t?.id);
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const clerk = await clerkClient();
  const tokenResponse = await clerk.users.getUserOauthAccessToken(userId, "oauth_spotify");
  const token = tokenResponse.data[0]?.token;
  if (!token) return NextResponse.json({ error: "Spotify not connected — please sign in again." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const albumIdsParam = searchParams.get("albumIds");
  if (!albumIdsParam) {
    return NextResponse.json({ error: "Missing albumIds" }, { status: 400 });
  }
  const albumIds = albumIdsParam.split(",").filter(Boolean);
  const albumNamesParam = searchParams.get("albumNames") ?? "";
  const albumNames = albumNamesParam.split("|||");

  try {
    // Fetch all album tracks in parallel
    const albumTrackSets = await Promise.all(
      albumIds.map((id) => fetchAlbumTracks(id, token).catch(() => [] as SimpleTrack[]))
    );

    // Flatten + deduplicate by URI
    const seenUris = new Set<string>();
    const allTracks: (SimpleTrack & { albumName: string })[] = [];
    for (let i = 0; i < albumTrackSets.length; i++) {
      const albumName = albumNames[i] ?? "";
      for (const track of albumTrackSets[i]) {
        if (!seenUris.has(track.uri)) {
          seenUris.add(track.uri);
          allTracks.push({ ...track, albumName });
        }
      }
    }

    // Batch-fetch full track objects for popularity scores (50 per request)
    const trackIds = allTracks.map((t) => t.id);
    const popularityMap = new Map<string, number>();
    for (let i = 0; i < trackIds.length; i += 50) {
      const batch = trackIds.slice(i, i + 50);
      try {
        const res = await spotifyGet<{ tracks: (FullTrack | null)[] }>(
          `/tracks?ids=${batch.join(",")}&market=from_token`,
          token
        );
        for (const t of res.tracks ?? []) {
          if (t?.uri) popularityMap.set(t.uri, t.popularity ?? 50);
        }
      } catch {
        // popularity stays undefined for this batch — use default
      }
    }

    const songs: ParsedSong[] = allTracks.map((track) => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      album: track.albumName,
      uri: track.uri,
      playCount: popularityMap.get(track.uri) ?? 50,
      msPlayed: 0,
      popularity: popularityMap.get(track.uri),
      duration_ms: track.duration_ms,
    }));

    console.log(`[artist-tracks] albums=${albumIds.length} tracks=${songs.length}`);
    return NextResponse.json({ songs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[artist-tracks] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
