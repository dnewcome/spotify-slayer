import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const SLSKD_DOWNLOADS_DIR = process.env.SLSKD_DOWNLOADS_DIR ?? "";
const MUSIC_DIR = process.env.MUSIC_DIR ?? "";

// POST /api/library/normalize
// body: { slskdFilename, artist, title, isrc? }
// Moves the downloaded file from slskd's downloads dir to MUSIC_DIR with a
// normalized filename ("Artist - Title.ext"), embeds tags via ffmpeg, and
// returns { localPath } relative to MUSIC_DIR.
export async function POST(req: NextRequest) {
  if (!SLSKD_DOWNLOADS_DIR || !MUSIC_DIR) {
    return NextResponse.json(
      { error: "SLSKD_DOWNLOADS_DIR and MUSIC_DIR must be set in .env" },
      { status: 500 }
    );
  }

  const { slskdFilename, artist, title, isrc } = await req.json() as {
    slskdFilename: string;
    artist: string;
    title: string;
    isrc?: string;
  };

  if (!slskdFilename || !artist || !title) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Derive local path from slskd's Windows-style remote path.
  // slskd mirrors the last two components: parent_dir/filename
  const parts = slskdFilename.split(/[/\\]/).filter(Boolean);
  const localRelative = parts.length >= 2
    ? path.join(parts[parts.length - 2], parts[parts.length - 1])
    : parts[parts.length - 1];
  const sourcePath = path.join(SLSKD_DOWNLOADS_DIR, localRelative);

  try {
    await fs.access(sourcePath);
  } catch {
    return NextResponse.json(
      { error: "source_not_found", path: sourcePath },
      { status: 404 }
    );
  }

  const ext = path.extname(sourcePath).toLowerCase(); // .flac, .mp3, .wav
  const sanitize = (s: string) =>
    s.replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, " ").trim();

  const baseName = `${sanitize(artist)} - ${sanitize(title)}${ext}`;
  let destPath = path.join(MUSIC_DIR, baseName);

  // Collision: if dest already exists, check if it's the same source (already normalized)
  let destExists = false;
  try {
    await fs.access(destPath);
    destExists = true;
  } catch { /* does not exist */ }

  if (destExists) {
    // Check if it's literally the same file (already normalized on a previous run)
    const [srcStat, dstStat] = await Promise.all([
      fs.stat(sourcePath),
      fs.stat(destPath),
    ]);
    if (srcStat.ino === dstStat.ino) {
      // Same inode — already in place
      return NextResponse.json({ localPath: baseName });
    }
    // Different file with same name — use ISRC suffix as tiebreaker
    if (isrc) {
      const tiebreaker = `${sanitize(artist)} - ${sanitize(title)} (${isrc})${ext}`;
      destPath = path.join(MUSIC_DIR, tiebreaker);
    } else {
      // No ISRC — skip normalization, return existing path
      console.warn(`[normalize] collision with no ISRC: ${baseName} — keeping existing`);
      return NextResponse.json({ localPath: baseName });
    }
  }

  await fs.mkdir(MUSIC_DIR, { recursive: true });

  // Use ffmpeg to copy audio stream and embed metadata tags.
  // -c copy: no re-encode. Tags: title, artist, ISRC (maps to TSRC in MP3, vorbis comment in FLAC).
  // -y: overwrite dest if it somehow exists. -loglevel error: suppress progress spam.
  const ffmpegArgs = [
    "-i", sourcePath,
    "-c", "copy",
    "-metadata", `title=${title}`,
    "-metadata", `artist=${artist}`,
    ...(isrc ? ["-metadata", `ISRC=${isrc}`] : []),
    "-y",
    "-loglevel", "error",
    destPath,
  ];

  try {
    await execFileAsync("ffmpeg", ffmpegArgs);
  } catch (err) {
    console.error("[normalize] ffmpeg failed", err);
    return NextResponse.json({ error: "ffmpeg_failed", detail: String(err) }, { status: 500 });
  }

  // Remove the original from slskd's downloads dir
  await fs.rm(sourcePath, { force: true });
  // Try to remove the parent dir if empty
  try {
    await fs.rmdir(path.dirname(sourcePath));
  } catch { /* not empty or already gone — ignore */ }

  const localPath = path.basename(destPath);
  console.log(`[normalize] ${localRelative} → ${localPath}`);
  return NextResponse.json({ localPath });
}
