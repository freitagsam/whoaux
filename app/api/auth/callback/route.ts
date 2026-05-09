import { NextRequest, NextResponse } from "next/server";
import { setAuthCookies } from "@/lib/spotify-auth";

export const dynamic = "force-dynamic";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;

interface SpotifyTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface SpotifyProfile {
  id: string;
  display_name: string;
  images: Array<{ url: string }>;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Spotify denied access
  if (error) {
    return NextResponse.redirect(`${origin}/connect?error=${encodeURIComponent(error)}`);
  }

  // Validate state to prevent CSRF
  const expectedState = request.cookies.get("sp_state")?.value;
  if (!state || state !== expectedState) {
    return NextResponse.redirect(`${origin}/connect?error=invalid_state`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/connect?error=no_code`);
  }

  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ?? `${origin}/api/auth/callback`;

  try {
    // Exchange code for tokens
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
      cache: "no-store",
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => "");
      console.error("[auth/callback] Token exchange failed:", tokenRes.status, body);
      return NextResponse.redirect(`${origin}/connect?error=token_exchange_failed`);
    }

    const tokens: SpotifyTokenResponse = await tokenRes.json();

    // Fetch user profile
    const profileRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      cache: "no-store",
    });

    let user = { id: "unknown", displayName: "Spotify User", image: undefined as string | undefined };
    if (profileRes.ok) {
      const profile: SpotifyProfile = await profileRes.json();
      user = {
        id: profile.id,
        displayName: profile.display_name ?? "Spotify User",
        image: profile.images?.[0]?.url,
      };
    }

    const response = NextResponse.redirect(`${origin}/connect`);

    // Clear the state cookie
    response.cookies.set("sp_state", "", { path: "/", maxAge: 0 });

    // Set auth cookies
    setAuthCookies(
      response,
      { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresIn: tokens.expires_in },
      user
    );

    return response;
  } catch (err) {
    console.error("[auth/callback] Unexpected error:", err);
    return NextResponse.redirect(`${origin}/connect?error=unexpected`);
  }
}
