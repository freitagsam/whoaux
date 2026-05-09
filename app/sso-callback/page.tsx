"use client";

import { useEffect, useRef, useState } from "react";
import { useSignIn, useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";

export default function SSOCallback() {
  const { isLoaded: siLoaded, signIn, setActive: siSetActive } = useSignIn();
  const { isLoaded: suLoaded, signUp, setActive: suSetActive } = useSignUp();
  const router = useRouter();
  const done = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siLoaded || !suLoaded || done.current) return;
    done.current = true;

    const run = async () => {
      try {
        const siStatus = signIn?.status;
        const transferable =
          signIn?.firstFactorVerification?.status === "transferable";

        // ── returning user ──────────────────────────────────────────────
        if (siStatus === "complete") {
          await siSetActive!({ session: signIn!.createdSessionId });
          router.push("/connect");
          return;
        }

        // ── new Spotify user (needs to be converted to a sign-up) ───────
        if (transferable) {
          const res = await signUp!.create({ transfer: true });
          if (res.status === "complete") {
            await suSetActive!({ session: res.createdSessionId });
            router.push("/connect");
            return;
          }
          if (res.status === "missing_requirements") {
            setError(
              "Sign-up has missing requirements.\n\n" +
                "Fix in Clerk Dashboard → User & Authentication → " +
                "Email, Phone, Username:\n" +
                "• Turn OFF 'Verify at sign-up'\n" +
                "• Turn OFF 'Password'\n" +
                "Then try again."
            );
            return;
          }
          throw new Error(`Unexpected sign-up status after transfer: ${res.status}`);
        }

        // ── sign-up already complete (rare path) ────────────────────────
        if (signUp?.status === "complete") {
          await suSetActive!({ session: signUp!.createdSessionId });
          router.push("/connect");
          return;
        }

        // ── nothing recognised — show debug info ────────────────────────
        setError(
          "Auth state not recognised after OAuth redirect.\n\n" +
            JSON.stringify(
              {
                signIn: {
                  status: siStatus ?? null,
                  firstFactor: signIn?.firstFactorVerification ?? null,
                },
                signUp: { status: signUp?.status ?? null },
                urlSearch: window.location.search.slice(0, 120),
                urlHash: window.location.hash.slice(0, 60),
              },
              null,
              2
            )
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || "Authentication failed — check the error above and try again.");
      }
    };

    run();
  }, [siLoaded, suLoaded, signIn, signUp, siSetActive, suSetActive, router]);

  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-6"
        style={{ background: "var(--background)" }}
      >
        <div className="flex flex-col items-center gap-4 w-full max-w-md text-center">
          <AlertCircle size={32} style={{ color: "#ff4444" }} />
          <h2 className="text-2xl font-bold">Connection failed</h2>
          <pre
            className="text-xs text-left w-full p-3 rounded-lg overflow-auto max-h-56"
            style={{
              background: "rgba(255,68,68,0.07)",
              border: "1px solid rgba(255,68,68,0.2)",
              color: "#ff8080",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {error}
          </pre>
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
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Connecting Spotify...
        </p>
      </div>
    </div>
  );
}
