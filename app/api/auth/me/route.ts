import { NextRequest, NextResponse } from "next/server";
import { AuthUser } from "@/lib/use-auth";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const raw = request.cookies.get("sp_user")?.value;
  if (!raw) return NextResponse.json({ user: null });

  try {
    const user: AuthUser = JSON.parse(raw);
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null });
  }
}
