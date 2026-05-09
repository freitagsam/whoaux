"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
} from "recharts";
import {
  Music, Trophy, Zap, TrendingUp, Clock, Upload,
  ChevronRight, BarChart3, Trash2, Play
} from "lucide-react";
import { loadSpotifyData, loadBrackets, deleteBracket } from "@/lib/store";
import { formatPlaytime, formatPlayCount } from "@/lib/spotify-parser";
import { ParsedSpotifyData, Bracket } from "@/types/spotify";
import Navbar from "@/components/layout/Navbar";
import { toast } from "sonner";

const CHART_COLORS = ["#1db954", "#00d4ff", "#ff6b35", "#a855f7", "#f59e0b", "#ec4899"];

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<ParsedSpotifyData | null>(null);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [tab, setTab] = useState<"overview" | "artists" | "songs" | "brackets">("overview");

  useEffect(() => {
    setData(loadSpotifyData());
    setBrackets(loadBrackets());
  }, []);

  const handleDeleteBracket = (id: string, name: string) => {
    deleteBracket(id);
    setBrackets((prev) => prev.filter((b) => b.id !== id));
    toast.success(`Deleted "${name}"`);
  };

  if (!data) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6"
        style={{ background: "var(--background)" }}
      >
        <Navbar />
        <div className="text-center animate-fade-up pt-20 px-6">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
          >
            <Music size={32} style={{ color: "var(--text-muted)" }} />
          </div>
          <h2
            className="text-5xl mb-3"
            style={{ fontFamily: "Bebas Neue, sans-serif" }}
          >
            No Data Yet
          </h2>
          <p className="mb-6 max-w-sm mx-auto" style={{ color: "var(--text-dim)" }}>
            Upload your Spotify data to see your listening stats, charts, and create brackets.
          </p>
          <button
            onClick={() => router.push("/upload")}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold mx-auto"
            style={{ background: "var(--green)", color: "#000" }}
          >
            <Upload size={16} />
            Upload Spotify Data
          </button>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const topArtistsChart = data.topArtists.slice(0, 10).map((a) => ({
    name: a.name.length > 14 ? a.name.slice(0, 13) + "…" : a.name,
    plays: a.totalPlays,
    hours: Math.round(a.totalMsPlayed / 3600000),
  }));

  const topSongsChart = data.topSongs.slice(0, 10).map((s) => ({
    name: s.name.length > 16 ? s.name.slice(0, 15) + "…" : s.name,
    artist: s.artist,
    plays: s.playCount,
  }));

  // Genre-like distribution (approximate by artist)
  const artistPieData = data.topArtists.slice(0, 6).map((a, i) => ({
    name: a.name,
    value: a.totalPlays,
    color: CHART_COLORS[i],
  }));

  const totalHours = Math.round(data.totalMsPlayed / 3600000);
  const avgPlaysPerSong = data.songs.length
    ? Math.round(data.totalPlays / data.songs.length)
    : 0;

  const completedBrackets = brackets.filter((b) => b.completed);

  const CustomTooltip = ({ active, payload, label }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        className="px-3 py-2 rounded-lg text-xs"
        style={{
          background: "var(--bg-2)",
          border: "1px solid var(--border)",
          color: "var(--foreground)",
        }}
      >
        <div className="font-semibold">{label}</div>
        <div style={{ color: "var(--green)" }}>{payload[0].value.toLocaleString()} plays</div>
      </div>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <Navbar />

      <main className="pt-24 pb-20 px-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-up">
          <div>
            <h1
              className="text-5xl md:text-6xl"
              style={{ fontFamily: "Bebas Neue, sans-serif" }}
            >
              Your <span className="gradient-text">Stats</span>
            </h1>
            {data.dateRange && (
              <div className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                {new Date(data.dateRange.start).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                {" — "}
                {new Date(data.dateRange.end).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </div>
            )}
          </div>
          <Link
            href="/bracket/new"
            className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm"
            style={{ background: "var(--green)", color: "#000" }}
          >
            <Trophy size={14} />
            New Bracket
          </Link>
        </div>

        {/* Stats overview cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 animate-fade-up delay-100">
          {[
            {
              label: "Total Plays",
              value: formatPlayCount(data.totalPlays),
              icon: Play,
              color: "var(--green)",
            },
            {
              label: "Hours Listened",
              value: totalHours.toLocaleString(),
              icon: Clock,
              color: "var(--cyan)",
            },
            {
              label: "Unique Songs",
              value: data.songs.length.toLocaleString(),
              icon: Music,
              color: "#a855f7",
            },
            {
              label: "Artists",
              value: data.artists.length.toLocaleString(),
              icon: TrendingUp,
              color: "var(--orange)",
            },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="p-5 rounded-2xl"
              style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                style={{ background: `${color}15` }}
              >
                <Icon size={15} style={{ color }} />
              </div>
              <div
                className="text-3xl font-bold mb-1"
                style={{ fontFamily: "Bebas Neue, sans-serif", color: "var(--foreground)" }}
              >
                {value}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* Tab navigation */}
        <div
          className="flex gap-1 p-1 rounded-xl mb-6 animate-fade-up delay-200 w-fit"
          style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}
        >
          {(["overview", "artists", "songs", "brackets"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all"
              style={{
                background: tab === t ? "var(--green)" : "transparent",
                color: tab === t ? "#000" : "var(--text-dim)",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
            {/* Top Artists bar chart */}
            <div
              className="p-6 rounded-2xl"
              style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}
            >
              <h3 className="font-semibold mb-4 text-sm">Top 10 Artists</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={topArtistsChart} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "var(--text-dim)", fontSize: 11 }} width={90} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="plays" fill="var(--green)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie: artist share */}
            <div
              className="p-6 rounded-2xl"
              style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}
            >
              <h3 className="font-semibold mb-4 text-sm">Listen Share — Top Artists</h3>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={artistPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {artistPieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [Number(value).toLocaleString() + " plays", ""]}
                      contentStyle={{
                        background: "var(--bg-2)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "var(--foreground)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {artistPieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-dim)" }}>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    {d.name}
                  </div>
                ))}
              </div>
            </div>

            {/* Top songs */}
            <div
              className="p-6 rounded-2xl md:col-span-2"
              style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}
            >
              <h3 className="font-semibold mb-4 text-sm">Top 10 Songs by Play Count</h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={topSongsChart} margin={{ left: 0, right: 10 }}>
                  <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="plays" radius={[4, 4, 0, 0]}>
                    {topSongsChart.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "#1db954" : i === 1 ? "#00d4ff" : `rgba(29,185,84,${0.7 - i * 0.05})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ARTISTS TAB */}
        {tab === "artists" && (
          <div className="animate-fade-in">
            <div className="space-y-2">
              {data.artists.slice(0, 40).map((artist, i) => (
                <div
                  key={artist.name}
                  className="flex items-center gap-4 p-4 rounded-xl"
                  style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm flex-shrink-0"
                    style={{
                      background: i < 3 ? "rgba(29,185,84,0.15)" : "var(--bg-3)",
                      color: i < 3 ? "var(--green)" : "var(--text-muted)",
                      fontFamily: "Bebas Neue, sans-serif",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{artist.name}</div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {artist.songs.length} songs · {artist.albumCount} albums
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold text-sm" style={{ color: "var(--green)" }}>
                        {artist.totalPlays.toLocaleString()}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>plays</div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="font-bold text-sm" style={{ color: "var(--cyan)" }}>
                        {formatPlaytime(artist.totalMsPlayed)}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>listened</div>
                    </div>
                  </div>
                  <Link
                    href="/bracket/new"
                    className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0"
                    style={{ background: "var(--bg-3)", color: "var(--text-dim)" }}
                  >
                    <Trophy size={10} />
                    Bracket
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SONGS TAB */}
        {tab === "songs" && (
          <div className="animate-fade-in">
            <div className="space-y-2">
              {data.topSongs.slice(0, 50).map((song, i) => (
                <div
                  key={song.uri}
                  className="flex items-center gap-4 p-4 rounded-xl"
                  style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}
                >
                  <div
                    className="w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm flex-shrink-0"
                    style={{
                      background: i < 3 ? "rgba(29,185,84,0.15)" : "var(--bg-3)",
                      color: i < 3 ? "var(--green)" : "var(--text-muted)",
                      fontFamily: "Bebas Neue, sans-serif",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{song.name}</div>
                    <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                      {song.artist} · {song.album}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-bold text-sm" style={{ color: "var(--green)" }}>
                        {song.playCount.toLocaleString()}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>plays</div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="font-bold text-sm">{formatPlaytime(song.msPlayed)}</div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>total</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BRACKETS TAB */}
        {tab === "brackets" && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">
                {brackets.length} Bracket{brackets.length !== 1 ? "s" : ""}
              </h3>
              <Link
                href="/bracket/new"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
                style={{ background: "var(--green)", color: "#000" }}
              >
                <Zap size={13} />
                New Bracket
              </Link>
            </div>

            {brackets.length === 0 ? (
              <div
                className="text-center py-16 rounded-2xl"
                style={{ background: "var(--bg-1)", border: "1px dashed var(--border)" }}
              >
                <Trophy size={28} style={{ color: "var(--text-muted)", margin: "0 auto 12px" }} />
                <div className="font-semibold mb-1">No brackets yet</div>
                <div className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>
                  Create your first bracket to start battling songs
                </div>
                <Link
                  href="/bracket/new"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: "var(--green)", color: "#000" }}
                >
                  Create First Bracket
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {brackets.map((b) => {
                  const total = b.rounds.reduce((acc, r) => acc + r.matches.length, 0);
                  const done = b.rounds.reduce(
                    (acc, r) => acc + r.matches.filter((m) => m.winnerId).length,
                    0
                  );
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

                  return (
                    <div
                      key={b.id}
                      className="p-5 rounded-2xl flex items-center gap-4"
                      style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{
                          background: b.completed ? "rgba(29,185,84,0.15)" : "var(--bg-3)",
                        }}
                      >
                        <Trophy
                          size={18}
                          style={{ color: b.completed ? "var(--green)" : "var(--text-muted)" }}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{b.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {b.size} songs · {done}/{total} matches
                          {b.completed && b.winner && ` · Winner: ${b.winner.name}`}
                        </div>
                        <div className="progress-bar mt-2 w-full max-w-48">
                          <div className="progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Link
                          href={`/bracket/${b.id}`}
                          className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium"
                          style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
                        >
                          {b.completed ? "View" : "Continue"}
                          <ChevronRight size={12} />
                        </Link>
                        <button
                          onClick={() => handleDeleteBracket(b.id, b.name)}
                          className="p-2 rounded-lg"
                          style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
