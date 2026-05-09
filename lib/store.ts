// Client-side localStorage store for Spotify data and brackets
// Used before Supabase auth is set up; data persists across page navigation

import { ParsedSpotifyData, Bracket } from "@/types/spotify";

const SPOTIFY_DATA_KEY = "sb_spotify_data";
const BRACKETS_KEY = "sb_brackets";

export function saveSpotifyData(data: ParsedSpotifyData): void {
  try {
    localStorage.setItem(SPOTIFY_DATA_KEY, JSON.stringify(data));
  } catch {
    console.error("Failed to save Spotify data to localStorage");
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
