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
  // Helps debug auth errors in development
  debug: process.env.NODE_ENV === "development",
};
