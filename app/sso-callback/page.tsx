"use client";

import { useEffect, useRef, useState } from "react";
import { useUser, AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";

export default function SSOCallback() {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const navigated = useRef(false);
  const [timedOut, setTimedOut] = useState(false);

  // Clerk's Next.js adapter calls invalidateCacheAction().then(resolve) for Next.js 16
  // sign-in flows. If that server action fails the promise never resolves and
  // handleRedirectCallback hangs forever. Patching to resolve immediately unblocks it.
  // router.refresh() in onAfterSetActive still runs to keep the cache consistent.
  useEffect(() => {
    const win = window as Window & {
      __unstable__onBeforeSetActive?: (intent: string) => Promise<void>;
    };
    const original = win.__unstable__onBeforeSetActive;
    win.__unstable__onBeforeSetActive = () => Promise.resolve();
    return () => {
      win.__unstable__onBeforeSetActive = original;
    };
  }, []);

  // Belt-and-suspenders: if Clerk creates a session but its own navigation fails,
  // we detect isSignedIn becoming true and push ourselves.
  useEffect(() => {
    if (!isLoaded || !isSignedIn || navigated.current) return;
    navigated.current = true;
    router.push("/connect");
  }, [isLoaded, isSignedIn, router]);

  // Timeout fallback — show an error instead of spinning forever
  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), 15000);
    return () => clearTimeout(t);
  }, []);

  if (timedOut) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: "var(--background)" }}
      >
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <AlertCircle size={32} style={{ color: "#ff4444" }} />
          <h2 className="text-2xl font-bold">Connection stalled</h2>
          <p className="text-sm leading-relaxed" style={{ color: "#ff8080" }}>
            Spotify authentication did not complete. Please try again.
          </p>
          <button
            onClick={() => router.push("/connect")}
            className="px-6 py-3 rounded-xl font-bold text-sm"
            style={{ background: "var(--green)", color: "#000" }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--background)" }}
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Connecting Spotify...</p>
      </div>
      <AuthenticateWithRedirectCallback
        afterSignInUrl="/connect"
        afterSignUpUrl="/connect"
        continueSignUpUrl="/connect"
        signInUrl="/connect"
        signUpUrl="/connect"
      />
    </div>
  );
}
