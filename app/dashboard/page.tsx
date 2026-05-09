"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import {
  Music, Trophy, Zap, TrendingUp, Clock, Upload,
  ChevronRight, Trash2, Play, Heart, ListMusic, Lock,
  Headphones, Shuffle, SkipForward, Laptop, User, Star, RefreshCw,
} from "lucide-react";
import { loadSpotifyData, loadBrackets, deleteBracket, clearSpotifyData } from "@/lib/store";
import { formatPlaytime, formatPlayCount } from "@/lib/spotify-parser";
import { ParsedSpotifyData, Bracket, ParsedSong, ParsedArtist } from "@/types/spotify";
import Navbar from "@/components/layout/Navbar";
import { toast } from "sonner";

const CHART_COLORS = ["#1db954", "#00d4ff", "#ff6b35", "#a855f7", "#f59e0b", "#ec4899"];
type TimeRange = "short" | "medium" | "long";

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<ParsedSpotifyData | null>(null);
  const [brackets, setBrackets] = useState<Bracket[]>([]);
  const [tab, setTab] = useState<"overview" | "artists" | "songs" | "brackets">("overview");
  const [timeRange, setTimeRange] = useState<TimeRange>("medium");

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
      <div className="min-h-screen flex flex-col items-center justify-center gap-6" style={{ background: "var(--background)" }}>
        <Navbar />
        <div className="text-center animate-fade-up pt-20 px-6">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
          >
            <Music size={32} style={{ color: "var(--text-muted)" }} />
          </div>
          <h2 className="text-5xl mb-3" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
            No Data Yet
          </h2>
          <p className="mb-6 max-w-sm mx-auto" style={{ color: "var(--text-dim)" }}>
            Connect your Spotify account or upload your Spotify data export to see your stats.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push("/connect")}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold"
              style={{ background: "var(--green)", color: "#000" }}
            >
              <Music size={16} />
              Connect Spotify
            </button>
            <button
              onClick={() => router.push("/upload")}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium"
              style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
            >
              <Upload size={16} />
              Upload Data File
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isOAuth = data.dataSource === "oauth";
  const isUpload = data.dataSource === "upload" || !data.dataSource;

  // ── Chart data helpers ─────────────────────────────────────────────────

  // Pick the right tracks/artists list for the selected time range (OAuth)
  const oauthTracks: ParsedSong[] =
    timeRange === "short" ? data.topTracksByTimeRange?.short ?? data.topSongs :
    timeRange === "long"  ? data.topTracksByTimeRange?.long  ?? data.topSongs :
                            data.topTracksByTimeRange?.medium ?? data.topSongs;

  const oauthArtists: ParsedArtist[] =
    timeRange === "short" ? data.topArtistsByTimeRange?.short  ?? data.topArtists :
    timeRange === "long"  ? data.topArtistsByTimeRange?.long   ?? data.topArtists :
                            data.topArtistsByTimeRange?.medium ?? data.topArtists;

  // Upload chart data (real play counts)
  const topArtistsChart = data.topArtists.slice(0, 10).map((a) => ({
    name: a.name.length > 14 ? a.name.slice(0, 13) + "…" : a.name,
    plays: a.totalPlays,
    hours: Math.round(a.totalMsPlayed / 3600000),
  }));

  const topSongsChart = data.topSongs.slice(0, 10).map((s) => ({
    name: s.name.length > 16 ? s.name.slice(0, 15) + "…" : s.name,
    plays: s.playCount,
  }));

  const artistPieData = data.topArtists.slice(0, 6).map((a, i) => ({
    name: a.name,
    value: a.totalPlays,
    color: CHART_COLORS[i],
  }));

  // OAuth chart data (Spotify popularity scores)
  const oauthTracksChart = oauthTracks.slice(0, 10).map((s) => ({
    name: s.name.length > 16 ? s.name.slice(0, 15) + "…" : s.name,
    popularity: s.popularity ?? s.playCount,
    fullName: s.name,
    artist: s.artist,
  }));

  const oauthArtistsChart = oauthArtists.slice(0, 10).map((a) => ({
    name: a.name.length > 14 ? a.name.slice(0, 13) + "…" : a.name,
    popularity: a.popularity ?? 0,
    fullName: a.name,
  }));

  const totalHours = Math.round(data.totalMsPlayed / 3600000);
  const completedBrackets = brackets.filter((b) => b.completed);

  const TimeRangeSelector = () => (
    <div
      className="flex gap-1 p-1 rounded-xl w-fit"
      style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
    >
      {([["short", "4 Weeks"], ["medium", "6 Months"], ["long", "All Time"]] as [TimeRange, string][]).map(([val, label]) => (
        <button
          key={val}
          onClick={() => setTimeRange(val)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: timeRange === val ? "var(--green)" : "transparent",
            color: timeRange === val ? "#000" : "var(--text-dim)",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const CustomTooltip = ({ active, payload, label, unit = "plays" }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
    unit?: string;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        className="px-3 py-2 rounded-lg text-xs"
        style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--foreground)" }}
      >
        <div className="font-semibold">{label}</div>
        <div style={{ color: "var(--green)" }}>{payload[0].value.toLocaleString()} {unit}</div>
      </div>
    );
  };

  // ── Listening patterns (upload only) ─────────────────────────────────
  const patterns = data.listeningPatterns;
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dailyChartData = patterns
    ? patterns.dailyDistribution.map((count, i) => ({ day: DAYS[i], plays: count }))
    : [];

  const hourlyChartData = patterns
    ? patterns.hourlyDistribution.map((count, i) => ({
        hour: i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`,
        plays: count,
      }))
    : [];

  const platformData = patterns
    ? Object.entries(patterns.platformCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([name, value], i) => ({ name, value, color: CHART_COLORS[i] ?? "#666" }))
    : [];

  // ── Pending-upload cards (shown to OAuth users) ───────────────────────
  const UploadPendingCard = ({
    icon: Icon,
    title,
    desc,
  }: {
    icon: React.ElementType;
    title: string;
    desc: string;
  }) => (
    <div
      className="p-5 rounded-2xl flex items-start gap-4 relative overflow-hidden"
      style={{ background: "var(--bg-1)", border: "1px solid var(--border)", opacity: 0.65 }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: "var(--bg-3)" }}
      >
        <Icon size={16} style={{ color: "var(--text-muted)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm mb-0.5">{title}</div>
        <div className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{desc}</div>
      </div>
      <Lock size={14} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 2 }} />
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <Navbar />

      <main className="pt-24 pb-20 px-6 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-fade-up">
          <div>
            <h1 className="text-5xl md:text-6xl" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
              Your <span className="gradient-text">Stats</span>
            </h1>
            {isUpload && data.dateRange && (
              <div className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                {new Date(data.dateRange.start).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                {" — "}
                {new Date(data.dateRange.end).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </div>
            )}
            {isOAuth && data.userProfile && (
              <div className="flex items-center gap-2 mt-1">
                {data.userProfile.image && (
                  <img
                    src={data.userProfile.image}
                    alt={data.userProfile.name}
                    className="w-5 h-5 rounded-full"
                  />
                )}
                <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                  {data.userProfile.name}
                  {data.userProfile.product === "premium" && (
                    <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(29,185,84,0.15)", color: "var(--green)" }}>
                      Premium
                    </span>
                  )}
                  {data.userProfile.followers !== undefined && (
                    <span style={{ color: "var(--text-muted)" }}> · {data.userProfile.followers.toLocaleString()} followers</span>
                  )}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isOAuth && (
              <button
                onClick={() => { clearSpotifyData(); router.push("/connect"); }}
                className="flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-sm"
                style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
                title="Clear local data and re-sync from Spotify"
              >
                <RefreshCw size={14} />
                Re-sync
              </button>
            )}
            <Link
              href="/bracket/new"
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm"
              style={{ background: "var(--green)", color: "#000" }}
            >
              <Trophy size={14} />
              New Bracket
            </Link>
          </div>
        </div>

        {/* ── Stat cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 animate-fade-up delay-100">
          {isOAuth ? (
            <>
              {[
                { label: "Liked Songs", value: data.likedSongs.length.toLocaleString(), icon: Heart, color: "#ff6b8a" },
                { label: "Playlists", value: (data.playlists?.length ?? 0).toLocaleString(), icon: ListMusic, color: "var(--cyan)" },
                { label: "Top Artists", value: (data.topArtistsByTimeRange?.medium?.length ?? data.topArtists.length).toLocaleString(), icon: User, color: "#a855f7" },
                { label: "Recently Played", value: (data.recentlyPlayed?.length ?? 0).toLocaleString(), icon: Headphones, color: "var(--orange)" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="p-5 rounded-2xl" style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: `${color}15` }}>
                    <Icon size={15} style={{ color }} />
                  </div>
                  <div className="text-3xl font-bold mb-1" style={{ fontFamily: "Bebas Neue, sans-serif" }}>{value}</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</div>
                </div>
              ))}
            </>
          ) : (
            <>
              {[
                { label: "Total Plays", value: formatPlayCount(data.totalPlays), icon: Play, color: "var(--green)" },
                { label: "Hours Listened", value: totalHours.toLocaleString(), icon: Clock, color: "var(--cyan)" },
                { label: "Unique Songs", value: data.songs.length.toLocaleString(), icon: Music, color: "#a855f7" },
                { label: "Artists", value: data.artists.length.toLocaleString(), icon: TrendingUp, color: "var(--orange)" },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="p-5 rounded-2xl" style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: `${color}15` }}>
                    <Icon size={15} style={{ color }} />
                  </div>
                  <div className="text-3xl font-bold mb-1" style={{ fontFamily: "Bebas Neue, sans-serif" }}>{value}</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* ── Tab navigation ──────────────────────────────────────────── */}
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

        {/* ════════════════════════════════════════════════════════════ */}
        {/* OVERVIEW TAB                                                 */}
        {/* ════════════════════════════════════════════════════════════ */}
        {tab === "overview" && (
          <div className="animate-fade-in space-y-6">

            {/* ── OAuth overview ── */}
            {isOAuth && (
              <>
                {/* Time range selector */}
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm" style={{ color: "var(--text-dim)" }}>
                    Spotify Top Charts
                  </h3>
                  <TimeRangeSelector />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Top Tracks chart */}
                  <div className="p-6 rounded-2xl" style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-sm">Top 10 Tracks</h3>
                      <span className="text-xs px-2 py-1 rounded" style={{ background: "rgba(29,185,84,0.1)", color: "var(--green)" }}>
                        Spotify Popularity
                      </span>
                    </div>
                    {oauthTracksChart.length > 0 ? (
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={oauthTracksChart} margin={{ left: 0, right: 10 }}>
                          <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip
                            content={({ active, payload, label }) =>
                              active && payload?.length ? (
                                <div className="px-3 py-2 rounded-lg text-xs" style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                                  <div className="font-semibold">{oauthTracksChart.find(t => t.name === label)?.fullName ?? label}</div>
                                  <div style={{ color: "var(--green)" }}>Popularity: {payload[0].value}/100</div>
                                </div>
                              ) : null
                            }
                            cursor={{ fill: "rgba(255,255,255,0.03)" }}
                          />
                          <Bar dataKey="popularity" radius={[4, 4, 0, 0]}>
                            {oauthTracksChart.map((_, i) => (
                              <Cell key={i} fill={i === 0 ? "#1db954" : i === 1 ? "#00d4ff" : `rgba(29,185,84,${0.75 - i * 0.05})`} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-60 flex items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
                        No top tracks data for this time range
                      </div>
                    )}
                  </div>

                  {/* Top Artists chart */}
                  <div className="p-6 rounded-2xl" style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-sm">Top 10 Artists</h3>
                      <span className="text-xs px-2 py-1 rounded" style={{ background: "rgba(29,185,84,0.1)", color: "var(--green)" }}>
                        Spotify Popularity
                      </span>
                    </div>
                    {oauthArtistsChart.length > 0 ? (
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={oauthArtistsChart} layout="vertical" margin={{ left: 0, right: 20 }}>
                          <XAxis type="number" domain={[0, 100]} tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="name" tick={{ fill: "var(--text-dim)", fontSize: 11 }} width={90} axisLine={false} tickLine={false} />
                          <Tooltip
                            content={({ active, payload, label }) =>
                              active && payload?.length ? (
                                <div className="px-3 py-2 rounded-lg text-xs" style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--foreground)" }}>
                                  <div className="font-semibold">{oauthArtistsChart.find(a => a.name === label)?.fullName ?? label}</div>
                                  <div style={{ color: "var(--green)" }}>Popularity: {payload[0].value}/100</div>
                                </div>
                              ) : null
                            }
                            cursor={{ fill: "rgba(255,255,255,0.03)" }}
                          />
                          <Bar dataKey="popularity" fill="var(--green)" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-60 flex items-center justify-center text-sm" style={{ color: "var(--text-muted)" }}>
                        No top artists data for this time range
                      </div>
                    )}
                  </div>
                </div>

                {/* Recently Played */}
                {data.recentlyPlayed && data.recentlyPlayed.length > 0 && (
                  <div className="p-6 rounded-2xl" style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}>
                    <h3 className="font-semibold text-sm mb-4">Recently Played</h3>
                    <div className="space-y-2">
                      {data.recentlyPlayed.slice(0, 10).map((song, i) => (
                        <div key={song.uri + i} className="flex items-center gap-3">
                          <div
                            className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: "var(--bg-3)", color: "var(--text-muted)", fontFamily: "Bebas Neue, sans-serif" }}
                          >
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{song.name}</div>
                            <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{song.artist}</div>
                          </div>
                          {song.popularity !== undefined && (
                            <div className="text-xs font-medium flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                              {song.popularity}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Playlists */}
                {data.playlists && data.playlists.length > 0 && (
                  <div className="p-6 rounded-2xl" style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}>
                    <h3 className="font-semibold text-sm mb-4">Your Playlists ({data.playlists.length})</h3>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {data.playlists.slice(0, 10).map((pl) => (
                        <div key={pl.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--bg-2)" }}>
                          {pl.images[0] ? (
                            <img src={pl.images[0].url} alt={pl.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--bg-3)" }}>
                              <ListMusic size={14} style={{ color: "var(--text-muted)" }} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{pl.name}</div>
                            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{pl.tracks.total} tracks</div>
                          </div>
                        </div>
                      ))}
                      {data.playlists.length > 10 && (
                        <div className="flex items-center justify-center p-3 text-xs" style={{ color: "var(--text-muted)" }}>
                          +{data.playlists.length - 10} more
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Upload-pending section */}
                <div className="rounded-2xl p-6" style={{ background: "var(--bg-1)", border: "1px dashed var(--border)" }}>
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.2)" }}>
                      <Lock size={16} style={{ color: "var(--cyan)" }} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm">Unlock Deeper Stats</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        Upload your Spotify data export for real play counts and listening analytics
                      </div>
                    </div>
                    <Link
                      href="/upload"
                      className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold flex-shrink-0"
                      style={{ background: "var(--cyan)", color: "#000" }}
                    >
                      <Upload size={12} />
                      Upload
                    </Link>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <UploadPendingCard icon={Play} title="Real Play Counts" desc="Exactly how many times you've played each song — not Spotify's popularity score." />
                    <UploadPendingCard icon={Clock} title="Hours Listened" desc="Total listening time per song, artist, and across your full history." />
                    <UploadPendingCard icon={TrendingUp} title="Listening Timeline" desc="Date range of your full streaming history — months or years of data." />
                    <UploadPendingCard icon={SkipForward} title="Skip Rate" desc="See which songs you tend to skip vs. listen all the way through." />
                    <UploadPendingCard icon={Shuffle} title="Listening Patterns" desc="Hourly and daily heatmaps showing when you listen most." />
                    <UploadPendingCard icon={Laptop} title="Platform Breakdown" desc="iOS vs Android vs Desktop vs Web — where you stream the most." />
                  </div>
                </div>
              </>
            )}

            {/* ── Upload overview ── */}
            {isUpload && (
              <>
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Top Artists bar chart */}
                  <div className="p-6 rounded-2xl" style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}>
                    <h3 className="font-semibold mb-4 text-sm">Top 10 Artists by Plays</h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={topArtistsChart} layout="vertical" margin={{ left: 0, right: 20 }}>
                        <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fill: "var(--text-dim)", fontSize: 11 }} width={90} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                        <Bar dataKey="plays" fill="var(--green)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Artist listen share pie */}
                  <div className="p-6 rounded-2xl" style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}>
                    <h3 className="font-semibold mb-4 text-sm">Listen Share — Top Artists</h3>
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={artistPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value">
                            {artistPieData.map((entry, index) => (
                              <Cell key={index} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => [Number(value).toLocaleString() + " plays", ""]}
                            contentStyle={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--foreground)" }}
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

                  {/* Top songs bar chart */}
                  <div className="p-6 rounded-2xl md:col-span-2" style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}>
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

                {/* Listening patterns (when available from streaming history) */}
                {patterns && (
                  <div className="space-y-6">
                    <h3 className="font-semibold text-sm">Listening Patterns</h3>

                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Quick stats: skip rate, shuffle, platform */}
                      <div className="p-6 rounded-2xl" style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}>
                        <h4 className="font-semibold text-sm mb-4">Listening Habits</h4>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm">
                              <SkipForward size={14} style={{ color: "var(--orange)" }} />
                              Skip Rate
                            </div>
                            <div className="font-bold text-sm" style={{ color: "var(--orange)" }}>
                              {(patterns.skipRate * 100).toFixed(1)}%
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm">
                              <Shuffle size={14} style={{ color: "var(--cyan)" }} />
                              Shuffle Mode
                            </div>
                            <div className="font-bold text-sm" style={{ color: "var(--cyan)" }}>
                              {(patterns.shuffleRatio * 100).toFixed(1)}%
                            </div>
                          </div>
                          {platformData.length > 0 && (
                            <div>
                              <div className="text-sm mb-2 flex items-center gap-2">
                                <Laptop size={14} style={{ color: "#a855f7" }} />
                                Platforms
                              </div>
                              <div className="space-y-1.5">
                                {platformData.slice(0, 4).map(({ name, value, color }) => {
                                  const total = platformData.reduce((s, p) => s + p.value, 0);
                                  return (
                                    <div key={name}>
                                      <div className="flex justify-between text-xs mb-0.5" style={{ color: "var(--text-dim)" }}>
                                        <span>{name}</span>
                                        <span>{((value / total) * 100).toFixed(0)}%</span>
                                      </div>
                                      <div className="h-1.5 rounded-full" style={{ background: "var(--bg-3)" }}>
                                        <div
                                          className="h-full rounded-full"
                                          style={{ width: `${(value / total) * 100}%`, background: color }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Daily distribution */}
                      <div className="p-6 rounded-2xl" style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}>
                        <h4 className="font-semibold text-sm mb-4">Plays by Day of Week</h4>
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={dailyChartData} margin={{ left: -20, right: 0 }}>
                            <XAxis dataKey="day" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={false} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                            <Bar dataKey="plays" fill="var(--green)" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Hourly heatmap */}
                    <div className="p-6 rounded-2xl" style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}>
                      <h4 className="font-semibold text-sm mb-4">Plays by Hour of Day</h4>
                      <ResponsiveContainer width="100%" height={140}>
                        <BarChart data={hourlyChartData} margin={{ left: -20, right: 0 }}>
                          <XAxis dataKey="hour" tick={{ fill: "var(--text-muted)", fontSize: 9 }} axisLine={false} tickLine={false} interval={1} />
                          <YAxis tick={false} axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                          <Bar dataKey="plays" radius={[2, 2, 0, 0]}>
                            {hourlyChartData.map((entry, i) => {
                              const maxPlays = Math.max(...hourlyChartData.map(h => h.plays));
                              const intensity = maxPlays > 0 ? entry.plays / maxPlays : 0;
                              return <Cell key={i} fill={`rgba(29,185,84,${0.2 + intensity * 0.8})`} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* ARTISTS TAB                                                  */}
        {/* ════════════════════════════════════════════════════════════ */}
        {tab === "artists" && (
          <div className="animate-fade-in">
            {isOAuth && (
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm" style={{ color: "var(--text-dim)" }}>
                  Your top artists from Spotify&apos;s algorithm
                </p>
                <TimeRangeSelector />
              </div>
            )}
            <div className="space-y-2">
              {(isOAuth ? oauthArtists : data.artists.slice(0, 40)).map((artist, i) => (
                <div
                  key={artist.name + i}
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

                  {isOAuth && artist.image && (
                    <img src={artist.image} alt={artist.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{artist.name}</div>
                    {isOAuth ? (
                      <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                        {artist.genres?.slice(0, 2).join(", ") || "—"}
                      </div>
                    ) : (
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {artist.songs.length} songs · {artist.albumCount} albums
                      </div>
                    )}
                  </div>

                  {isOAuth ? (
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-sm" style={{ color: "var(--green)" }}>
                        {artist.popularity ?? "—"}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>popularity</div>
                    </div>
                  ) : (
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
                  )}

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

        {/* ════════════════════════════════════════════════════════════ */}
        {/* SONGS TAB                                                    */}
        {/* ════════════════════════════════════════════════════════════ */}
        {tab === "songs" && (
          <div className="animate-fade-in">
            {isOAuth && (
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm" style={{ color: "var(--text-dim)" }}>
                  Your top tracks from Spotify&apos;s algorithm
                </p>
                <TimeRangeSelector />
              </div>
            )}
            <div className="space-y-2">
              {(isOAuth ? oauthTracks : data.topSongs.slice(0, 50)).map((song, i) => (
                <div
                  key={song.uri + i}
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
                  {isOAuth ? (
                    <div className="text-right flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <Star size={10} style={{ color: "var(--green)" }} />
                        <span className="font-bold text-sm" style={{ color: "var(--green)" }}>
                          {song.popularity ?? "—"}
                        </span>
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>popularity</div>
                    </div>
                  ) : (
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
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════ */}
        {/* BRACKETS TAB                                                 */}
        {/* ════════════════════════════════════════════════════════════ */}
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
                        style={{ background: b.completed ? "rgba(29,185,84,0.15)" : "var(--bg-3)" }}
                      >
                        <Trophy size={18} style={{ color: b.completed ? "var(--green)" : "var(--text-muted)" }} />
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

            {completedBrackets.length > 0 && (
              <div className="mt-6 p-5 rounded-2xl" style={{ background: "rgba(29,185,84,0.05)", border: "1px solid rgba(29,185,84,0.15)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <Trophy size={14} style={{ color: "var(--green)" }} />
                  <span className="font-semibold text-sm" style={{ color: "var(--green)" }}>
                    {completedBrackets.length} completed
                  </span>
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Champions: {completedBrackets.filter(b => b.winner).map(b => b.winner!.name).join(", ")}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
