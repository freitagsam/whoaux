"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";

export default function SSOCallback() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--background)" }}
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={28} className="animate-spin" style={{ color: "var(--text-muted)" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Connecting Spotify...</p>
      </div>
      {/*
        afterSignInUrl / afterSignUpUrl — where to land after successful auth
        continueSignUpUrl — where to go if sign-up still has pending steps
        signInUrl / signUpUrl — fallback if Clerk needs to restart the flow
        All pointing to /connect so the user always ends up in our app.
      */}
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
