# Spotify Web Playback SDK: embedded player with cue point auto-advance

_2026-04-02_

## What happened

Got the Spotify Web Playback SDK running inside the set builder — you can now click play on any track in the list and it picks up from the in point. The nastiest bug was a 404 "Device not found" on the first play command: the SDK fires `ready` with a device ID before Spotify's backend has actually registered it, so the fix was to transfer playback to the device immediately and wait for that to confirm before marking the player ready. The auto-advance was the more interesting problem — a `setInterval` at 500ms polls the current position and triggers the next track when the out point is hit, but intervals capture stale state via closure, so everything the callback needs lives in refs that stay current. The result is a working DJ tool loop: play a track, listen, tap `[in` and `out]` to set cue points in real time, and the set runs itself from there.

## Files touched

  - src/lib/useSpotifyPlayer.ts (new)
  - src/types/spotify-sdk.d.ts (new)
  - src/app/sets/[id]/page.tsx
  - src/lib/auth.ts

## Screenshot

![set builder with player bar](assets/2026-04-02-014356-add-local-file-storage-architecture-plan-file-se.png)

## Tweet draft

Added a real player to my DJ set builder — plays from Spotify directly in the browser, no app switching. Hit [in and out] while a track plays to set cue points, then when the out point hits it automatically starts the next track from its in point. Whole set runs itself. [link]

---

_commit: 8d3b65d_
