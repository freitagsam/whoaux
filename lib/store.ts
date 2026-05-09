// Client-side localStorage store for Spotify data and brackets
// Used before Supabase auth is set up; data persists across page navigation

import { ParsedSpotifyData, Bracket } from "@/types/spotify";

const SPOTIFY_DATA_KEY = "sb_spotify_data";
const BRACKETS_KEY = "sb_brackets";

export function saveSpotifyData(data: ParsedSpotifyData): boolean {
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(SPOTIFY_DATA_KEY, serialized);
    // Verify the write actually landed
    const verify = localStorage.getItem(SPOTIFY_DATA_KEY);
    if (!verify) throw new Error("Write verification failed");
    return true;
  } catch (err) {
    console.error("[store] Failed to save Spotify data:", err);
    // If it was a quota error, try a trimmed version (drop the heaviest derived arrays)
    try {
      const trimmed: ParsedSpotifyData = {
        ...data,
        artists: data.artists.map((a) => ({ ...a, songs: [] })),
        albums: data.albums.map((al) => ({ ...al, songs: [] })),
      };
      localStorage.setItem(SPOTIFY_DATA_KEY, JSON.stringify(trimmed));
      console.warn("[store] Saved trimmed Spotify data (artist/album song lists stripped)");
      return true;
    } catch {
      console.error("[store] Trimmed save also failed — localStorage may be unavailable or full");
      return false;
    }
  }
}

export function loadSpotifyData(): ParsedSpotifyData | null {
  try {
    const raw = localStorage.getItem(SPOTIFY_DATA_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ParsedSpotifyData;
  } catch {
    return null;
  }
}

export function clearSpotifyData(): void {
  localStorage.removeItem(SPOTIFY_DATA_KEY);
}

export function saveBracket(bracket: Bracket): void {
  try {
    const existing = loadBrackets();
    const idx = existing.findIndex((b) => b.id === bracket.id);
    if (idx >= 0) {
      existing[idx] = bracket;
    } else {
      existing.unshift(bracket);
    }
    localStorage.setItem(BRACKETS_KEY, JSON.stringify(existing));
  } catch {
    console.error("Failed to save bracket");
  }
}

export function loadBrackets(): Bracket[] {
  try {
    const raw = localStorage.getItem(BRACKETS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Bracket[];
  } catch {
    return [];
  }
}

export function loadBracket(id: string): Bracket | null {
  const brackets = loadBrackets();
  return brackets.find((b) => b.id === id) ?? null;
}

export function deleteBracket(id: string): void {
  const brackets = loadBrackets().filter((b) => b.id !== id);
  localStorage.setItem(BRACKETS_KEY, JSON.stringify(brackets));
}
