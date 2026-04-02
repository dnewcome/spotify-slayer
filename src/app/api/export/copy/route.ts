import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { DJSet, TrackMetadata } from "@/lib/types";

const MUSIC_DIR = process.env.MUSIC_DIR ?? "";

// POST /api/export/copy
// body: { set: DJSet, library: Record<string, TrackMetadata>, destDir: string }
// Copies all set audio files to destDir (flat layout) and writes a relative m3u8.
// Skips files that already exist at the destination with the same size.
// Returns { copied, skipped, errors, m3uPath }.
export async function POST(req: NextRequest) {
  if (!MUSIC_DIR) {
    return NextResponse.json({ error: "MUSIC_DIR not set" }, { status: 500 });
  }

  const { set, library, destDir } = (await req.json()) as {
    set: DJSet;
    library: Record<string, TrackMetadata>;
    destDir: string;
  };

  if (!destDir) {
    return NextResponse.json({ error: "destDir required" }, { status: 400 });
  }

  const missing = set.tracks.filter((t) => !library[t.id]?.localPath);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "missing_tracks", tracks: missing.map((t) => t.name) },
      { status: 400 }
    );
  }

  await fs.mkdir(destDir, { recursive: true });

  let copied = 0;
  let skipped = 0;
  const errors: string[] = [];
  const m3uLines = ["#EXTM3U"];

  for (const track of set.tracks) {
    const meta = library[track.id];
    const filename = path.basename(meta.localPath!);
    const src = path.join(MUSIC_DIR, meta.localPath!);
    const dest = path.join(destDir, filename);

    try {
      // Skip if dest already exists with the same size
      let skip = false;
      try {
        const [srcStat, destStat] = await Promise.all([fs.stat(src), fs.stat(dest)]);
        if (srcStat.size === destStat.size) skip = true;
      } catch { /* dest doesn't exist */ }

      if (skip) {
        skipped++;
      } else {
        await fs.copyFile(src, dest);
        copied++;
      }
    } catch (err) {
      errors.push(`${filename}: ${String(err)}`);
    }

    const duration = Math.round(track.durationMs / 1000);
    m3uLines.push(`#EXTINF:${duration},${track.artists.join(", ")} - ${track.name}`);
    m3uLines.push(`./${filename}`);
  }

  // Write relative m3u8 alongside the audio files
  const safeSetName = set.name.replace(/[<>:"/\\|?*]/g, "").trim() || "set";
  const m3uPath = path.join(destDir, `${safeSetName}.m3u8`);
  await fs.writeFile(m3uPath, m3uLines.join("\n"), "utf8");

  return NextResponse.json({ copied, skipped, errors, m3uPath });
}
