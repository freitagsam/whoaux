import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const SCOPES = [
  "user-library-read",
  "user-read-recently-played",
  "playlist-read-private",
  "user-top-read",
  "user-read-private",
  "user-read-email",
].join(" ");

export function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ?? `${origin}/api/auth/callback`;

  const state = crypto.randomBytes(16).toString("hex");

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    scope: SCOPES,
  });

  const response = NextResponse.redirect(
    `https://accounts.spotify.com/authorize?${params.toString()}`
  );

  // Store state for CSRF check in callback
  response.cookies.set("sp_state", state, {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 minutes
  });

  return response;
}
