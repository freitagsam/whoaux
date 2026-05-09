import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ParsedSong } from "@/types/spotify";

export const dynamic = "force-dynamic";

interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  type: string; // "track" | "episode"
  artists: Array<{ name: string }>;
  album: { name: string };
  popularity: number;
  duration_ms: number;
}

interface PlaylistItem {
  is_local: boolean;
  track: SpotifyTrack | null;
}

async function spotifyGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("Spotify token expired — please re-sync.");
  if (res.status === 403) throw new Error("Access denied for this playlist. Make sure it's your own playlist.");
  if (!res.ok) throw new Error(`Spotify error ${res.status} on ${path}`);
  return res.json();
}

function isPlayableTrack(item: PlaylistItem | null): item is PlaylistItem & { track: SpotifyTrack } {
  if (!item) return false;
  if (item.is_local) return false;                   // local files have no Spotify ID
  if (!item.track) return false;
  if (!item.track.id) return false;
  if (item.track.type === "episode") return false;   // podcast episodes lack album/popularity
  return true;
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
    // market=from_token is required on content endpoints — without it some regions get 400
    const first = await spotifyGet<{
      items: PlaylistItem[];
      total: number;
    }>(`/playlists/${id}/tracks?market=from_token&limit=100&offset=0`, token);

    const items: Array<PlaylistItem & { track: SpotifyTrack }> = first.items.filter(isPlayableTrack);

    if (first.total > 100) {
      const extraPages = Math.ceil((first.total - 100) / 100);
      const pages = await Promise.all(
        Array.from({ length: extraPages }, (_, i) =>
          spotifyGet<{ items: PlaylistItem[] }>(
            `/playlists/${id}/tracks?market=from_token&limit=100&offset=${(i + 1) * 100}`,
            token
          ).catch(() => ({ items: [] as PlaylistItem[] }))
        )
      );
      for (const page of pages) {
        items.push(...page.items.filter(isPlayableTrack));
      }
    }

    const songs: ParsedSong[] = items.map(({ track }, idx) => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      album: track.album?.name ?? "",
      uri: track.uri,
      playCount: items.length - idx,
      msPlayed: 0,
      popularity: track.popularity,
      duration_ms: track.duration_ms,
    }));

    console.log(`[playlist-tracks] id=${id} total=${first.total} playable=${songs.length}`);

    return NextResponse.json({ songs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[playlist-tracks] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
