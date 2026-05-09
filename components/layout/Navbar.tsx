"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { Music2, Trophy, BarChart3, Upload, Zap, LogOut, LogIn, Loader2 } from "lucide-react";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/bracket/new", label: "New Bracket", icon: Zap },
  { href: "/upload", label: "Upload Data", icon: Upload },
];

export default function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: "rgba(8,8,8,0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--green)", boxShadow: "0 0 16px var(--green-glow)" }}
          >
            <Music2 size={16} color="#000" strokeWidth={2.5} />
          </div>
          <span
            className="text-xl tracking-wider"
            style={{ fontFamily: "Bebas Neue, sans-serif" }}
          >
            Whoaux
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  color: active ? "var(--green)" : "var(--text-dim)",
                  background: active ? "rgba(29,185,84,0.1)" : "transparent",
                  border: active ? "1px solid rgba(29,185,84,0.2)" : "1px solid transparent",
                }}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Auth + CTA */}
        <div className="flex items-center gap-2">
          {status === "loading" ? (
            <Loader2 size={16} className="animate-spin" style={{ color: "var(--text-muted)" }} />
          ) : session ? (
            <>
              {/* User avatar */}
              {session.user?.image && (
                <img
                  src={session.user.image}
                  alt={session.user.name ?? "User"}
                  className="w-8 h-8 rounded-full object-cover"
                  style={{ border: "2px solid var(--green)" }}
                />
              )}
              <span className="hidden sm:block text-sm" style={{ color: "var(--text-dim)" }}>
                {session.user?.name?.split(" ")[0]}
              </span>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                style={{
                  color: "var(--text-muted)",
                  border: "1px solid var(--border)",
                }}
              >
                <LogOut size={12} />
                <span className="hidden sm:block">Sign out</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => signIn("spotify")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all"
              style={{
                background: "var(--green)",
                color: "#000",
              }}
            >
              <LogIn size={14} />
              Connect Spotify
            </button>
          )}

          {session && (
            <Link
              href="/bracket/new"
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
              style={{ background: "var(--green)", color: "#000" }}
            >
              <Trophy size={14} />
              Battle
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
