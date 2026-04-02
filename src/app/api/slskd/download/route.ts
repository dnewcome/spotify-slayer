import { NextRequest, NextResponse } from "next/server";

const SLSKD_URL = process.env.SLSKD_URL ?? "http://localhost:5030";
const SLSKD_API_KEY = process.env.SLSKD_API_KEY ?? "";

// POST /api/slskd/download
// body: { username: string, filename: string, size: number }
// Enqueues a download on slskd. Returns { transferId, username }.
//
// slskd endpoint: POST /api/v0/transfers/downloads/{username}
// body: { filename, size }
export async function POST(req: NextRequest) {
  const { username, filename, size } = await req.json();
  if (!username || !filename || size == null) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const res = await fetch(
    `${SLSKD_URL}/api/v0/transfers/downloads/${encodeURIComponent(username)}`,
    {
      method: "POST",
      headers: { "X-API-Key": SLSKD_API_KEY, "Content-Type": "application/json" },
      // slskd expects an array of { filename, size }
      body: JSON.stringify([{ filename, size }]),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    console.error("[slskd/download] POST failed", res.status, body);
    return NextResponse.json({ error: "slskd_error", detail: body }, { status: 502 });
  }

  const data = await res.json();
  // response: { enqueued: [{ id, ... }], failed: [] }
  const transfer = data.enqueued?.[0];
  if (!transfer) {
    console.error("[slskd/download] nothing enqueued", data);
    return NextResponse.json({ error: "not_enqueued", detail: data.failed }, { status: 502 });
  }
  return NextResponse.json({ transferId: transfer.id, username });
}
