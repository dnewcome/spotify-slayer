import { NextRequest, NextResponse } from "next/server";

const SLSKD_URL = process.env.SLSKD_URL ?? "http://localhost:5030";
const SLSKD_API_KEY = process.env.SLSKD_API_KEY ?? "";

// GET /api/slskd/transfer/[transferId]?username=...
// Polls slskd for transfer status.
// Returns { state, rawState, bytesTransferred, size, filename, progress }.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ transferId: string }> }
) {
  const { transferId } = await params;
  const username = req.nextUrl.searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "missing_username" }, { status: 400 });
  }

  const res = await fetch(
    `${SLSKD_URL}/api/v0/transfers/downloads/${encodeURIComponent(username)}`,
    { headers: { "X-API-Key": SLSKD_API_KEY } }
  );

  if (!res.ok) {
    console.error("[slskd/transfer/:id] GET failed", res.status);
    return NextResponse.json({ error: "slskd_error" }, { status: 502 });
  }

  // Response shape: { username, directories: [{ files: [{ id, state, ... }] }] }
  const data = await res.json();
  const files = (data.directories ?? []).flatMap(
    (d: { files: unknown[] }) => d.files ?? []
  ) as Array<{
    id: string;
    state: string;
    bytesTransferred: number;
    size: number;
    filename: string;
  }>;

  const transfer = files.find((f) => f.id === transferId);
  if (!transfer) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const progress =
    transfer.size > 0 ? Math.round((transfer.bytesTransferred / transfer.size) * 100) : 0;

  // State can be "Completed, Succeeded", "Errored, ...", etc. — use startsWith
  const state = transfer.state as string;
  const normalizedState = state.startsWith("Completed") ? "Completed"
    : state.startsWith("Errored") ? "Errored"
    : state.startsWith("Cancelled") ? "Cancelled"
    : state;

  return NextResponse.json({
    state: normalizedState,
    rawState: transfer.state,
    bytesTransferred: transfer.bytesTransferred,
    size: transfer.size,
    filename: transfer.filename,
    progress,
  });
}

// DELETE /api/slskd/transfer/[transferId]?username=...
// Cancels an in-progress or queued download.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ transferId: string }> }
) {
  const { transferId } = await params;
  const username = req.nextUrl.searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "missing_username" }, { status: 400 });
  }

  const res = await fetch(
    `${SLSKD_URL}/api/v0/transfers/downloads/${encodeURIComponent(username)}/${encodeURIComponent(transferId)}`,
    { method: "DELETE", headers: { "X-API-Key": SLSKD_API_KEY } }
  );

  if (!res.ok && res.status !== 404) {
    console.error("[slskd/transfer/:id] DELETE failed", res.status);
    return NextResponse.json({ error: "slskd_error" }, { status: 502 });
  }

  return new NextResponse(null, { status: 204 });
}
