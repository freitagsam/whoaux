"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Trophy, ChevronRight, RotateCcw, BarChart3, Share2, Music, Zap } from "lucide-react";
import { loadBracket, saveBracket } from "@/lib/store";
import { advanceBracket, getCurrentMatch, getBracketProgress } from "@/lib/bracket-generator";
import { Bracket, BracketSong } from "@/types/spotify";
import Navbar from "@/components/layout/Navbar";
import { toast } from "sonner";

interface BracketPageProps {
  params: Promise<{ id: string }>;
}

function SongCard({
  song,
  onClick,
  state,
}: {
  song: BracketSong;
  onClick: () => void;
  state: "neutral" | "winner" | "loser";
}) {
  return (
    <button
      onClick={state === "neutral" ? onClick : undefined}
      className={`battle-card w-full text-left p-6 ${
        state === "winner"
          ? "battle-card-winner"
          : state === "loser"
          ? "battle-card-loser"
          : ""
      }`}
      style={{ cursor: state === "neutral" ? "pointer" : "default" }}
    >
      <div className="flex items-start gap-4">
        {/* Seed badge */}
        <div
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
          style={{
            background: song.seed <= 4 ? "rgba(29,185,84,0.15)" : "var(--bg-3)",
            color: song.seed <= 4 ? "var(--green)" : "var(--text-muted)",
            border: `1px solid ${song.seed <= 4 ? "rgba(29,185,84,0.3)" : "var(--border)"}`,
          }}
        >
          #{song.seed}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-bold text-base leading-tight truncate">{song.name}</div>
          <div className="text-sm mt-1 truncate" style={{ color: "var(--text-dim)" }}>
            {song.artist}
          </div>
          <div className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
            {song.album}
          </div>

          <div className="flex items-center gap-3 mt-3">
            <span
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: "var(--bg-3)", color: "var(--text-dim)" }}
            >
              <Zap size={9} />
              {song.playCount.toLocaleString()} plays
            </span>
          </div>
        </div>

        {state === "winner" && (
          <div
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center animate-winner-pop"
            style={{ background: "var(--green)" }}
          >
            <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
              <path d="M1 5l3.5 3.5L11 1" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>
    </button>
  );
}

