import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
  if (!res.ok) throw new Error(`Spotify error ${res.status} on ${path}`);
  return res.json();
}

async function fetchAlbumTracks(
  albumId: string,
  albumName: string,
  token: string
): Promise<SimpleTrack[]> {
  const limit = 50;
  const first = await spotifyGet<{ items: SimpleTrack[]; total: number }>(
    `/albums/${albumId}/tracks?limit=${limit}&offset=0`,
    token
  );
  const items = [...first.items];
  if (first.total > limit) {
    const extraPages = Math.ceil((first.total - limit) / limit);
    const pages = await Promise.all(
      Array.from({ length: extraPages }, (_, i) =>
        spotifyGet<{ items: SimpleTrack[] }>(
          `/albums/${albumId}/tracks?limit=${limit}&offset=${(i + 1) * limit}`,
          token
        ).catch(() => ({ items: [] as SimpleTrack[] }))
      )
    );
    for (const page of pages) items.push(...page.items);
  }
  return items;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const albumIdsParam = searchParams.get("albumIds");
  if (!albumIdsParam) {
    return NextResponse.json({ error: "Missing albumIds" }, { status: 400 });
  }

  const token = session.accessToken as string;
  const albumIds = albumIdsParam.split(",").filter(Boolean);

  try {
    // Fetch tracks for all albums in parallel
    // We also need album names — caller sends them as albumNames param
    const albumNamesParam = searchParams.get("albumNames") ?? "";
    const albumNames = albumNamesParam.split("|||");

    const albumTrackSets = await Promise.all(
      albumIds.map((id, idx) =>
        fetchAlbumTracks(id, albumNames[idx] ?? "", token).catch(() => [])
      )
    );

    // Flatten + deduplicate by track URI
    const seenUris = new Set<string>();
    const allSimpleTracks: (SimpleTrack & { albumName: string })[] = [];
    for (let i = 0; i < albumTrackSets.length; i++) {
      const albumName = albumNames[i] ?? "";
      for (const track of albumTrackSets[i]) {
        if (!seenUris.has(track.uri)) {
          seenUris.add(track.uri);
          allSimpleTracks.push({ ...track, albumName });
        }
      }
    }

    // Batch fetch full track objects to get popularity (50 per request)
    const trackIds = allSimpleTracks.map((t) => t.id);
    const fullTracks: FullTrack[] = [];
    for (let i = 0; i < trackIds.length; i += 50) {
      const batch = trackIds.slice(i, i + 50);
      try {
        const res = await spotifyGet<{ tracks: (FullTrack | null)[] }>(
          `/tracks?ids=${batch.join(",")}`,
          token
        );
        fullTracks.push(...res.tracks.filter((t): t is FullTrack => !!t?.id));
      } catch {
        // If batch fails, use simple tracks with no popularity
      }
    }

    // Build popularity map
    const popularityMap = new Map<string, number>();
    for (const t of fullTracks) {
      popularityMap.set(t.uri, t.popularity);
    }

    const songs: ParsedSong[] = allSimpleTracks.map((track) => ({
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

    return NextResponse.json({ songs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
