"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// This page is no longer used — OAuth now goes through /api/auth/callback.
// Redirect anyone who lands here (e.g. old bookmarks) to /connect.
export default function SSOCallback() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/connect");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Redirecting...</p>
      </div>
    </div>
  );
}
