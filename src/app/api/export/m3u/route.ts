import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { DJSet, TrackMetadata } from "@/lib/types";

const MUSIC_DIR = process.env.MUSIC_DIR ?? "";

// POST /api/export/m3u
// body: { set: DJSet, library: Record<string, TrackMetadata> }
// Returns an extended m3u8 playlist with absolute paths to MUSIC_DIR files.
export async function POST(req: NextRequest) {
  if (!MUSIC_DIR) {
    return NextResponse.json({ error: "MUSIC_DIR not set" }, { status: 500 });
  }

  const { set, library } = (await req.json()) as {
    set: DJSet;
    library: Record<string, TrackMetadata>;
  };

  const missing = set.tracks.filter((t) => !library[t.id]?.localPath);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "missing_tracks", tracks: missing.map((t) => t.name) },
      { status: 400 }
    );
  }

  const lines = ["#EXTM3U"];
  for (const track of set.tracks) {
    const meta = library[track.id];
    const duration = Math.round(track.durationMs / 1000);
    const absPath = path.join(MUSIC_DIR, meta.localPath!);
    lines.push(`#EXTINF:${duration},${track.artists.join(", ")} - ${track.name}`);
    lines.push(absPath);
  }

  const filename = set.name.replace(/[<>:"/\\|?*]/g, "").trim() || "set";
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "audio/x-mpegurl; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.m3u8"`,
    },
  });
}
