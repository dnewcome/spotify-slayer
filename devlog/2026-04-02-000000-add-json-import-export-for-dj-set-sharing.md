# JSON import/export for sharing DJ sets

_2026-04-02_

## What happened

The other export formats — rekordbox XML and m3u8 — are machine-local: they embed absolute file paths and require every track to be downloaded before they'll generate. That's fine for loading a USB stick, but useless for handing a set to another Spotify Slayer user. Added a `.sslayer.json` format that captures everything portable: the full set structure with in/out points, plus the metadata that took effort to build up — energy, busyness, tags, genre, BPM, key, notes. Machine-specific fields (localPath, download state, slskd transfer IDs) are intentionally stripped. The import side merges non-destructively: if you already have metadata for a track, your values win; the imported values only fill gaps. ID collision handling is included — if the incoming set has the same UUID as one you already own, it gets a fresh ID rather than silently overwriting your work.

## Files touched

  - src/lib/importExport.ts (new)
  - src/app/sets/[id]/page.tsx
  - src/app/sets/page.tsx

## Tweet draft

Added a native JSON export format to my Spotify DJ set builder — `.sslayer.json` captures the full set with in/out cue points and all the energy/genre metadata, stripped of machine-specific paths. Import merges non-destructively. Now you can hand a fully-tagged set to another user without either of you needing to re-tag everything. [link]

---

_commit: pending_
