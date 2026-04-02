import { NextRequest, NextResponse } from "next/server";
import { SlskdResult } from "@/lib/types";

const SLSKD_URL = process.env.SLSKD_URL ?? "http://localhost:5030";
const SLSKD_API_KEY = process.env.SLSKD_API_KEY ?? "";

const AUDIO_EXTS = new Set([".flac", ".mp3", ".wav", ".aac", ".ogg", ".m4a", ".aiff", ".wv"]);

function formatFromFilename(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return ext.slice(1).toUpperCase(); // ".flac" → "FLAC"
}

function isAudio(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return AUDIO_EXTS.has(ext);
}

function sortResults(results: SlskdResult[]): SlskdResult[] {
  return [...results].sort((a, b) => {
    const af = a.format;
    const bf = b.format;
    // FLAC first (by size desc — proxy for quality since bitrate is null)
    if (af === "FLAC" && bf !== "FLAC") return -1;
    if (bf === "FLAC" && af !== "FLAC") return 1;
    if (af === "FLAC" && bf === "FLAC") return b.size - a.size;
    // MP3 next (by bitrate desc)
    if (af === "MP3" && bf !== "MP3") return -1;
    if (bf === "MP3" && af !== "MP3") return 1;
    if (af === "MP3" && bf === "MP3") return (b.bitRate ?? 0) - (a.bitRate ?? 0);
    // Everything else by size
    return b.size - a.size;
  });
}

// GET /api/slskd/search/[searchId]
// Polls slskd for search results. Returns { state, results: SlskdResult[], done: boolean }.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ searchId: string }> }
) {
  const { searchId } = await params;

  const res = await fetch(
    `${SLSKD_URL}/api/v0/searches/${encodeURIComponent(searchId)}?includeResponses=true`,
    { headers: { "X-API-Key": SLSKD_API_KEY } }
  );

  if (!res.ok) {
    console.error("[slskd/search/:id] GET failed", res.status);
    return NextResponse.json({ error: "slskd_error" }, { status: 502 });
  }

  const data = await res.json();
  const done: boolean = (data.state as string)?.startsWith("Completed") ?? false;

  // Flatten responses → files, filter to audio only
  const flat: SlskdResult[] = [];
  for (const response of data.responses ?? []) {
    for (const file of response.files ?? []) {
      if (!isAudio(file.filename)) continue;
      flat.push({
        username: response.username,
        filename: file.filename,
        size: file.size,
        bitRate: file.bitRate ?? null,
        format: formatFromFilename(file.filename),
      });
    }
  }

  return NextResponse.json({ state: data.state, results: sortResults(flat), done });
}
