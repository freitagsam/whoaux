import { NextAuthOptions } from "next-auth";
import SpotifyProvider from "next-auth/providers/spotify";

export const SPOTIFY_SCOPES = [
  "user-top-read",
  "user-library-read",
  "user-read-recently-played",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-email",
  "user-read-private",
].join(" ");

// Spotify's userinfo endpoint with retry on 429.
// NextAuth calls this during OAuth callback with no retry — one 429 kills login.
async function fetchSpotifyProfile(accessToken: string): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "3", 10);
      console.warn(`[auth] Spotify userinfo 429 — waiting ${retryAfter}s (attempt ${attempt + 1})`);
      await new Promise((r) => setTimeout(r, (retryAfter + 1) * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`Spotify /me returned ${res.status}`);
    return res.json();
  }
  throw new Error("Spotify is rate-limiting sign-in — please try again in 30 seconds.");
}

async function refreshAccessToken(token: {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  error?: string;
}) {
  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refresh_token ?? "",
      }),
    });

    const refreshed = await response.json();
    if (!response.ok) throw new Error(refreshed.error ?? "Refresh failed");

    return {
      ...token,
      access_token: refreshed.access_token,
      expires_at: Math.floor(Date.now() / 1000 + refreshed.expires_in),
      refresh_token: refreshed.refresh_token ?? token.refresh_token,
      error: undefined,
    };
  } catch (e) {
    console.error("Token refresh failed:", e);
    return { ...token, error: "RefreshAccessTokenError" as const };
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    SpotifyProvider({
      clientId: process.env.SPOTIFY_CLIENT_ID!,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
      authorization: {
        params: { scope: SPOTIFY_SCOPES },
      },
      userinfo: {
        url: "https://api.spotify.com/v1/me",
        async request({ tokens }) {
          return fetchSpotifyProfile(tokens.access_token as string);
        },
      },
      profile(profile) {
        return {
          id: profile.id as string,
          name: (profile.display_name as string) ?? (profile.id as string),
          email: profile.email as string,
          image: (profile.images as Array<{ url: string }>)?.[0]?.url ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      // First sign-in — store tokens and user profile
      if (account && user) {
        token.name = user.name ?? token.name;
        token.email = user.email ?? token.email;
        token.picture = user.image ?? undefined;
        token.access_token = account.access_token;
        token.expires_at = account.expires_at;
        token.refresh_token = account.refresh_token;
        return token;
      }
      // Token still valid
      if (Date.now() < (token.expires_at ?? 0) * 1000) {
        return token;
      }
      // Token expired — try to refresh
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      // Pass access token and any error down to the client session
      session.accessToken = token.access_token;
      session.error = token.error;
      // Ensure user fields come from the JWT, not just the default provider
      if (token.name) session.user.name = token.name as string;
      if (token.email) session.user.email = token.email as string;
      if (token.picture) session.user.image = token.picture as string;
      return session;
    },
  },
  pages: {
    signIn: "/connect",
    error: "/connect",
  },
  debug: process.env.NODE_ENV === "development",
};
