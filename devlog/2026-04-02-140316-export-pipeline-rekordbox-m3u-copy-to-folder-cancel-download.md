# Export pipeline: rekordbox XML, m3u8, copy-to-folder, cancel download

_2026-04-02_

## What happened

Closed the loop between "file on disk" and "file on a USB stick I can take to a gig." The export side turned out to be straightforward once the data model was clean — in/out points map directly to rekordbox `POSITION_MARK` elements in milliseconds, so cue points come along for free without any extra work. The more interesting design problem was the USB portability question: rekordbox XML needs absolute paths (so rekordbox can find the files at import time), but Traktor needs relative paths (so the playlist works from any mount point). The answer is to generate both at copy time, which means the same USB folder can have rekordbox's PIONEER/ database written on top of it later without conflict. Also added cancel on stuck downloads — slskd "Queued, Remotely" looks identical to 0% progress, so the UI now shows "queued…" and a hover-to-cancel × instead of a frozen progress bar.

## Files touched

  - src/app/api/export/rekordbox/route.ts (new)
  - src/app/api/export/m3u/route.ts (new)
  - src/app/api/export/copy/route.ts (new)
  - src/app/api/library/normalize/route.ts (new)
  - src/app/api/slskd/transfer/[transferId]/route.ts
  - src/app/sets/[id]/page.tsx
  - src/lib/types.ts
  - PLAN.md
  - README.md

## Tweet draft

DJ prep tool update: after downloading FLACs from Soulseek, you can now export to rekordbox XML (with in/out cue points), copy everything to a USB with a relative m3u8 for Traktor, or both. One USB, two workflows. The cue points were basically free — milliseconds straight from the data model into POSITION_MARK. [link]

---

_commit: 8232729 · screenshot: none_
