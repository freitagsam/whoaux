"use client";

import { useEffect, useState } from "react";
import { useUser, useSignIn } from "@clerk/nextjs";
import Link from "next/link";
import {
  Upload, Trophy, BarChart3, Zap, ChevronRight,
  Star, LayoutDashboard, LogIn, Music2,
} from "lucide-react";
import { loadSpotifyData } from "@/lib/store";
import Navbar from "@/components/layout/Navbar";

const features = [
  {
    icon: Music2,
    title: "Connect Spotify",
    desc: "Log in instantly to pull your liked songs, top tracks, top artists, playlists, and recently played — no file needed.",
    color: "var(--green)",
    glow: "rgba(29,185,84,0.15)",
  },
  {
    icon: Upload,
    title: "Upload for Deep Stats",
    desc: "Drop your Spotify data export for real play counts, hours listened, skip rates, and listening patterns. Stays local.",
    color: "var(--cyan)",
    glow: "rgba(0,212,255,0.15)",
  },
  {
    icon: Trophy,
    title: "Build a Bracket",
    desc: "Choose liked songs, top tracks, or all songs from an artist. Pick your size: 8, 16, 32, or 64 songs.",
    color: "#a855f7",
    glow: "rgba(168,85,247,0.15)",
  },
  {
    icon: Zap,
    title: "Battle Your Music",
    desc: "Pick your favorite in each head-to-head matchup. The bracket advances until one song stands above all.",
    color: "var(--orange)",
    glow: "rgba(255,107,53,0.15)",
  },
];

const mockBracketSongs = [
  { name: "Blinding Lights", artist: "The Weeknd", seed: 1 },
  { name: "Starboy", artist: "The Weeknd", seed: 2 },
];

