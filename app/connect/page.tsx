"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Music2, Loader2, CheckCircle2, AlertCircle, Zap, Heart, ListMusic, X, RefreshCw, LayoutDashboard, TrendingUp, User } from "lucide-react";
import { saveSpotifyData, loadSpotifyData, clearSpotifyData } from "@/lib/store";
import Navbar from "@/components/layout/Navbar";

type SyncStatus = "idle" | "syncing" | "done" | "error" | "already_connected";

const syncSteps = [
  { label: "Liked songs", icon: Heart },
  { label: "Recently played", icon: Zap },
  { label: "Playlists", icon: ListMusic },
  { label: "Top tracks — 4 wks, 6 mo, all time", icon: TrendingUp },
  { label: "Top artists — 4 wks, 6 mo, all time", icon: User },
];

const TIMEOUT_MS = 15000;

export default function ConnectPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [stepIdx, setStepIdx] = useState(0);
  const [error, setError] = useState("");
  const [syncedSongs, setSyncedSongs] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const syncingRef = useRef(false);
  const hasCheckedRef = useRef(false); // only run the auth check once

  const doSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    cancelledRef.current = false;

    const controller = new AbortController();
    abortRef.current = controller;

    setSyncStatus("syncing");
    setStepIdx(0);
    setError("");

    const stepInterval = setInterval(() => {
      setStepIdx((prev) => Math.min(prev + 1, syncSteps.length - 1));
    }, 900);

    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch("/api/spotify/sync", { signal: controller.signal });
      clearInterval(stepInterval);
      clearTimeout(timeout);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      const data = await res.json();
      setStepIdx(syncSteps.length);
      saveSpotifyData(data);
      setSyncedSongs(data.songs?.length ?? 0);
      setSyncStatus("done");
      setTimeout(() => router.push("/dashboard"), 1800);
    } catch (e) {
      clearInterval(stepInterval);
      clearTimeout(timeout);
      syncingRef.current = false;

      if (cancelledRef.current) return;

      if ((e as Error).name === "AbortError") {
        setError(
          "Timed out waiting for Spotify. Make sure SPOTIFY_CLIENT_SECRET and NEXTAUTH_SECRET are filled in inside .env.local, then restart the dev server."
        );
      } else {
        setError((e as Error).message || "Something went wrong — check the terminal for details.");
      }
      setSyncStatus("error");
    }
  }, [router]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    syncingRef.current = false;
    abortRef.current?.abort();
    signOut({ redirect: false }).finally(() => router.push("/"));
  }, [router]);

  const handleRetry = useCallback(() => {
    syncingRef.current = false;
    cancelledRef.current = false;
    doSync();
  }, [doSync]);

  // Only auto-sync if this is a fresh OAuth callback (no existing data)
  useEffect(() => {
    if (status === "loading" || hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    if (status === "authenticated") {
      const existingData = loadSpotifyData();
      if (existingData) {
        // If stored data has no songs at all it's a broken/incomplete sync — re-sync automatically
        const isEmpty = existingData.songs.length === 0 &&
          (!existingData.topSongs || existingData.topSongs.length === 0);
        if (isEmpty) {
          clearSpotifyData();
          doSync();
        } else {
          setSyncStatus("already_connected");
        }
      } else {
        // No data at all — fresh OAuth callback, sync now
        doSync();
      }
    }
  }, [status, doSync]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-6 pt-20">
        <div className="w-full max-w-md text-center">

          {/* Not signed in */}
          {status !== "authenticated" && status !== "loading" && (
            <div className="animate-fade-up">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse-glow"
                style={{ background: "rgba(29,185,84,0.12)", border: "2px solid var(--green)" }}
              >
                <Music2 size={36} style={{ color: "var(--green)" }} />
              </div>

              <h1 className="text-5xl mb-3" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                Connect <span className="gradient-text">Spotify</span>
              </h1>

              <p className="mb-8 leading-relaxed" style={{ color: "var(--text-dim)" }}>
                Sign in with Spotify to pull your library, top tracks, top artists, playlists, and recently played — all at once.
              </p>

              <div
                className="rounded-2xl p-5 mb-6 text-left space-y-3"
                style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}
              >
                <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                  What we&apos;ll import
                </div>
                {syncSteps.map(({ label, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-3 text-sm" style={{ color: "var(--text-dim)" }}>
                    <Icon size={13} style={{ color: "var(--green)", flexShrink: 0 }} />
                    {label}
                  </div>
                ))}
              </div>

              <button
                onClick={() => signIn("spotify", { callbackUrl: "/connect" })}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-bold text-base animate-pulse-glow"
                style={{ background: "var(--green)", color: "#000" }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                Continue with Spotify
              </button>

              <p className="mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
                We only read your data — we never modify your Spotify account.
              </p>
            </div>
          )}

          {/* Session loading OR authenticated but effect hasn't fired yet — never show blank */}
          {(status === "loading" || (status === "authenticated" && syncStatus === "idle")) && (
            <div className="animate-fade-in flex flex-col items-center gap-3">
              <Loader2 size={28} className="animate-spin" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Checking connection...</p>
            </div>
          )}

          {/* Already connected — don't auto-sync, let user choose */}
          {syncStatus === "already_connected" && (
            <div className="animate-fade-up">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: "rgba(29,185,84,0.12)", border: "2px solid var(--green)" }}
              >
                <CheckCircle2 size={36} style={{ color: "var(--green)" }} />
              </div>
              <h2 className="text-4xl mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                Already <span className="gradient-text">Connected</span>
              </h2>
              <p className="mb-8" style={{ color: "var(--text-dim)" }}>
                Your Spotify data is already loaded.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => { clearSpotifyData(); setSyncStatus("idle"); doSync(); }}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold"
                  style={{ background: "var(--green)", color: "#000" }}
                >
                  <RefreshCw size={15} />
                  Re-sync Spotify Data
                </button>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-medium"
                  style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
                >
                  <LayoutDashboard size={16} />
                  Go to Dashboard
                </button>
              </div>
            </div>
          )}

          {/* Syncing */}
          {syncStatus === "syncing" && (
            <div className="animate-fade-in">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: "rgba(29,185,84,0.12)", border: "2px solid var(--green)" }}
              >
                <Loader2 size={36} className="animate-spin" style={{ color: "var(--green)" }} />
              </div>

              <h2 className="text-4xl mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                Connecting...
              </h2>
              <p className="mb-8" style={{ color: "var(--text-dim)" }}>Pulling your Spotify data</p>

              <div
                className="rounded-2xl p-5 text-left space-y-3 mb-5"
                style={{ background: "var(--bg-1)", border: "1px solid var(--border)" }}
              >
                {syncSteps.map(({ label, icon: Icon }, i) => (
                  <div key={label} className="flex items-center gap-3 text-sm">
                    {i < stepIdx ? (
                      <CheckCircle2 size={14} style={{ color: "var(--green)", flexShrink: 0 }} />
                    ) : i === stepIdx ? (
                      <Loader2 size={14} className="animate-spin" style={{ color: "var(--green)", flexShrink: 0 }} />
                    ) : (
                      <Icon size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    )}
                    <span style={{ color: i <= stepIdx ? "var(--foreground)" : "var(--text-muted)" }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium mx-auto"
                style={{ background: "var(--bg-2)", border: "1px solid var(--border-bright)", color: "var(--text-dim)", cursor: "pointer" }}
              >
                <X size={14} />
                Cancel
              </button>
            </div>
          )}

          {/* Done */}
          {syncStatus === "done" && (
            <div className="animate-scale-in">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-winner-pop"
                style={{ background: "rgba(29,185,84,0.15)", border: "2px solid var(--green)" }}
              >
                <CheckCircle2 size={36} style={{ color: "var(--green)" }} />
              </div>
              <h2 className="text-4xl mb-2" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                <span className="gradient-text">All synced!</span>
              </h2>
              <p className="mb-1" style={{ color: "var(--text-dim)" }}>
                {syncedSongs > 0 ? `${syncedSongs.toLocaleString()} songs imported` : "Library synced"}
              </p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>Heading to your dashboard...</p>
            </div>
          )}

          {/* Error */}
          {syncStatus === "error" && (
            <div className="animate-fade-in">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: "rgba(255,68,68,0.1)", border: "2px solid #ff4444" }}
              >
                <AlertCircle size={36} style={{ color: "#ff4444" }} />
              </div>
              <h2 className="text-4xl mb-3" style={{ fontFamily: "Bebas Neue, sans-serif" }}>
                Connection Failed
              </h2>
              <div
                className="rounded-xl p-4 mb-6 text-left text-sm leading-relaxed"
                style={{ background: "rgba(255,68,68,0.07)", border: "1px solid rgba(255,68,68,0.2)", color: "#ff8080" }}
              >
                {error}
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleRetry}
                  className="px-6 py-3 rounded-xl font-bold"
                  style={{ background: "var(--green)", color: "#000" }}
                >
                  Try Again
                </button>
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium"
                  style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
                >
                  <X size={14} />
                  Go Back
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
