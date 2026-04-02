import { NextRequest, NextResponse } from "next/server";

const SLSKD_URL = process.env.SLSKD_URL ?? "http://localhost:5030";
const SLSKD_API_KEY = process.env.SLSKD_API_KEY ?? "";

function slskdHeaders() {
  return { "X-API-Key": SLSKD_API_KEY, "Content-Type": "application/json" };
}

// POST /api/slskd/search
// body: { artist: string, title: string }
// Starts a slskd search and returns { searchId }.
export async function POST(req: NextRequest) {
  const { artist, title } = await req.json();
  if (!artist || !title) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const searchText = `${artist} ${title}`;

  const res = await fetch(`${SLSKD_URL}/api/v0/searches`, {
    method: "POST",
    headers: slskdHeaders(),
    body: JSON.stringify({
      searchText,
      fileLimit: 100,
      responseLimit: 20,
      searchTimeout: 10000,
    }),
  });

  if (!res.ok) {
    console.error("[slskd/search] POST failed", res.status, await res.text());
    return NextResponse.json({ error: "slskd_error" }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json({ searchId: data.id });
}
