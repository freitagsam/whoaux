import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ParsedSong } from "@/types/spotify";

export const dynamic = "force-dynamic";

interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  artists: Array<{ name: string }>;
  album: { name: string };
  popularity: number;
  duration_ms: number;
}

async function spotifyGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Spotify error ${res.status} on ${path}`);
  return res.json();
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing playlist id" }, { status: 400 });

  const token = session.accessToken as string;

  try {
    const first = await spotifyGet<{
      items: Array<{ track: SpotifyTrack | null }>;
      total: number;
    }>(`/playlists/${id}/tracks?limit=100&offset=0`, token);

    const items = first.items.filter(
      (i): i is { track: SpotifyTrack } => !!i?.track?.id
    );

    if (first.total > 100) {
      const extraPages = Math.ceil((first.total - 100) / 100);
      const pages = await Promise.all(
        Array.from({ length: extraPages }, (_, i) =>
          spotifyGet<{ items: Array<{ track: SpotifyTrack | null }> }>(
            `/playlists/${id}/tracks?limit=100&offset=${(i + 1) * 100}`,
            token
          ).catch(() => ({ items: [] as Array<{ track: SpotifyTrack | null }> }))
        )
      );
      for (const page of pages) {
        items.push(
          ...page.items.filter((i): i is { track: SpotifyTrack } => !!i?.track?.id)
        );
      }
    }

    const songs: ParsedSong[] = items.map(({ track }, idx) => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      album: track.album.name,
      uri: track.uri,
      playCount: items.length - idx,
      msPlayed: 0,
      popularity: track.popularity,
      duration_ms: track.duration_ms,
    }));

    return NextResponse.json({ songs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
