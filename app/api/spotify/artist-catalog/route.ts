import { NextRequest, NextResponse } from "next/server";
import { getSpotifyToken } from "@/lib/spotify-auth";

export const dynamic = "force-dynamic";

interface SpotifyArtist {
  id: string;
  name: string;
}

interface SpotifyAlbum {
  id: string;
  name: string;
  release_date: string;
  total_tracks: number;
  album_type: string;
  images: Array<{ url: string }>;
}

async function spotifyGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("Spotify token expired — please re-sync your account.");
  if (res.status === 403) throw new Error("Spotify access denied — try signing out and back in.");
  if (res.status === 429) throw new Error("Spotify rate limit hit — wait a moment and try again.");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Spotify ${res.status} on ${path}${body ? ": " + body.slice(0, 200) : ""}`);
  }
  return res.json();
}

async function searchArtist(name: string, token: string): Promise<SpotifyArtist | null> {
  const q = encodeURIComponent(name);
  const res = await spotifyGet<{ artists?: { items?: SpotifyArtist[] } }>(
    `/search?q=${q}&type=artist&limit=10&market=from_token`,
    token
  );
  const items = res.artists?.items ?? [];
  return items.find((a) => a.name.toLowerCase() === name.toLowerCase()) ?? items[0] ?? null;
}

export async function GET(request: NextRequest) {
  const { token, errorResponse, setCookies } = await getSpotifyToken(request);
  if (!token) return errorResponse!;

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  const artistId = searchParams.get("id");

  if (!name && !artistId) {
    return NextResponse.json({ error: "Missing artist name or id" }, { status: 400 });
  }

  try {
    let id = artistId;
    let artistName = name ?? "";

    if (!id) {
      console.log(`[artist-catalog] Searching for artist: "${name}"`);
      const found = await searchArtist(name!, token);
      if (!found) {
        return NextResponse.json({ error: `Artist "${name}" not found on Spotify` }, { status: 404 });
      }
      id = found.id;
      artistName = found.name;
      console.log(`[artist-catalog] Found: "${artistName}" id=${id}`);
    }

    const limit = 50;
    const albumQs = (offset: number) => `limit=${limit}&offset=${offset}`;

    const first = await spotifyGet<{ items: SpotifyAlbum[]; total: number }>(
      `/artists/${id}/albums?${albumQs(0)}`,
      token
    );

    console.log(`[artist-catalog] Albums: total=${first.total} page1=${first.items?.length ?? 0}`);

    const albums = [...(first.items ?? [])];
    if (first.total > limit) {
      const extraPages = Math.ceil((first.total - limit) / limit);
      const pages = await Promise.all(
        Array.from({ length: extraPages }, (_, i) =>
          spotifyGet<{ items: SpotifyAlbum[] }>(
            `/artists/${id}/albums?${albumQs((i + 1) * limit)}`,
            token
          ).catch((e) => {
            console.warn(`[artist-catalog] Album page ${i + 1} failed:`, e.message);
            return { items: [] as SpotifyAlbum[] };
          })
        )
      );
      for (const page of pages) albums.push(...(page.items ?? []));
    }

    const seen = new Set<string>();
    const deduped = albums.filter((a) => {
      if (a.album_type === "appears_on") return false;
      const key = a.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`[artist-catalog] Returning ${deduped.length} unique albums for "${artistName}"`);

    const response = NextResponse.json({
      artistId: id,
      artistName,
      albums: deduped.map((a) => ({
        id: a.id,
        name: a.name,
        year: a.release_date?.slice(0, 4) ?? "",
        totalTracks: a.total_tracks ?? 0,
        type: a.album_type ?? "album",
        image: a.images?.[0]?.url ?? null,
      })),
    });
    setCookies(response);
    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[artist-catalog] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
