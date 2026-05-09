"use client";

import { useEffect, useRef, useState } from "react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, ExternalLink } from "lucide-react";

function SpotifyFixGuide({ clerkError }: { clerkError?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md text-center">
      <AlertCircle size={32} style={{ color: "#ff4444" }} />
      <h2 className="text-2xl font-bold">Spotify connection failed</h2>

      <div
        className="text-sm text-left w-full p-4 rounded-xl space-y-3"
        style={{ background: "rgba(255,68,68,0.07)", border: "1px solid rgba(255,68,68,0.2)", color: "#ff8080" }}
      >
        {clerkError === "internal_clerk_error" ? (
          <>
            <p className="font-semibold" style={{ color: "#ff6060" }}>
              Clerk's backend got rejected by Spotify during the token exchange.
            </p>
            <p>Fix both of these in order:</p>
            <ol className="space-y-2 list-decimal list-inside" style={{ color: "#ffaaaa" }}>
              <li>
                <span className="font-semibold" style={{ color: "#fff" }}>Spotify Developer Dashboard</span>
                {" "}→ your app → Settings → Redirect URIs. Add this URI and save:
                <pre
                  className="mt-1 p-2 rounded text-xs break-all"
                  style={{ background: "rgba(0,0,0,0.3)", color: "#1db954" }}
                >
                  https://harmless-eagle-37.clerk.accounts.dev/v1/oauth_callback
                </pre>
              </li>
              <li>
                <span className="font-semibold" style={{ color: "#fff" }}>Clerk Dashboard</span>
                {" "}→ Configure → Social Connections → Spotify → Edit.
                Paste the Client Secret from your Spotify app. Make sure it matches exactly.
              </li>
            </ol>
          </>
        ) : (
          <p>{clerkError || "An unexpected error occurred during OAuth."}</p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <a
          href="https://developer.spotify.com/dashboard"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
          style={{ background: "rgba(29,185,84,0.12)", border: "1px solid rgba(29,185,84,0.3)", color: "#1db954" }}
        >
          Spotify Dashboard
          <ExternalLink size={12} />
        </a>
        <a
          href="https://dashboard.clerk.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium"
          style={{ background: "var(--bg-2)", border: "1px solid var(--border)", color: "var(--text-dim)" }}
        >
          Clerk Dashboard
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

export default function SSOCallback() {
  const { isLoaded: siLoaded, signIn, setActive: siSetActive } = useSignIn();
  const { isLoaded: suLoaded, signUp, setActive: suSetActive } = useSignUp();
  const router = useRouter();
  const done = useRef(false);
  const [view, setView] = useState<
    | { type: "loading" }
    | { type: "clerk_error"; code: string }
    | { type: "missing_requirements" }
    | { type: "unknown"; info: string }
    | { type: "error"; msg: string }
  >({ type: "loading" });

  useEffect(() => {
    if (!siLoaded || !suLoaded || done.current) return;
    done.current = true;

    const run = async () => {
      try {
        const siStatus = signIn?.status;
        const ffError = signIn?.firstFactorVerification?.error;
        const transferable =
          signIn?.firstFactorVerification?.status === "transferable";

        // Clerk returned an error during OAuth (wrong secret, bad redirect URI, etc.)
        if (ffError) {
          setView({ type: "clerk_error", code: ffError.code });
          return;
        }

        // Returning user — OAuth completed successfully
        if (siStatus === "complete") {
          await siSetActive!({ session: signIn!.createdSessionId });
          router.push("/connect");
          return;
        }

        // New Spotify user — transfer sign-in attempt to a sign-up
        if (transferable) {
          const res = await signUp!.create({ transfer: true });
          if (res.status === "complete") {
            await suSetActive!({ session: res.createdSessionId });
            router.push("/connect");
            return;
          }
          if (res.status === "missing_requirements") {
            setView({ type: "missing_requirements" });
            return;
          }
          throw new Error(`Unexpected sign-up status after transfer: ${res.status}`);
        }

        // Sign-up already complete (rare)
        if (signUp?.status === "complete") {
          await suSetActive!({ session: signUp!.createdSessionId });
          router.push("/connect");
          return;
        }

        // Nothing recognised — dump state for diagnosis
        setView({
          type: "unknown",
          info: JSON.stringify(
            {
              signIn: { status: siStatus ?? null, firstFactor: signIn?.firstFactorVerification ?? null },
              signUp: { status: signUp?.status ?? null },
              urlSearch: window.location.search.slice(0, 120),
            },
            null,
            2
          ),
        });
      } catch (err: unknown) {
        setView({ type: "error", msg: err instanceof Error ? err.message : String(err) });
      }
    };

    run();
  }, [siLoaded, suLoaded, signIn, signUp, siSetActive, suSetActive, router]);

  const goBack = () => router.push("/connect");

  // ── Render ────────────────────────────────────────────────────────────────

  if (view.type === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--background)" }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Connecting Spotify...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--background)" }}
    >
      <div className="w-full max-w-md flex flex-col items-center gap-4 text-center">
        {view.type === "clerk_error" && (
          <SpotifyFixGuide clerkError={view.code} />
        )}

        {view.type === "missing_requirements" && (
          <>
            <AlertCircle size={32} style={{ color: "#ff4444" }} />
            <h2 className="text-2xl font-bold">Email verification is still on</h2>
            <p className="text-sm" style={{ color: "#ff8080" }}>
              Go to{" "}
              <a href="https://dashboard.clerk.com" target="_blank" rel="noopener noreferrer" className="underline">
                Clerk Dashboard
              </a>{" "}
              → User &amp; Authentication → Email, Phone, Username → turn OFF
              &quot;Verify at sign-up&quot; and Password. Then try again.
            </p>
          </>
        )}

        {view.type === "unknown" && (
          <>
            <AlertCircle size={32} style={{ color: "#ff4444" }} />
            <h2 className="text-2xl font-bold">Unexpected auth state</h2>
            <pre
              className="text-xs text-left w-full p-3 rounded-lg overflow-auto max-h-56"
              style={{ background: "rgba(255,68,68,0.07)", border: "1px solid rgba(255,68,68,0.2)", color: "#ff8080", whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            >
              {view.info}
            </pre>
          </>
        )}

        {view.type === "error" && (
          <>
            <AlertCircle size={32} style={{ color: "#ff4444" }} />
            <h2 className="text-2xl font-bold">Connection failed</h2>
            <p className="text-sm" style={{ color: "#ff8080" }}>{view.msg}</p>
          </>
        )}

        <button
          onClick={goBack}
          className="mt-2 px-6 py-3 rounded-xl font-bold text-sm"
          style={{ background: "var(--green)", color: "#000" }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
