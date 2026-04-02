import { DJSet, TrackMetadata } from "./types";

const FORMAT_VERSION = "1";

// Subset of TrackMetadata that is portable across machines.
// Machine-specific fields (localPath, acquisition/download state) are excluded.
export interface PortableTrackMetadata {
  spotifyId: string;
  isrc?: string;
  mbid?: string;
  mbEnriched?: boolean;
  energyLevel?: number;
  busyness?: number;
  tags?: string[];
  genre?: string[];
  bpm?: number;
  key?: string;
  notes?: string;
}

export interface DJSetExport {
  app: "spotify-slayer";
  version: string;
  exportedAt: string;
  set: DJSet;
  trackMetadata: Record<string, PortableTrackMetadata>;
}

function toPortable(meta: TrackMetadata): PortableTrackMetadata {
  return {
    spotifyId: meta.spotifyId,
    ...(meta.isrc !== undefined && { isrc: meta.isrc }),
    ...(meta.mbid !== undefined && { mbid: meta.mbid }),
    ...(meta.mbEnriched !== undefined && { mbEnriched: meta.mbEnriched }),
    ...(meta.energyLevel !== undefined && { energyLevel: meta.energyLevel }),
    ...(meta.busyness !== undefined && { busyness: meta.busyness }),
    ...(meta.tags !== undefined && { tags: meta.tags }),
    ...(meta.genre !== undefined && { genre: meta.genre }),
    ...(meta.bpm !== undefined && { bpm: meta.bpm }),
    ...(meta.key !== undefined && { key: meta.key }),
    ...(meta.notes !== undefined && { notes: meta.notes }),
  };
}

export function exportSetAsJson(
  set: DJSet,
  library: Record<string, TrackMetadata>
): void {
  const portableMeta: Record<string, PortableTrackMetadata> = {};
  for (const track of set.tracks) {
    const meta = library[track.id];
    if (meta) portableMeta[track.id] = toPortable(meta);
  }

  const payload: DJSetExport = {
    app: "spotify-slayer",
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    set,
    trackMetadata: portableMeta,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${set.name}.sslayer.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  set: DJSet;
  trackMetadata: Record<string, PortableTrackMetadata>;
}

export async function importSetFromJson(file: File): Promise<ImportResult> {
  const text = await file.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON file");
  }

  if (
    typeof payload !== "object" ||
    payload === null ||
    (payload as DJSetExport).app !== "spotify-slayer" ||
    !(payload as DJSetExport).set ||
    !(payload as DJSetExport).trackMetadata
  ) {
    throw new Error("Not a Spotify Slayer set file");
  }

  const { set, trackMetadata } = payload as DJSetExport;

  if (!set.id || !set.name || !Array.isArray(set.tracks)) {
    throw new Error("Malformed set data");
  }

  return { set, trackMetadata };
}
