export interface DJSet {
  id: string;
  name: string;
  description: string;
  tracks: DJSetTrack[];
  createdAt: string;
  updatedAt: string;
}

export interface DJSetTrack {
  slotId: string;   // unique per slot — use this for React keys and dnd-kit ids
  id: string;       // Spotify track ID — may repeat if same track added twice
  uri: string;
  name: string;
  artists: string[];
  albumName: string;
  albumArt: string;
  durationMs: number;
  addedAt: string;
  isrc?: string;
}

export interface TrackMetadata {
  spotifyId: string;
  isrc?: string;
  mbid?: string;
  mbEnriched?: boolean;   // true once enrichment has been attempted (success or fail)
  energyLevel?: number;   // 1–5: 1=ambient/sparse, 5=peak/banger
  busyness?: number;      // 1–5: 1=minimal space, 5=dense/complex
  tags?: string[];        // freeform: "floor filler", "transition", "opener", "vocal", etc.
  genre?: string[];       // seeded from MusicBrainz, user can override
  bpm?: number;
  key?: string;
  acquisitionStatus?: "want" | "acquired" | "skip";
  localPath?: string;
  notes?: string;
}