export default function HomePage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signIn } = useSignIn();
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    setHasData(!!loadSpotifyData());
  }, []);

  const handleSpotifySignIn = async () => {
    await signIn?.authenticateWithRedirect({
      strategy: "oauth_spotify",
      redirectUrl: "/sso-callback",
      redirectUrlComplete: "/connect",
    });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      <Navbar />

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 flex flex-col items-center text-center relative overflow-hidden">
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full blur-[120px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(29,185,84,0.12) 0%, transparent 70%)" }}
        />
        <div
          className="absolute top-40 left-1/4 w-[300px] h-[300px] rounded-full blur-[100px] pointer-events-none"
          style={{ background: "radial-gradient(ellipse, rgba(0,212,255,0.06) 0%, transparent 70%)" }}
        />

        <div className="animate-fade-up relative z-10 flex flex-col items-center gap-6 max-w-4xl">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wider uppercase"
            style={{
              background: "rgba(29,185,84,0.1)",
              border: "1px solid rgba(29,185,84,0.3)",
              color: "var(--green)",
            }}
          >
            <Star size={10} />
            Your Spotify data. Reimagined.
          </div>

          <h1
            className="text-7xl sm:text-8xl md:text-[108px] leading-none tracking-wide"
            style={{ fontFamily: "Bebas Neue, sans-serif" }}
          >
            <span className="gradient-text">Battle</span>
            <br />
            <span style={{ color: "var(--foreground)" }}>Your Music</span>
          </h1>

          <p
            className="text-lg max-w-xl leading-relaxed"
            style={{ color: "var(--text-dim)" }}
          >
            Connect your Spotify or upload your history, build tournament brackets, and finally answer the
            question: <strong style={{ color: "var(--foreground)" }}>what&apos;s your all-time favorite song?</strong>
          </p>

          {/* Auth-aware CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
            {isLoaded && isSignedIn ? (
              <>
                <Link
                  href={hasData ? "/dashboard" : "/connect"}
                  className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-bold transition-all animate-pulse-glow"
                  style={{ background: "var(--green)", color: "#000" }}
                >
                  <LayoutDashboard size={18} />
                  {hasData ? "Go to Dashboard" : "Sync Your Music"}
                </Link>
                <Link
                  href="/bracket/new"
                  className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-medium transition-all"
                  style={{
                    background: "transparent",
                    color: "var(--text-dim)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Trophy size={16} />
                  New Bracket
                </Link>
              </>
            ) : (
              <>
                <button
                  onClick={handleSpotifySignIn}
                  className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-bold transition-all animate-pulse-glow"
                  style={{ background: "var(--green)", color: "#000" }}
                >
                  <LogIn size={18} />
                  Connect Spotify
                </button>
                <Link
                  href="/upload"
                  className="flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-medium transition-all"
                  style={{
                    background: "transparent",
                    color: "var(--text-dim)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Upload size={16} />
                  Upload Data File
                </Link>
              </>
            )}
          </div>

          {/* Welcome back pill when logged in */}
          {isLoaded && isSignedIn && user?.fullName && (
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm mt-2"
              style={{
                background: "var(--bg-1)",
                border: "1px solid var(--border)",
                color: "var(--text-dim)",
              }}
            >
              {user.imageUrl && (
                <img src={user.imageUrl} alt="" className="w-5 h-5 rounded-full" />
              )}
              Welcome back, <strong style={{ color: "var(--foreground)" }}>{user.firstName}</strong>
            </div>
          )}
        </div>
      </section>

      {/* Mock bracket preview */}
      <section className="px-6 pb-24 flex flex-col items-center">
        <div
          className="w-full max-w-2xl rounded-2xl overflow-hidden animate-fade-up delay-200"
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--border)",
            boxShadow: "0 40px 100px rgba(0,0,0,0.6)",
          }}
        >
          <div
            className="px-5 py-3 flex items-center gap-2"
            style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-2)" }}
          >
            <div className="w-3 h-3 rounded-full" style={{ background: "#ff5f57" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#febc2e" }} />
            <div className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
            <span className="ml-3 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
              The Weeknd — Artist Bracket · Round of 8
            </span>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <span
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: "var(--text-muted)" }}
              >
                Pick your favorite
              </span>
              <div
                className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: "rgba(29,185,84,0.1)", color: "var(--green)" }}
              >
                Match 3 of 4
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {mockBracketSongs.map((song, i) => (
                <div
                  key={i}
                  className="p-5 rounded-xl cursor-pointer transition-all"
                  style={{
                    background: i === 0 ? "rgba(29,185,84,0.07)" : "var(--bg-2)",
                    border: i === 0 ? "2px solid var(--green)" : "2px solid var(--border)",
                    boxShadow: i === 0 ? "0 0 30px var(--green-glow)" : "none",
                  }}
                >
                  <div
                    className="text-xs mb-1 font-bold"
                    style={{ color: i === 0 ? "var(--green)" : "var(--text-muted)" }}
                  >
                    #{song.seed} Seed
                  </div>
                  <div className="font-semibold text-sm leading-tight mb-1">{song.name}</div>
                  <div className="text-xs" style={{ color: "var(--text-dim)" }}>{song.artist}</div>
                </div>
              ))}
            </div>

            <div className="mt-4 progress-bar">
              <div className="progress-fill" style={{ width: "62%" }} />
            </div>
            <div className="mt-2 text-xs text-center" style={{ color: "var(--text-muted)" }}>
              5 matches remaining
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="px-6 pb-24 max-w-6xl mx-auto w-full">
        <div className="text-center mb-14">
          <h2
            className="text-5xl md:text-6xl mb-4"
            style={{ fontFamily: "Bebas Neue, sans-serif" }}
          >
            How It Works
          </h2>
          <p style={{ color: "var(--text-dim)" }}>
            Connect or upload — then battle your way to your #1 song
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map(({ icon: Icon, title, desc, color, glow }, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl flex flex-col gap-4 animate-fade-up"
              style={{
                background: "var(--bg-1)",
                border: "1px solid var(--border)",
                animationDelay: `${i * 0.1}s`,
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: glow, border: `1px solid ${color}30` }}
              >
                <Icon size={18} style={{ color }} />
              </div>
              <div>
                <div className="font-semibold text-sm mb-1">{title}</div>
                <div className="text-sm leading-relaxed" style={{ color: "var(--text-dim)" }}>
                  {desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA footer section */}
      <section className="px-6 pb-32 flex flex-col items-center text-center">
        <div
          className="w-full max-w-2xl rounded-2xl p-12 flex flex-col items-center gap-6"
          style={{
            background: "linear-gradient(135deg, rgba(29,185,84,0.08) 0%, rgba(0,212,255,0.05) 100%)",
            border: "1px solid rgba(29,185,84,0.2)",
          }}
        >
          <h2
            className="text-5xl"
            style={{ fontFamily: "Bebas Neue, sans-serif" }}
          >
            Ready to find your
            <br />
            <span className="gradient-text">#1 Song?</span>
          </h2>
          <p style={{ color: "var(--text-dim)" }}>
            Connect your Spotify for instant access, or request your data export for full listening stats.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {isLoaded && isSignedIn ? (
              <Link
                href={hasData ? "/dashboard" : "/connect"}
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold"
                style={{ background: "var(--green)", color: "#000" }}
              >
                <LayoutDashboard size={16} />
                {hasData ? "Go to Dashboard" : "Sync Your Music"}
              </Link>
            ) : (
              <button
                onClick={handleSpotifySignIn}
                className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold"
                style={{ background: "var(--green)", color: "#000" }}
              >
                <LogIn size={16} />
                Connect Spotify
              </button>
            )}
            <a
              href="https://www.spotify.com/account/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-medium"
              style={{ border: "1px solid var(--border)", color: "var(--text-dim)" }}
            >
              Request Spotify Data
              <ChevronRight size={14} />
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto px-6 py-6" style={{ borderTop: "1px solid var(--border)" }}>
        <div
          className="max-w-6xl mx-auto flex items-center justify-between text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          <span style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: 16 }}>Whoaux</span>
          <span>Your data stays local. No accounts required.</span>
        </div>
      </footer>
    </div>
  );
}
