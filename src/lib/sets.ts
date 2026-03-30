import { DJSet, DJSetTrack } from "./types";
import { SpotifyTrack } from "./spotify";

const STORAGE_KEY = "dj_sets";

export function getSets(): DJSet[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function getSet(id: string): DJSet | undefined {
  return getSets().find((s) => s.id === id);
}

export function saveSet(set: DJSet): void {
  const sets = getSets().filter((s) => s.id !== set.id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...sets, set]));
}

export function deleteSet(id: string): void {
  const sets = getSets().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
}

export function createSet(name: string, description = ""): DJSet {
  return {
    id: crypto.randomUUID(),
    name,
    description,
    tracks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function spotifyTrackToDJSetTrack(track: SpotifyTrack): DJSetTrack {
  return {
    slotId: crypto.randomUUID(),
    id: track.id,
    uri: track.uri,
    name: track.name,
    artists: track.artists.map((a) => a.name),
    albumName: track.album.name,
    albumArt: track.album.images[0]?.url ?? "",
    durationMs: track.duration_ms,
    addedAt: new Date().toISOString(),
    isrc: track.external_ids?.isrc,
  };
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function totalDuration(tracks: DJSetTrack[]): string {
  const total = tracks.reduce((acc, t) => acc + t.durationMs, 0);
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function activeDurationMs(track: DJSetTrack): number {
  return Math.max(0, (track.outPoint ?? track.durationMs) - (track.inPoint ?? 0));
}

export function onAirDuration(tracks: DJSetTrack[]): string {
  const total = tracks.reduce((acc, t) => acc + activeDurationMs(t), 0);
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor((total % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function hasInOutPoints(tracks: DJSetTrack[]): boolean {
  return tracks.some((t) => t.inPoint !== undefined || t.outPoint !== undefined);
}
