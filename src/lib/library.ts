import { TrackMetadata } from "./types";

const LIBRARY_KEY = "track_library";

type Library = Record<string, TrackMetadata>;

function getLibrary(): Library {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function getTrackMeta(id: string): TrackMetadata | undefined {
  return getLibrary()[id];
}

export function setTrackMeta(id: string, patch: Partial<TrackMetadata>): void {
  const lib = getLibrary();
  lib[id] = { ...lib[id], ...patch, spotifyId: id };
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib));
}

export function getAllTrackMeta(): Library {
  return getLibrary();
}
