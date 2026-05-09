"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Heart, User, Disc3, TrendingUp, ArrowRight, ArrowLeft,
  Trophy, Zap, Users, Music, ChevronDown, Search, AlertCircle, ListMusic, Loader2
} from "lucide-react";
import { loadSpotifyData, saveBracket, clearSpotifyData } from "@/lib/store";
import { generateBracket, getValidBracketSize } from "@/lib/bracket-generator";
import { ParsedSpotifyData, BracketMode, SeedingMethod, BracketSize, ParsedSong } from "@/types/spotify";
import Navbar from "@/components/layout/Navbar";
import { toast } from "sonner";

type Step = "mode" | "filter" | "seeding" | "size";

const BRACKET_SIZES: BracketSize[] = [8, 16, 32, 64];

export default function NewBracketPage() {
  const router = useRouter();
  const [data, setData] = useState<ParsedSpotifyData | null>(null);
  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<BracketMode>("top");
  const [filter, setFilter] = useState("");
  const [seedingMethod, setSeedingMethod] = useState<SeedingMethod>("personal");
  const [size, setSize] = useState<BracketSize>(32);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [playlistSongs, setPlaylistSongs] = useState<ParsedSong[]>([]);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);
  const [artistSource, setArtistSource] = useState<"library" | "discography" | "albums">("library");
  const [artistAlbums, setArtistAlbums] = useState<Array<{id: string; name: string; year: string; totalTracks: number; type: string; image: string | null}>>([]);
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<string>>(new Set());
  const [artistDiscSongs, setArtistDiscSongs] = useState<ParsedSong[]>([]);
  const [loadingArtistCatalog, setLoadingArtistCatalog] = useState(false);

  useEffect(() => {
    const d = loadSpotifyData();
    if (d) setData(d);
  }, []);

  useEffect(() => {
    if (data?.dataSource === "oauth") {
      setSeedingMethod("popularity");
    }
  }, [data]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (mode !== "artist" || !filter) return;
    if (artistSource === "library") {
      setArtistDiscSongs([]);
      setArtistAlbums([]);
      return;
    }
    if (artistSource === "discography") {
      (async () => {
        setLoadingArtistCatalog(true);
        setArtistAlbums([]);
        setArtistDiscSongs([]);
        try {
          const res = await fetch(`/api/spotify/artist-catalog?name=${encodeURIComponent(filter)}`);
          const json = await res.json();
          if (!res.ok) { toast.error(json.error ?? "Could not load artist."); setLoadingArtistCatalog(false); return; }
          const albums: Array<{id: string; name: string}> = json.albums ?? [];
          setArtistAlbums(json.albums ?? []);
          if (albums.length === 0) { setLoadingArtistCatalog(false); return; }
          const albumIds = albums.map((a) => a.id);
          const albumNamesEncoded = encodeURIComponent(albums.map((a) => a.name).join("|||"));
          const tracksRes = await fetch(`/api/spotify/artist-tracks?albumIds=${albumIds.join(",")}&albumNames=${albumNamesEncoded}`);
          const tracksJson = await tracksRes.json();
          if (!tracksRes.ok) { toast.error(tracksJson.error ?? "Could not load tracks."); setLoadingArtistCatalog(false); return; }
          setArtistDiscSongs(tracksJson.songs ?? []);
        } catch {
          toast.error("Failed to load discography.");
        } finally {
          setLoadingArtistCatalog(false);
        }
      })();
    }
    if (artistSource === "albums") {
      fetchArtistAlbums(filter);
    }
  }, [artistSource, filter, mode]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (mode !== "artist" || artistSource !== "albums" || selectedAlbumIds.size === 0) return;
    const ids = Array.from(selectedAlbumIds);
    fetchArtistSongsFromAlbums(ids);
  }, [selectedAlbumIds]);

  const filteredArtists = data?.artists.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 20) ?? [];

  const filteredAlbums = data?.albums.filter((a) =>
    `${a.name} ${a.artist}`.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 20) ?? [];

  const handlePlaylistSelect = async (playlistId: string) => {
    setFilter(playlistId);
    setLoadingPlaylist(true);
    setPlaylistSongs([]);
    try {
      const res = await fetch(`/api/spotify/playlist-tracks?id=${playlistId}`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to load playlist tracks.");
        return;
      }
      setPlaylistSongs(json.songs ?? []);
    } catch {
      toast.error("Failed to load playlist tracks.");
    } finally {
      setLoadingPlaylist(false);
    }
  };

  const fetchArtistAlbums = async (artistName: string) => {
    setLoadingArtistCatalog(true);
    setArtistAlbums([]);
    setArtistDiscSongs([]);
    try {
      const res = await fetch(`/api/spotify/artist-catalog?name=${encodeURIComponent(artistName)}`);
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Could not load artist catalog."); return; }
      setArtistAlbums(json.albums ?? []);
      setSelectedAlbumIds(new Set((json.albums ?? []).map((a: {id: string}) => a.id)));
    } catch {
      toast.error("Failed to load artist albums.");
    } finally {
      setLoadingArtistCatalog(false);
    }
  };

  const fetchArtistSongsFromAlbums = async (albumIds: string[]) => {
    if (albumIds.length === 0) { setArtistDiscSongs([]); return; }
    setLoadingArtistCatalog(true);
    try {
      const selectedAlbums = artistAlbums.filter((a) => albumIds.includes(a.id));
      const albumNamesEncoded = encodeURIComponent(selectedAlbums.map((a) => a.name).join("|||"));
      const res = await fetch(`/api/spotify/artist-tracks?albumIds=${albumIds.join(",")}&albumNames=${albumNamesEncoded}`);
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Could not load tracks."); return; }
      setArtistDiscSongs(json.songs ?? []);
    } catch {
      toast.error("Failed to load artist tracks.");
    } finally {
      setLoadingArtistCatalog(false);
    }
  };

  const getPoolSize = (): number => {
    if (!data) return 0;
    if (mode === "playlist") return playlistSongs.length;
    if (mode === "liked") return data.likedSongs.length;
    if (mode === "top") return data.topSongs.length;
    if (mode === "artist") {
      if (artistSource !== "library") return artistDiscSongs.length;
      return data.songs.filter((s) => s.artist.toLowerCase() === filter.toLowerCase()).length;
    }
    if (mode === "album") {
      // Mirror bracket-generator.ts: filter data.songs by album name
      const al = data.albums.find((x) => `${x.name}::${x.artist}` === filter);
      return al ? data.songs.filter((s) => s.album.toLowerCase() === al.name.toLowerCase()).length : 0;
    }
    return 0;
  };

  const getMaxSize = (): BracketSize => {
    const pool = getPoolSize();
    return getValidBracketSize(pool);
  };

  const getBracketName = (): string => {
    if (mode === "top") return "My Top Songs Bracket";
    if (mode === "liked") return "Liked Songs Bracket";
    if (mode === "artist") {
      if (artistSource === "discography") return `${filter} — Full Discography Bracket`;
      if (artistSource === "albums") return `${filter} — Albums Bracket`;
      return `${filter} — Artist Bracket`;
    }
    if (mode === "album") {
      const al = data?.albums.find((x) => `${x.name}::${x.artist}` === filter);
      return al ? `${al.name} — Album Bracket` : "Album Bracket";
    }
    if (mode === "playlist") {
      const pl = data?.playlists?.find((p) => p.id === filter);
      return pl ? `${pl.name} — Playlist Bracket` : "Playlist Bracket";
    }
    return "My Bracket";
  };

  const handleCreate = async () => {
    if (!data) { toast.error("Upload your Spotify data first."); return; }
    if ((mode === "artist" || mode === "album") && !filter) {
      toast.error("Please select an artist or album.");
      return;
    }

    setCreating(true);
    await new Promise((r) => setTimeout(r, 400));

    const filterValue = mode === "album"
      ? data.albums.find((x) => `${x.name}::${x.artist}` === filter)?.name ?? filter
      : filter;

    const bracket = generateBracket(data, {
      mode,
      filter: filterValue,
      seedingMethod,
      size,
      name: getBracketName(),
      playlistSongs: mode === "playlist" ? playlistSongs : undefined,
      customPool: mode === "artist" && artistSource !== "library" ? artistDiscSongs : undefined,
    });

    if (!bracket) {
      toast.error("Not enough songs to build a bracket. Try a different selection.");
      setCreating(false);
      return;
    }

    saveBracket(bracket);
    toast.success("Bracket created! Let the battles begin.");
    router.push(`/bracket/${bracket.id}`);
  };

  const canProceed = (): boolean => {
    if (step === "mode") return true;
    if (step === "filter") {
      if (mode === "top" || mode === "liked") return true;
      if (mode === "playlist") return !!filter && !loadingPlaylist && playlistSongs.length >= 4;
      if (mode === "artist") {
        if (!filter) return false;
        if (artistSource === "library") return true;
        return !loadingArtistCatalog && artistDiscSongs.length >= 4;
      }
      return !!filter;
    }
    if (step === "seeding") return true;
    if (step === "size") return getPoolSize() >= 4;
    return false;
  };

  const nextStep = () => {
    if (step === "mode") {
      if (mode === "top" || mode === "liked") setStep("seeding");
      else setStep("filter");
    } else if (step === "filter") setStep("seeding");
    else if (step === "seeding") setStep("size");
    else handleCreate();
  };

  const prevStep = () => {
    if (step === "filter") setStep("mode");
    else if (step === "seeding") {
      if (mode === "top" || mode === "liked") setStep("mode");
      else setStep("filter");
    } else if (step === "size") setStep("seeding");
  };

  const steps: Step[] = ["mode", ...(mode === "artist" || mode === "album" || mode === "playlist" ? ["filter" as Step] : []), "seeding", "size"];
  const currentStepIdx = steps.indexOf(step);
  const progress = ((currentStepIdx + 1) / steps.length) * 100;

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6" style={{ background: "var(--background)" }}>
        <Navbar />
        <div className="text-center animate-fade-up pt-20">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--bg-2)", border: "1px solid var(--border)" }}
          >
            <Music size={32} style={{ color: "var(--text-muted)" }} />
          </div>
          <h2
            className="text-4xl mb-3"
            style={{ fontFamily: "Bebas Neue, sans-serif" }}
          >
            No Data Found
          </h2>
          <p className="mb-6" style={{ color: "var(--text-dim)" }}>
            Connect your Spotify account or upload your data export to create a bracket.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push("/connect")}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold"
              style={{ background: "var(--green)", color: "#000" }}
            >
              Connect Spotify
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => router.push("/upload")}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium"
              style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
            >
              Upload Data
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <Navbar />

      <main className="pt-24 pb-20 px-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-fade-up">
          <h1
            className="text-5xl mb-2"
            style={{ fontFamily: "Bebas Neue, sans-serif" }}
          >
            Create <span className="gradient-text">Bracket</span>
          </h1>
          <div className="progress-bar mt-4">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between mt-2">
            {steps.map((s, i) => (
              <span
                key={s}
                className="text-xs capitalize"
                style={{ color: i <= currentStepIdx ? "var(--green)" : "var(--text-muted)" }}
              >
                {s === "mode" ? "Source" : s === "filter" ? "Pick" : s === "seeding" ? "Seeding" : "Size"}
              </span>
            ))}
          </div>
        </div>

        {/* Stale-data banner */}
        {data.dataSource === "oauth" && data.songs.length === 0 && (
          <div
            className="rounded-xl p-4 mb-6 flex items-center gap-3 text-sm"
            style={{ background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.25)", color: "#ff9966" }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <div>
              Your synced data is incomplete.{" "}
              <button
                onClick={() => { clearSpotifyData(); router.push("/connect"); }}
                style={{ color: "var(--green)", textDecoration: "underline" }}
              >
                Re-sync Spotify
              </button>
              {" "}to unlock Artist and Album brackets.
            </div>
          </div>
        )}

        {/* Step: Mode */}
        {step === "mode" && (
          <div className="animate-scale-in space-y-3">
            <h2 className="text-2xl font-semibold mb-5">What do you want to bracket?</h2>

            {[
              { id: "top" as BracketMode, icon: TrendingUp, label: "My Top Songs", desc: `${data.topSongs.length} top tracks from Spotify's algorithm`, color: "var(--green)" },
              { id: "liked" as BracketMode, icon: Heart, label: "Liked Songs", desc: `${data.likedSongs.length} songs from your library`, color: "#ff6b8a" },
              { id: "artist" as BracketMode, icon: User, label: "Artist Discography", desc: `${data.artists.length} artists · choose library or full catalog`, color: "var(--cyan)" },
              { id: "album" as BracketMode, icon: Disc3, label: "Album", desc: "Every track from one album", color: "#a855f7" },
              ...(data.playlists && data.playlists.length > 0
                ? [{ id: "playlist" as BracketMode, icon: ListMusic, label: "Playlist", desc: `${data.playlists.length} playlists`, color: "#f59e0b" }]
                : []),
            ].map(({ id, icon: Icon, label, desc, color }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className="w-full flex items-center gap-4 p-5 rounded-2xl text-left transition-all"
                style={{
                  background: mode === id ? `${color}10` : "var(--bg-1)",
                  border: `2px solid ${mode === id ? color : "var(--border)"}`,
                  boxShadow: mode === id ? `0 0 20px ${color}25` : "none",
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${color}15`, border: `1px solid ${color}30` }}
                >
                  <Icon size={18} style={{ color }} />
                </div>
                <div>
                  <div className="font-semibold text-sm">{label}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{desc}</div>
                </div>
                {mode === id && (
                  <div
                    className="ml-auto w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: color }}
                  >
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4l3 3 5-6" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Step: Filter (artist or album) */}
        {step === "filter" && (
          <div className="animate-scale-in">
            <h2 className="text-2xl font-semibold mb-5">
              {mode === "artist" ? "Choose an Artist" : mode === "album" ? "Choose an Album" : "Choose a Playlist"}
            </h2>

            {mode !== "playlist" && (
              <div className="relative mb-4">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder={mode === "artist" ? "Search artists..." : mode === "album" ? "Search albums..." : "Search playlists..."}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 rounded-xl text-sm outline-none"
                  style={{
                    background: "var(--bg-1)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              </div>
            )}

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {mode === "artist"
                ? filteredArtists.map((artist) => (
                    <button
                      key={artist.name}
                      onClick={() => { setFilter(artist.name); setArtistSource("library"); setArtistDiscSongs([]); setArtistAlbums([]); setSelectedAlbumIds(new Set()); }}
                      className="w-full flex items-center justify-between p-4 rounded-xl text-left transition-all"
                      style={{
                        background: filter === artist.name ? "rgba(0,212,255,0.07)" : "var(--bg-1)",
                        border: `2px solid ${filter === artist.name ? "var(--cyan)" : "var(--border)"}`,
                      }}
                    >
                      <div>
                        <div className="font-medium text-sm">{artist.name}</div>
                        <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {artist.songs.length} songs
                          {data?.dataSource !== "oauth" && ` · ${artist.totalPlays.toLocaleString()} plays`}
                        </div>
                      </div>
                      <Users size={14} style={{ color: "var(--text-muted)" }} />
                    </button>
                  ))
                : mode === "album"
                ? filteredAlbums.map((album) => {
                    const key = `${album.name}::${album.artist}`;
                    return (
                      <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className="w-full flex items-center justify-between p-4 rounded-xl text-left transition-all"
                        style={{
                          background: filter === key ? "rgba(168,85,247,0.07)" : "var(--bg-1)",
                          border: `2px solid ${filter === key ? "#a855f7" : "var(--border)"}`,
                        }}
                      >
                        <div>
                          <div className="font-medium text-sm">{album.name}</div>
                          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {album.artist} · {album.songs.length} tracks
                          </div>
                        </div>
                        <Disc3 size={14} style={{ color: "var(--text-muted)" }} />
                      </button>
                    );
                  })
                : (data.playlists ?? []).map((pl) => {
                    const isExternal = !!pl.ownerId && pl.ownerId !== data.userProfile?.id;
                    const isSpotifyOwned = pl.ownerId === "spotify";
                    return (
                    <button
                      key={pl.id}
                      onClick={() => handlePlaylistSelect(pl.id)}
                      className="w-full flex items-center justify-between p-4 rounded-xl text-left transition-all"
                      style={{
                        background: filter === pl.id ? "rgba(245,158,11,0.07)" : "var(--bg-1)",
                        border: `2px solid ${filter === pl.id ? "#f59e0b" : "var(--border)"}`,
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {pl.images[0]?.url ? (
                          <img src={pl.images[0].url} alt={pl.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "var(--bg-3)" }}>
                            <ListMusic size={14} style={{ color: "var(--text-muted)" }} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">{pl.name}</div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                              {pl.tracks?.total != null ? `${pl.tracks.total} tracks` : "— tracks"}
                            </span>
                            {isSpotifyOwned && (
                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,107,53,0.12)", color: "#ff9966", border: "1px solid rgba(255,107,53,0.25)" }}>
                                Spotify playlist
                              </span>
                            )}
                            {isExternal && !isSpotifyOwned && (
                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,68,68,0.08)", color: "#ff8080", border: "1px solid rgba(255,68,68,0.2)" }}>
                                Not yours
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 ml-2">
                        {filter === pl.id && loadingPlaylist && (
                          <Loader2 size={14} className="animate-spin" style={{ color: "#f59e0b" }} />
                        )}
                        {filter === pl.id && !loadingPlaylist && playlistSongs.length > 0 && (
                          <span className="text-xs" style={{ color: "#f59e0b" }}>
                            {playlistSongs.length} loaded
                          </span>
                        )}
                        {filter === pl.id && !loadingPlaylist && playlistSongs.length === 0 && (
                          <span className="text-xs" style={{ color: "#ff8080" }}>
                            0 loaded
                          </span>
                        )}
                      </div>
                    </button>
                    );
                  })
              }
            </div>

            {mode === "playlist" && filter && !loadingPlaylist && playlistSongs.length === 0 && (() => {
              const selectedPl = data.playlists?.find(p => p.id === filter);
              const isExternal = !!selectedPl?.ownerId && selectedPl.ownerId !== data.userProfile?.id;
              const isSpotifyOwned = selectedPl?.ownerId === "spotify";
              return (
                <div
                  className="mt-3 rounded-xl p-3 text-xs leading-relaxed"
                  style={{ background: "rgba(255,68,68,0.07)", border: "1px solid rgba(255,68,68,0.2)", color: "#ff8080" }}
                >
                  {isSpotifyOwned
                    ? "Spotify-generated playlists (Daylist, radio, AI mixes) can't be accessed through the API. Try one of your own playlists."
                    : isExternal
                    ? "This playlist is owned by another user. Spotify only allows reading your own playlists. Try a playlist you created."
                    : "No playable Spotify tracks found in this playlist. It may contain only local files, podcast episodes, or deleted tracks. Try a different playlist."}
                </div>
              );
            })()}

            {mode === "artist" && filter && (
              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                  Song Pool
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {([
                    { key: "library" as const, label: "My Library", desc: `${data.songs.filter(s => s.artist.toLowerCase() === filter.toLowerCase()).length} songs` },
                    { key: "discography" as const, label: "Full Catalog", desc: "All Spotify releases" },
                    { key: "albums" as const, label: "Pick Albums", desc: "Choose specific albums" },
                  ] as const).map(({ key, label, desc }) => (
                    <button
                      key={key}
                      onClick={() => setArtistSource(key)}
                      className="p-3 rounded-xl text-left transition-all"
                      style={{
                        background: artistSource === key ? "rgba(0,212,255,0.08)" : "var(--bg-1)",
                        border: `2px solid ${artistSource === key ? "var(--cyan)" : "var(--border)"}`,
                      }}
                    >
                      <div className="font-semibold text-xs">{label}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{desc}</div>
                    </button>
                  ))}
                </div>

                {(artistSource === "discography" || artistSource === "albums") && loadingArtistCatalog && (
                  <div className="flex items-center gap-2 text-sm py-3" style={{ color: "var(--text-muted)" }}>
                    <Loader2 size={14} className="animate-spin" />
                    {artistSource === "discography" ? "Loading full discography…" : "Loading albums…"}
                  </div>
                )}

                {artistSource === "discography" && !loadingArtistCatalog && artistDiscSongs.length > 0 && (
                  <div className="text-sm py-2" style={{ color: "var(--green)" }}>
                    ✓ {artistDiscSongs.length} songs loaded from {artistAlbums.length} releases — seeded by Spotify popularity
                  </div>
                )}

                {artistSource === "albums" && !loadingArtistCatalog && artistAlbums.length > 0 && (
                  <>
                    <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                      Select Albums
                    </div>
                    <div className="flex items-center gap-3 mb-3">
                      <button
                        className="text-xs underline"
                        style={{ color: "var(--green)" }}
                        onClick={() => setSelectedAlbumIds(new Set(artistAlbums.map(a => a.id)))}
                      >
                        Select all
                      </button>
                      <button
                        className="text-xs underline"
                        style={{ color: "var(--text-muted)" }}
                        onClick={() => setSelectedAlbumIds(new Set())}
                      >
                        Clear
                      </button>
                      {artistDiscSongs.length > 0 && (
                        <span className="text-xs ml-auto" style={{ color: "var(--green)" }}>
                          {artistDiscSongs.length} songs
                        </span>
                      )}
                    </div>
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {artistAlbums.map((album) => {
                        const checked = selectedAlbumIds.has(album.id);
                        return (
                          <button
                            key={album.id}
                            onClick={() => {
                              const next = new Set(selectedAlbumIds);
                              if (checked) next.delete(album.id);
                              else next.add(album.id);
                              setSelectedAlbumIds(next);
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                            style={{
                              background: checked ? "rgba(0,212,255,0.06)" : "var(--bg-1)",
                              border: `1px solid ${checked ? "var(--cyan)" : "var(--border)"}`,
                            }}
                          >
                            {album.image ? (
                              <img src={album.image} alt={album.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg flex-shrink-0" style={{ background: "var(--bg-3)" }} />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{album.name}</div>
                              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                                {album.year} · {album.totalTracks} tracks · {album.type}
                              </div>
                            </div>
                            <div
                              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                              style={{ background: checked ? "var(--cyan)" : "var(--bg-3)", border: `1px solid ${checked ? "var(--cyan)" : "var(--border)"}` }}
                            >
                              {checked && (
                                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                  <path d="M1 4l3 3 5-6" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step: Seeding */}
        {step === "seeding" && (
          <div className="animate-scale-in space-y-4">
            <h2 className="text-2xl font-semibold mb-5">How should songs be seeded?</h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>
              Seeding determines round 1 matchups — top seeds face bottom seeds, like March Madness.
            </p>

            {data.dataSource === "oauth" && (
              <div
                className="rounded-xl p-3 mb-4 text-xs leading-relaxed"
                style={{ background: "rgba(29,185,84,0.06)", border: "1px solid rgba(29,185,84,0.2)", color: "var(--text-muted)" }}
              >
                Spotify's API doesn't expose raw stream counts. Seeding uses Spotify's <strong style={{ color: "var(--green)" }}>popularity score</strong> (0–100) as the best available proxy. Upload your Spotify data export for real play counts.
              </div>
            )}

            {(data.dataSource === "oauth"
              ? [
                  {
                    id: "popularity" as SeedingMethod,
                    icon: TrendingUp,
                    label: "Spotify Popularity",
                    desc: "Seeded by Spotify's popularity score (0–100). Reflects overall listener activity — higher popularity = higher seed.",
                    color: "var(--green)",
                  },
                  {
                    id: "personal" as SeedingMethod,
                    icon: Zap,
                    label: "Library Recency",
                    desc: "Seeded by how recently you liked or played each song. Most recently added/played = highest seed.",
                    color: "var(--cyan)",
                  },
                ]
              : [
                  {
                    id: "personal" as SeedingMethod,
                    icon: Zap,
                    label: "Personal Play Count",
                    desc: "Seeded by how many times YOU personally played each song. More listens = higher seed.",
                    color: "var(--green)",
                  },
                  {
                    id: "artist_total" as SeedingMethod,
                    icon: TrendingUp,
                    label: "Artist's Total Plays",
                    desc: "Seeded by your total plays across all songs from that artist. Great for surfacing underrated tracks.",
                    color: "var(--orange)",
                  },
                ]
            ).map(({ id, icon: Icon, label, desc, color }) => (
              <button
                key={id}
                onClick={() => setSeedingMethod(id)}
                className="w-full flex items-start gap-4 p-5 rounded-2xl text-left transition-all"
                style={{
                  background: seedingMethod === id ? `${color}10` : "var(--bg-1)",
                  border: `2px solid ${seedingMethod === id ? color : "var(--border)"}`,
                }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `${color}15` }}
                >
                  <Icon size={18} style={{ color }} />
                </div>
                <div>
                  <div className="font-semibold text-sm">{label}</div>
                  <div className="text-xs mt-1 leading-relaxed" style={{ color: "var(--text-muted)" }}>{desc}</div>
                </div>
              </button>
            ))}

            {(mode === "artist" && artistSource !== "library") && (
              <div className="rounded-xl p-3 text-xs" style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>
                Artist catalog songs are seeded by Spotify popularity — actual stream counts aren't available through the API.
              </div>
            )}
          </div>
        )}

        {/* Step: Size */}
        {step === "size" && (
          <div className="animate-scale-in">
            <h2 className="text-2xl font-semibold mb-2">Choose bracket size</h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-dim)" }}>
              Pool has {getPoolSize()} eligible songs. Max bracket: {getMaxSize()}.
            </p>

            {getPoolSize() < 4 && (
              <div
                className="rounded-xl p-4 mb-6 flex items-center gap-3 text-sm"
                style={{ background: "rgba(255,68,68,0.07)", border: "1px solid rgba(255,68,68,0.2)", color: "#ff8080" }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <div>
                  Not enough songs to build a bracket (need at least 4).{" "}
                  {data.dataSource === "oauth" && (
                    <button
                      onClick={() => { clearSpotifyData(); router.push("/connect"); }}
                      style={{ color: "var(--green)", textDecoration: "underline" }}
                    >
                      Re-sync Spotify
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-8">
              {BRACKET_SIZES.map((s) => {
                const available = s <= getMaxSize();
                return (
                  <button
                    key={s}
                    onClick={() => available && setSize(s)}
                    disabled={!available}
                    className="p-5 rounded-2xl text-center transition-all"
                    style={{
                      background: size === s ? "rgba(29,185,84,0.08)" : "var(--bg-1)",
                      border: `2px solid ${size === s ? "var(--green)" : "var(--border)"}`,
                      opacity: available ? 1 : 0.3,
                      cursor: available ? "pointer" : "not-allowed",
                    }}
                  >
                    <div
                      className="text-4xl mb-1"
                      style={{ fontFamily: "Bebas Neue, sans-serif", color: size === s ? "var(--green)" : "var(--foreground)" }}
                    >
                      {s}
                    </div>
                    <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                      {s - 1} battles · {Math.log2(s)} rounds
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Preview */}
            <div
              className="rounded-2xl p-5"
              style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}
            >
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                Bracket Preview
              </div>
              <div className="font-semibold">{getBracketName()}</div>
              <div className="text-sm mt-1 space-y-1" style={{ color: "var(--text-dim)" }}>
                <div className="flex items-center gap-2">
                  <Trophy size={12} style={{ color: "var(--green)" }} />
                  {size} songs · {size - 1} total battles · {Math.log2(size)} rounds
                </div>
                <div className="flex items-center gap-2">
                  <Zap size={12} style={{ color: "var(--cyan)" }} />
                  Seeded by: {seedingMethod === "popularity" ? "Spotify popularity" : seedingMethod === "personal" ? (data.dataSource === "oauth" ? "library recency" : "your personal plays") : "artist total plays"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-8 gap-3">
          {step !== "mode" ? (
            <button
              onClick={prevStep}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium"
              style={{ background: "var(--bg-2)", color: "var(--text-dim)", border: "1px solid var(--border)" }}
            >
              <ArrowLeft size={16} />
              Back
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={nextStep}
            disabled={!canProceed() || creating}
            className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all"
            style={{
              background: canProceed() ? "var(--green)" : "var(--bg-3)",
              color: canProceed() ? "#000" : "var(--text-muted)",
              cursor: canProceed() ? "pointer" : "not-allowed",
              boxShadow: canProceed() && step === "size" ? "0 0 24px var(--green-glow)" : "none",
            }}
          >
            {creating ? "Creating..." : step === "size" ? "Create Bracket" : "Next"}
            {!creating && <ArrowRight size={16} />}
          </button>
        </div>
      </main>
    </div>
  );
}
