import {
  ParsedSong,
  ParsedSpotifyData,
  Bracket,
  BracketMatch,
  BracketMode,
  BracketRound,
  BracketSize,
  BracketSong,
  SeedingMethod,
} from "@/types/spotify";

function getRoundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round + 1;
  if (fromEnd === 1) return "Grand Final";
  if (fromEnd === 2) return "Semifinal";
  if (fromEnd === 3) return "Quarterfinal";
  if (fromEnd === 4) return "Round of 16";
  if (fromEnd === 5) return "Round of 32";
  return `Round of ${Math.pow(2, fromEnd)}`;
}

// Standard bracket seeding pattern (like March Madness)
function getBracketSeedings(size: number): [number, number][] {
  if (size === 2) return [[1, 2]];
  const half = getBracketSeedings(size / 2);
  return half.map(([a, b]) => [a, size + 1 - a] as [number, number]).concat(
    half.map(([a, b]) => [b, size + 1 - b] as [number, number])
  );
}

export function generateBracket(
  data: ParsedSpotifyData,
  options: {
    mode: BracketMode;
    filter: string;
    seedingMethod: SeedingMethod;
    size: BracketSize;
    name: string;
    playlistSongs?: ParsedSong[];
  }
): Bracket | null {
  let pool: ParsedSong[] = [];

  switch (options.mode) {
    case "liked":
      pool = [...data.likedSongs];
      break;
    case "artist":
      pool = data.songs.filter(
        (s) => s.artist.toLowerCase() === options.filter.toLowerCase()
      );
      break;
    case "album":
      pool = data.songs.filter(
        (s) => s.album.toLowerCase() === options.filter.toLowerCase()
      );
      break;
    case "top":
      pool = [...data.topSongs];
      break;
    case "playlist":
      pool = [...(options.playlistSongs ?? [])];
      break;
  }

  if (pool.length < 4) return null;

  // Sort by chosen seeding method
  if (options.seedingMethod === "personal") {
    pool.sort((a, b) => b.playCount - a.playCount);
  } else {
    pool.sort((a, b) => (b.artistPlayCount ?? b.playCount) - (a.artistPlayCount ?? a.playCount));
  }

  // Trim to bracket size
  pool = pool.slice(0, options.size);

  // If not enough songs, find nearest valid power of 2
  const validSizes: BracketSize[] = [8, 16, 32, 64];
  let actualSize = options.size;
  if (pool.length < options.size) {
    actualSize = (validSizes.find((s) => s <= pool.length) ?? 8) as BracketSize;
    pool = pool.slice(0, actualSize);
  }

  if (pool.length < 4) return null;

  // Assign seeds
  const seededSongs: BracketSong[] = pool.map((song, idx) => ({
    ...song,
    seed: idx + 1,
    eliminated: false,
  }));

  // Build first round with bracket seedings
  const seedings = getBracketSeedings(actualSize);
  const firstRoundMatches: BracketMatch[] = seedings.map(([seedA, seedB], idx) => ({
    id: `r1-m${idx}`,
    songA: seededSongs[seedA - 1] ?? null,
    songB: seededSongs[seedB - 1] ?? null,
    winnerId: null,
    position: idx,
  }));

  const totalRounds = Math.log2(actualSize);
  const rounds: BracketRound[] = [
    {
      roundNumber: 1,
      label: getRoundLabel(1, totalRounds),
      matches: firstRoundMatches,
    },
  ];

  // Pre-create empty future rounds
  for (let r = 2; r <= totalRounds; r++) {
    const matchCount = actualSize / Math.pow(2, r);
    rounds.push({
      roundNumber: r,
      label: getRoundLabel(r, totalRounds),
      matches: Array.from({ length: matchCount }, (_, idx) => ({
        id: `r${r}-m${idx}`,
        songA: null,
        songB: null,
        winnerId: null,
        position: idx,
      })),
    });
  }

  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    name: options.name,
    mode: options.mode,
    filter: options.filter,
    seedingMethod: options.seedingMethod,
    size: actualSize as BracketSize,
    rounds,
    currentRound: 1,
    currentMatchIndex: 0,
    winner: null,
    completed: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function advanceBracket(
  bracket: Bracket,
  winnerId: string
): Bracket {
  const updated = structuredClone(bracket);
  const round = updated.rounds[updated.currentRound - 1];
  const match = round.matches[updated.currentMatchIndex];

  if (!match) return updated;

  match.winnerId = winnerId;
  const winner = match.songA?.uri === winnerId ? match.songA : match.songB;
  if (!winner) return updated;

  // Mark loser eliminated
  const loser = match.songA?.uri === winnerId ? match.songB : match.songA;
  if (loser) loser.eliminated = true;

  // Advance winner to next round
  const nextRound = updated.rounds[updated.currentRound];
  if (nextRound) {
    const nextMatchIdx = Math.floor(updated.currentMatchIndex / 2);
    const nextMatch = nextRound.matches[nextMatchIdx];
    if (nextMatch) {
      if (updated.currentMatchIndex % 2 === 0) {
        nextMatch.songA = { ...winner, eliminated: false };
      } else {
        nextMatch.songB = { ...winner, eliminated: false };
      }
    }
  }

  // Move to next match
  updated.currentMatchIndex += 1;

  if (updated.currentMatchIndex >= round.matches.length) {
    // Advance to next round
    if (updated.currentRound >= updated.rounds.length) {
      // Tournament complete
      updated.completed = true;
      updated.winner = winner;
    } else {
      updated.currentRound += 1;
      updated.currentMatchIndex = 0;
    }
  }

  updated.updatedAt = new Date().toISOString();
  return updated;
}

export function getCurrentMatch(bracket: Bracket): BracketMatch | null {
  if (bracket.completed) return null;
  const round = bracket.rounds[bracket.currentRound - 1];
  if (!round) return null;
  return round.matches[bracket.currentMatchIndex] ?? null;
}

export function getBracketProgress(bracket: Bracket): {
  totalMatches: number;
  completedMatches: number;
  percentage: number;
} {
  let total = 0;
  let completed = 0;
  for (const round of bracket.rounds) {
    for (const match of round.matches) {
      total += 1;
      if (match.winnerId) completed += 1;
    }
  }
  return {
    totalMatches: total,
    completedMatches: completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export function getValidBracketSize(count: number): BracketSize {
  if (count >= 64) return 64;
  if (count >= 32) return 32;
  if (count >= 16) return 16;
  return 8;
}
