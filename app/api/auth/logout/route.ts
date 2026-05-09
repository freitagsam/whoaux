import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/spotify-auth";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(`${origin}/`);
  clearAuthCookies(response);
  return response;
}
