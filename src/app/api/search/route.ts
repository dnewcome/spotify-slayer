import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { searchTracks } from "@/lib/spotify";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ tracks: [] });
  try {
    const tracks = await searchTracks(session.accessToken, q);
    return NextResponse.json({ tracks });
  } catch (e) {
    console.error("[search]", e);
    return NextResponse.json({ error: "search_failed", tracks: [] }, { status: 500 });
  }
}
