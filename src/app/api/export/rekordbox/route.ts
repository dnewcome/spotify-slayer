import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { DJSet, TrackMetadata } from "@/lib/types";

const MUSIC_DIR = process.env.MUSIC_DIR ?? "";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function msToSec(ms: number): string {
  return (ms / 1000).toFixed(3);
}

function toFileUrl(absPath: string): string {
  // Encode spaces and percent signs; keep slashes intact
  const encoded = absPath.replace(/%/g, "%25").replace(/ /g, "%20");
  return `file://localhost${encoded}`;
}

// POST /api/export/rekordbox
// body: { set: DJSet, library: Record<string, TrackMetadata> }
// Returns a rekordbox XML file with COLLECTION + PLAYLIST entries.
// Includes in/out cue points as memory cues.
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

  const entries = set.tracks.map((track, i) => {
    const meta = library[track.id];
    const trackId = i + 1;
    const totalTime = Math.round(track.durationMs / 1000);
    const location = toFileUrl(path.join(MUSIC_DIR, meta.localPath!));
    const cues: string[] = [];

    if (track.inPoint != null) {
      cues.push(
        `      <POSITION_MARK Name="in" Type="0" Start="${msToSec(track.inPoint)}" Num="-1" Red="255" Green="165" Blue="0"/>`
      );
    }
    if (track.outPoint != null) {
      cues.push(
        `      <POSITION_MARK Name="out" Type="0" Start="${msToSec(track.outPoint)}" Num="-1" Red="255" Green="0" Blue="0"/>`
      );
    }

    const inner = cues.length > 0 ? `\n${cues.join("\n")}\n    </TRACK>` : `/>`;
    const openTag = cues.length > 0 ? `>` : ``;

    return (
      `    <TRACK TrackID="${trackId}"` +
      ` Name="${xmlEscape(track.name)}"` +
      ` Artist="${xmlEscape(track.artists.join(", "))}"` +
      ` Album="${xmlEscape(track.albumName)}"` +
      ` TotalTime="${totalTime}"` +
      ` Location="${xmlEscape(location)}"` +
      ` AverageBpm="0.00"` +
      ` DateAdded="${new Date().toISOString().slice(0, 10)}"` +
      ` BitRate="0" SampleRate="44100" Comments="" PlayCount="0" Rating="0"` +
      openTag +
      inner
    );
  });

  const playlistTracks = set.tracks
    .map((_, i) => `        <TRACK Key="${i + 1}"/>`)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DJ_PLAYLISTS Version="1.0.0">
  <PRODUCT Name="rekordbox" Version="6.0.0" Company="AlphaTheta"/>
  <COLLECTION Entries="${set.tracks.length}">
${entries.join("\n")}
  </COLLECTION>
  <PLAYLISTS>
    <NODE Type="0" Name="ROOT" Count="1">
      <NODE Name="${xmlEscape(set.name)}" Type="1" KeyType="0" Entries="${set.tracks.length}">
${playlistTracks}
      </NODE>
    </NODE>
  </PLAYLISTS>
</DJ_PLAYLISTS>`;

  const filename = set.name.replace(/[<>:"/\\|?*]/g, "").trim() || "set";
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.xml"`,
    },
  });
}
