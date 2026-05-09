import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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
  if (!res.ok) throw new Error(`Spotify error ${res.status} on ${path}`);
  return res.json();
}

async function searchArtist(name: string, token: string): Promise<SpotifyArtist | null> {
  const q = encodeURIComponent(`"${name}"`);
  const res = await spotifyGet<{ artists: { items: SpotifyArtist[] } }>(
    `/search?q=${q}&type=artist&limit=5`,
    token
  );
  // Prefer exact name match
  const exact = res.artists.items.find(
    (a) => a.name.toLowerCase() === name.toLowerCase()
  );
  return exact ?? res.artists.items[0] ?? null;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  const artistId = searchParams.get("id");

  if (!name && !artistId) {
    return NextResponse.json({ error: "Missing name or id" }, { status: 400 });
  }

  const token = session.accessToken as string;

  try {
    let id = artistId;
    let artistName = name ?? "";

    if (!id) {
      const found = await searchArtist(name!, token);
      if (!found) {
        return NextResponse.json({ error: `Artist "${name}" not found on Spotify` }, { status: 404 });
      }
      id = found.id;
      artistName = found.name;
    }

    // Fetch all albums (paginated)
    const limit = 50;
    const first = await spotifyGet<{ items: SpotifyAlbum[]; total: number }>(
      `/artists/${id}/albums?include_groups=album,single,compilation&limit=${limit}&offset=0`,
      token
    );

    const albums = [...first.items];
    if (first.total > limit) {
      const extraPages = Math.ceil((first.total - limit) / limit);
      const pages = await Promise.all(
        Array.from({ length: extraPages }, (_, i) =>
          spotifyGet<{ items: SpotifyAlbum[] }>(
            `/artists/${id}/albums?include_groups=album,single,compilation&limit=${limit}&offset=${(i + 1) * limit}`,
            token
          ).catch(() => ({ items: [] as SpotifyAlbum[] }))
        )
      );
      for (const page of pages) {
        albums.push(...page.items);
      }
    }

    // Deduplicate by name (keep first occurrence — usually the original release)
    const seen = new Set<string>();
    const deduped = albums.filter((a) => {
      const key = a.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({
      artistId: id,
      artistName,
      albums: deduped.map((a) => ({
        id: a.id,
        name: a.name,
        year: a.release_date?.slice(0, 4) ?? "",
        totalTracks: a.total_tracks,
        type: a.album_type,
        image: a.images[0]?.url ?? null,
      })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
