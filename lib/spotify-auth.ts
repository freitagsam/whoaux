import { NextRequest, NextResponse } from "next/server";

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;

const SECURE = process.env.NODE_ENV === "production";

const COOKIE_OPTS = {
  access: { httpOnly: true, path: "/", sameSite: "lax" as const, secure: SECURE, maxAge: 3600 },
  refresh: { httpOnly: true, path: "/", sameSite: "lax" as const, secure: SECURE, maxAge: 60 * 60 * 24 * 30 },
  exp: { httpOnly: true, path: "/", sameSite: "lax" as const, secure: SECURE, maxAge: 3600 },
  user: { httpOnly: true, path: "/", sameSite: "lax" as const, secure: SECURE, maxAge: 60 * 60 * 24 * 30 },
};

async function doRefresh(refreshToken: string) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;
}

export interface TokenResult {
  token: string | null;
  errorResponse: NextResponse | null;
  // Call this on the NextResponse you return so refreshed tokens are persisted
  setCookies: (response: NextResponse) => void;
}

export async function getSpotifyToken(request: NextRequest): Promise<TokenResult> {
  const access = request.cookies.get("sp_access")?.value ?? null;
  const rt = request.cookies.get("sp_refresh")?.value ?? null;
  const exp = Number(request.cookies.get("sp_exp")?.value ?? 0);

  const noop = (_r: NextResponse) => {};

  if (!rt) {
    return { token: null, errorResponse: NextResponse.json({ error: "Not signed in" }, { status: 401 }), setCookies: noop };
  }

  // Token valid for at least another minute
  if (access && exp > Date.now() + 60_000) {
    return { token: access, errorResponse: null, setCookies: noop };
  }

  // Refresh
  const data = await doRefresh(rt);
  if (!data) {
    return {
      token: null,
      errorResponse: NextResponse.json({ error: "Session expired — please sign in again." }, { status: 401 }),
      setCookies: noop,
    };
  }

  const newAccess = data.access_token;
  const newRt = data.refresh_token ?? rt;
  const newExp = Date.now() + data.expires_in * 1000;

  const setCookies = (response: NextResponse) => {
    response.cookies.set("sp_access", newAccess, COOKIE_OPTS.access);
    response.cookies.set("sp_exp", String(newExp), COOKIE_OPTS.exp);
    response.cookies.set("sp_refresh", newRt, COOKIE_OPTS.refresh);
  };

  return { token: newAccess, errorResponse: null, setCookies };
}

export function setAuthCookies(
  response: NextResponse,
  tokens: { accessToken: string; refreshToken: string; expiresIn: number },
  user: { id: string; displayName: string; image?: string }
) {
  response.cookies.set("sp_access", tokens.accessToken, COOKIE_OPTS.access);
  response.cookies.set("sp_refresh", tokens.refreshToken, COOKIE_OPTS.refresh);
  response.cookies.set("sp_exp", String(Date.now() + tokens.expiresIn * 1000), COOKIE_OPTS.exp);
  response.cookies.set("sp_user", JSON.stringify(user), COOKIE_OPTS.user);
}

export function clearAuthCookies(response: NextResponse) {
  for (const name of ["sp_access", "sp_refresh", "sp_exp", "sp_user", "sp_state"]) {
    response.cookies.set(name, "", { path: "/", maxAge: 0 });
  }
}
