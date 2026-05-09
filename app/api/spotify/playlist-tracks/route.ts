import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
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

class SpotifyForbiddenError extends Error {
  constructor() { super("forbidden"); this.name = "SpotifyForbiddenError"; }
}

async function spotifyGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("Spotify token expired — please re-sync.");
  if (res.status === 403) throw new SpotifyForbiddenError();
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Spotify ${res.status} on ${path}${body ? ": " + body.slice(0, 200) : ""}`);
  }
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
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const clerk = await clerkClient();
  const tokenResponse = await clerk.users.getUserOauthAccessToken(userId, "oauth_spotify");
  const token = tokenResponse.data[0]?.token;
  if (!token) return NextResponse.json({ error: "Spotify not connected — please sign in again." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing playlist id" }, { status: 400 });

  try {
    // market=from_token is required on content endpoints — without it some regions get 400
    const first = await spotifyGet<{
      items: PlaylistItem[] | null;
      total: number;
    }>(`/playlists/${id}/tracks?market=from_token&limit=100&offset=0`, token);

    const items: Array<PlaylistItem & { track: SpotifyTrack }> = (first.items ?? []).filter(isPlayableTrack);

    if (first.total > 100) {
      const extraPages = Math.ceil((first.total - 100) / 100);
      const pages = await Promise.all(
        Array.from({ length: extraPages }, (_, i) =>
          spotifyGet<{ items: PlaylistItem[] | null }>(
            `/playlists/${id}/tracks?market=from_token&limit=100&offset=${(i + 1) * 100}`,
            token
          ).catch(() => ({ items: [] as PlaylistItem[] }))
        )
      );
      for (const page of pages) {
        items.push(...(page.items ?? []).filter(isPlayableTrack));
      }
    }

    const songs: ParsedSong[] = items.map(({ track }) => ({
      id: track.id,
      name: track.name,
      artist: track.artists.map((a) => a.name).join(", "),
      album: track.album?.name ?? "",
      uri: track.uri,
      // Use Spotify popularity (stream-based, 0–100) as seeding score; fall back to 50
      playCount: track.popularity > 0 ? track.popularity : 50,
      msPlayed: 0,
      popularity: track.popularity,
      duration_ms: track.duration_ms,
    }));

    console.log(`[playlist-tracks] id=${id} total=${first.total} playable=${songs.length}`);

    return NextResponse.json({ songs });
  } catch (err) {
    if (err instanceof SpotifyForbiddenError) {
      // 403 = restricted playlist (Spotify-generated, private without scope, etc.)
      // Return empty songs with 200 so the UI shows "0 loaded" instead of an error toast.
      console.warn(`[playlist-tracks] 403 forbidden for playlist ${id} — returning empty`);
      return NextResponse.json({ songs: [], restricted: true });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[playlist-tracks] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