function BracketTreeView({ bracket }: { bracket: Bracket }) {
  const rounds = bracket.rounds;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-2 min-w-max">
        {rounds.map((round) => (
          <div key={round.roundNumber} className="flex flex-col gap-2">
            <div
              className="text-xs font-semibold uppercase tracking-widest text-center px-3 py-1 mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              {round.label}
            </div>
            {round.matches.map((match, matchIdx) => {
              const matchHeight = Math.pow(2, round.roundNumber - 1);
              return (
                <div
                  key={match.id}
                  className="flex flex-col gap-1"
                  style={{ marginBottom: matchIdx < round.matches.length - 1 ? `${(matchHeight - 1) * 16}px` : 0 }}
                >
                  {[match.songA, match.songB].map((song, si) => {
                    const isWinner = match.winnerId && song?.uri === match.winnerId;
                    const isLoser = match.winnerId && song?.uri !== match.winnerId;
                    return (
                      <div
                        key={si}
                        className="w-48 px-3 py-2 rounded-lg text-xs"
                        style={{
                          background: isWinner
                            ? "rgba(29,185,84,0.12)"
                            : "var(--bg-2)",
                          border: `1px solid ${isWinner ? "var(--green)" : "var(--border)"}`,
                          opacity: isLoser ? 0.35 : 1,
                          minHeight: 44,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                        }}
                      >
                        {song ? (
                          <>
                            <div className="font-medium truncate">{song.name}</div>
                            <div className="truncate" style={{ color: "var(--text-muted)", fontSize: 10 }}>
                              #{song.seed} · {song.artist}
                            </div>
                          </>
                        ) : (
                          <div style={{ color: "var(--text-muted)" }}>TBD</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BracketPage({ params }: BracketPageProps) {
  const router = useRouter();
  const { id } = use(params);
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [pickedWinner, setPickedWinner] = useState<string | null>(null);
  const [view, setView] = useState<"battle" | "bracket">("battle");

  useEffect(() => {
    const b = loadBracket(id);
    if (!b) {
      toast.error("Bracket not found.");
      router.push("/dashboard");
    } else {
      setBracket(b);
    }
  }, [id, router]);

  const handlePick = (winnerId: string) => {
    if (!bracket || pickedWinner) return;
    setPickedWinner(winnerId);

    setTimeout(() => {
      const updated = advanceBracket(bracket, winnerId);
      saveBracket(updated);
      setBracket(updated);
      setPickedWinner(null);
    }, 700);
  };

  if (!bracket) return null;

  const match = getCurrentMatch(bracket);
  const progress = getBracketProgress(bracket);
  const round = bracket.rounds[bracket.currentRound - 1];

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <Navbar />

      <main className="pt-20">
        {/* Top bar */}
        <div
          className="sticky top-16 z-40 px-6 py-3"
          style={{
            background: "rgba(8,8,8,0.9)",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{bracket.name}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {progress.completedMatches}/{progress.totalMatches} matches complete
              </div>
            </div>

            <div className="progress-bar flex-1 max-w-32 hidden sm:block">
              <div className="progress-fill" style={{ width: `${progress.percentage}%` }} />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setView(view === "battle" ? "bracket" : "battle")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
                style={{
                  background: "var(--bg-2)",
                  border: "1px solid var(--border)",
                  color: "var(--text-dim)",
                }}
              >
                <BarChart3 size={12} />
                {view === "battle" ? "View Bracket" : "Back to Battle"}
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* WINNER STATE */}
          {bracket.completed && bracket.winner && (
            <div className="flex flex-col items-center text-center py-12 animate-fade-up">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 animate-pulse-glow"
                style={{ background: "rgba(29,185,84,0.15)", border: "2px solid var(--green)" }}
              >
                <Trophy size={36} style={{ color: "var(--green)" }} />
              </div>

              <div
                className="text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: "var(--green)" }}
              >
                🏆 Tournament Champion
              </div>

              <h1
                className="text-5xl sm:text-7xl mb-2"
                style={{ fontFamily: "Bebas Neue, sans-serif" }}
              >
                {bracket.winner.name}
              </h1>
              <div className="text-xl mb-1" style={{ color: "var(--text-dim)" }}>
                {bracket.winner.artist}
              </div>
              <div className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>
                {bracket.winner.album}
              </div>

              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mt-2"
                style={{
                  background: "rgba(29,185,84,0.1)",
                  border: "1px solid rgba(29,185,84,0.3)",
                  color: "var(--green)",
                }}
              >
                <Zap size={12} />
                {bracket.winner.playCount.toLocaleString()} personal plays · Seed #{bracket.winner.seed}
              </div>

              <div className="flex flex-wrap gap-3 mt-8 justify-center">
                <button
                  onClick={() => router.push("/bracket/new")}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold"
                  style={{ background: "var(--green)", color: "#000" }}
                >
                  <Trophy size={16} />
                  New Bracket
                </button>
                <button
                  onClick={() => setView("bracket")}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium"
                  style={{ border: "1px solid var(--border)", color: "var(--text-dim)" }}
                >
                  <BarChart3 size={16} />
                  See Full Bracket
                </button>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium"
                  style={{ border: "1px solid var(--border)", color: "var(--text-dim)" }}
                >
                  Dashboard
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* BRACKET VIEW */}
          {view === "bracket" && !bracket.completed && (
            <div className="animate-fade-in">
              <h2
                className="text-3xl mb-6"
                style={{ fontFamily: "Bebas Neue, sans-serif" }}
              >
                Full Bracket
              </h2>
              <BracketTreeView bracket={bracket} />
            </div>
          )}

          {/* BATTLE VIEW */}
          {view === "battle" && !bracket.completed && match && (
            <div className="animate-fade-in">
              {/* Round label */}
              <div className="text-center mb-8">
                <div
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest"
                  style={{
                    background: "rgba(29,185,84,0.1)",
                    border: "1px solid rgba(29,185,84,0.25)",
                    color: "var(--green)",
                  }}
                >
                  <Music size={10} />
                  {round?.label ?? `Round ${bracket.currentRound}`}
                  &nbsp;·&nbsp;
                  Match {bracket.currentMatchIndex + 1} of {round?.matches.length}
                </div>

                <h2
                  className="text-5xl mt-4 mb-2"
                  style={{ fontFamily: "Bebas Neue, sans-serif" }}
                >
                  Pick Your <span className="gradient-text">Favorite</span>
                </h2>
                <p style={{ color: "var(--text-dim)", fontSize: 14 }}>
                  Which song would you rather listen to? Click to advance it.
                </p>
              </div>

              {/* Battle cards */}
              <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
                {match.songA && (
                  <SongCard
                    song={match.songA}
                    onClick={() => handlePick(match.songA!.uri)}
                    state={
                      pickedWinner === null
                        ? "neutral"
                        : pickedWinner === match.songA.uri
                        ? "winner"
                        : "loser"
                    }
                  />
                )}

                {/* VS */}
                <div className="md:hidden flex items-center gap-3 my-1">
                  <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                  <span
                    style={{
                      fontFamily: "Bebas Neue, sans-serif",
                      fontSize: 20,
                      color: "var(--text-muted)",
                    }}
                  >
                    VS
                  </span>
                  <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                </div>
                <div
                  className="hidden md:flex absolute items-center justify-center"
                  style={{
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontFamily: "Bebas Neue, sans-serif",
                    fontSize: 28,
                    color: "var(--text-muted)",
                    pointerEvents: "none",
                    zIndex: 10,
                  }}
                />

                {match.songB && (
                  <SongCard
                    song={match.songB}
                    onClick={() => handlePick(match.songB!.uri)}
                    state={
                      pickedWinner === null
                        ? "neutral"
                        : pickedWinner === match.songB.uri
                        ? "winner"
                        : "loser"
                    }
                  />
                )}
              </div>

              {/* VS label between cards on desktop */}
              <div
                className="hidden md:flex items-center justify-center gap-4 my-4"
                style={{ position: "relative", zIndex: 1 }}
              >
                <div style={{ flex: 1, height: 1, background: "var(--border)", maxWidth: 200 }} />
                <span
                  style={{
                    fontFamily: "Bebas Neue, sans-serif",
                    fontSize: 22,
                    color: "var(--text-muted)",
                  }}
                >
                  VS
                </span>
                <div style={{ flex: 1, height: 1, background: "var(--border)", maxWidth: 200 }} />
              </div>

              <p
                className="text-center text-xs mt-6"
                style={{ color: "var(--text-muted)" }}
              >
                {progress.totalMatches - progress.completedMatches - 1} battles remaining after this one
              </p>
            </div>
          )}

          {/* Bracket tree always visible at bottom when in battle view */}
          {view === "battle" && !bracket.completed && (
            <div className="mt-12">
              <div
                className="text-xs font-semibold uppercase tracking-widest mb-4"
                style={{ color: "var(--text-muted)" }}
              >
                Bracket Overview
              </div>
              <BracketTreeView bracket={bracket} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
