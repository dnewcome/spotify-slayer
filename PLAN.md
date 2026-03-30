# Spotify Slayer — Plan

## Current State

Working Next.js app with Spotify OAuth. Users can browse playlists, view tracks, and build DJ sets stored in localStorage. Auth, playlist browsing, track listing, set CRUD, and drag-and-drop reordering are fully functional.

### Existing files
- `src/lib/types.ts` — `DJSet`, `DJSetTrack`
- `src/lib/sets.ts` — localStorage CRUD for sets, `spotifyTrackToDJSetTrack`, duration helpers
- `src/lib/spotify.ts` — Spotify API wrapper, `SpotifyTrack`, `SpotifyPlaylist` types
- `src/lib/auth.ts` — NextAuth config
- `src/app/sets/[id]/page.tsx` — set builder with dnd-kit drag-and-drop
- `src/app/sets/page.tsx` — set list management
- `src/app/playlists/[id]/PlaylistDetail.tsx` — playlist view with "Add to set" button
- `src/components/AddToSetModal.tsx` — modal to pick which set to add a track to
- `src/components/TrackRow.tsx` — reusable track row component

---

## Spotify API Notes (February 2026 Breaking Changes)

- `/v1/playlists/{id}/tracks` → deprecated, use `/v1/playlists/{id}/items`
- Playlist item objects now use key `item` instead of `track`
- Simplified playlist objects from `/me/playlists` now use `items: { total }` instead of `tracks: { total }`
- Audio features endpoint (BPM, key, energy) — deprecated, no replacement via Web API
- Recommendations endpoint — deprecated
- `localhost` redirect URIs rejected as "Insecure" — must use `http://127.0.0.1`

---

## Core Workflow This App Solves

The user's DJ prep workflow today:
1. Browse Spotify artist radio / channels to discover tracks
2. Try to add to a playlist — Spotify's UI defaults to "Liked Songs", wrong destination frequently
3. After discovery, manually hunt each track on Soulseek to acquire the file
4. No way to track energy level, role, or genre per track
5. No structured way to build set arc (warm up → build → peak → come down)

This app owns all five of those steps.

---

## Feature Roadmap

### Phase 1 — Active Set Builder ✓ (mostly done)
- Set list management (create, rename, delete) ✓
- Add tracks from playlists via modal ✓
- Drag-and-drop reorder ✓
- Total duration display ✓
- Import / export set as JSON (todo)
- Export as Spotify playlist (todo — API already wired)
- Export as plain text tracklist (todo)

### Phase 2 — Track Library, Metadata & Visualization (next)

See detailed implementation plan below.

### Phase 2.5 — Cue Points & Track EDL

Each track in a set can have a list of cue points stored in its `TrackMetadata`. Cue points
mark specific moments in the track (by milliseconds from the start) and are displayed as a
thin horizontal waveform-style bar on the track row — an EDL (Edit Decision List) view.

**Cue point types:**

| Type | Description |
|------|-------------|
| `in` | Where this track enters the mix — the actual playback start point |
| `out` | Where this track exits — the end of its role in the set |
| `drop` | Notable energy moment, breakdown, or section change worth remembering |
| `info` | Freeform annotation — key change, vocal, build, etc. |
| `loop` | A loopable section |
| `megamix` | Overlap region where a second track plays simultaneously (mashup/megamix) |

**Data model addition to `TrackMetadata`:**
```ts
export interface CuePoint {
  id: string;           // UUID
  type: "in" | "out" | "drop" | "info" | "loop" | "megamix";
  positionMs: number;   // offset from track start
  label?: string;       // optional freeform note
  linkedSlotId?: string; // for megamix: the other track's slotId in the set
}
```

**UI: Track EDL bar**

A narrow horizontal bar (12–16px tall) under the track title, spanning the full row width.
The bar represents the full track duration. Cue point markers are vertical lines or small
triangles at the proportional position. Color-coded by type:

- `in` / `out` — white brackets at the edges of the "active region"; the space between them
  is tinted to show the portion of the track actually used in the set
- `drop` — yellow tick mark
- `info` — gray tick with tooltip label
- `loop` — blue region
- `megamix` — purple region, with a small reference to the linked track

The in/out region shading also feeds back into the arc bar — block width should eventually
reflect the `out - in` duration rather than the full track duration.

**Megamix / mashup sections:**

Two tracks with overlapping `megamix` cue regions and `linkedSlotId` pointing at each other.
In the arc bar, the overlap region could show a blended or striped color from both tracks.
In a future export, the EDL data could drive a real edit (e.g., passed to a DAW or to a
`ffmpeg` concat manifest).

**Input method:**

Cue points are entered manually (type + time). Time input accepts either `mm:ss` or raw
seconds. No audio playback in-app for v1 — user references the track in Spotify or their
DAW, then records the timestamp here. A "preview in Spotify" deep link (`spotify:track:id`)
can open the track at the right position if the Spotify client supports it.

**Phase ordering note:** This can be added incrementally — start with just `in`/`out`
markers and the tinted active region, then add other types.

---

### Phase 2.6 — Transition Recording & Mix Match Score

No live player in this app — the idea is to record transition data *while practicing* in
your real DJ setup (hardware mixer, controller, or DAW), then import or manually annotate
it here. Over time, the app builds up a library of "how well does track A mix into track B"
data that can inform set planning.

**What a transition is:**

A transition connects the `out` cue of one track to the `in` cue of the next. It has a
duration (overlap length) and optionally recorded automation — the sequence of EQ and fader
moves made during the mix.

```ts
export interface TransitionAutomation {
  timeMs: number;       // offset from transition start
  channel: "fader_a" | "fader_b" | "crossfader" | "eq_hi_a" | "eq_mid_a" | "eq_lo_a"
          | "eq_hi_b" | "eq_mid_b" | "eq_lo_b" | "filter_a" | "filter_b";
  value: number;        // 0.0–1.0 normalized
}

export interface Transition {
  id: string;
  fromSlotId: string;       // track A (outgoing)
  toSlotId: string;         // track B (incoming)
  overlapMs: number;        // how long the two tracks overlap
  bpmDelta?: number;        // tempo difference at transition point
  keyCompatibility?: "same" | "relative" | "adjacent" | "clash";
  automation: TransitionAutomation[];
  matchScore?: number;      // 0–100, see below
  notes?: string;
  recordedAt?: string;      // ISO timestamp of the practice session
}
```

**Mix match score:**

A 0–100 score summarizing how well two specific tracks transition into each other based on
accumulated practice data. Inputs to the score (all optional, weighted):

| Factor | How it's measured |
|--------|------------------|
| Key compatibility | Camelot wheel distance between track keys |
| BPM delta | Absolute difference in tempo at transition point |
| EQ headroom | Whether EQ kills were needed to avoid muddiness (lo/hi cuts during overlap) |
| Fader smoothness | Variance in the fader automation curve — jerky vs smooth |
| User override | Manual "felt great" / "trainwreck" rating after the practice run |

The score isn't computed automatically from audio analysis — it's built from structured
annotations the user fills in (or imports) after a practice session. With enough transitions
recorded, the app can surface "these two tracks have mixed well 3 times" vs "never attempted"
vs "marked as trainwreck."

**Recording flow (v1 — manual annotation):**

1. User practices the transition in their DJ setup
2. Opens the transition detail in the app
3. Fills in: overlap duration, which EQ channels they killed, fader style (cut / slow fade /
   quick fade), whether it worked
4. App computes score from structured fields + user rating
5. Score appears on the track row as a small indicator between adjacent tracks in the set

**Recording flow (v2 — external input):**

Future option: a small local sidecar (MIDI listener or audio interface input monitor) that
watches controller MIDI output during a live practice session and logs the automation in
real time, then POSTs it to a localhost endpoint the app exposes. This would give the full
automation timeline without manual entry. Out of scope for now but worth keeping the data
model compatible.

**Where the score shows up:**

- Between adjacent track rows in the set builder — a small "match" badge (green/yellow/red
  or numeric) in the gap between track A and track B
- In the arc bar — the join between two blocks could be colored by match score
- On a future "transition library" page — searchable list of all recorded A→B transitions
  across all sets, sortable by score, reusable when the same pair appears in a different set

**Open questions:**
- Best input format for importing automation from a DAW (MIDI CC log? CSV? rekordbox XML?)

#### rekordbox format notes

rekordbox XML (`File → Export Collection in xml format`) is the practical interchange target.
Cue points are `<POSITION_MARK>` elements on each `<TRACK>`:

```xml
<POSITION_MARK Name="Drop" Type="1" Start="64.000" Num="0" Red="255" Green="0" Blue="0" />
```

- `Start` is position in **seconds** (float) — multiply by 1000 to get our `positionMs`
- `Type`: 0=memory cue, 1=hot cue, 2=fade-in, 3=fade-out, 4=load
- `Num`: -1 for memory cues, 0–7 for hot cues
- Color as RGB on hot cues

The on-device binary format (`.DAT`/`.EXT` ANLZ files on Pioneer USB) is fully
reverse-engineered by the Deep Symmetry project: https://djl-analysis.deepsymmetry.org
Working libraries: `pyrekordbox` (Python), `rekordcrate` (Rust), `crate-digger` (Clojure).

**Import path for Phase 2.5:** Parse rekordbox XML export → map `POSITION_MARK` entries to
`CuePoint[]` on matching tracks (match by title+artist or ISRC if available in the XML).
Export path: write `POSITION_MARK` elements back so cues round-trip into rekordbox/CDJs.
- Whether to show the automation curve as a mini sparkline on the transition detail view
- How to handle transitions where BPM is matched via pitch shift vs tempo lock

---

### Phase 2.7 — Playback & Player Control

No player exists today — the app is a pure sidecar to whatever Spotify client is running.
But cue points and transition practice both eventually need *some* way to hear the track at
a specific position. Three paths forward, not mutually exclusive:

---

#### Option A — Spotify Connect remote control

Control the active Spotify player on any other device (desktop app, phone, speaker) via the
Spotify Web API's player endpoints. No new player in the browser — just remote.

```
GET  /v1/me/player                  → current playback state, device list
PUT  /v1/me/player/play             → play / resume, optionally seek to position_ms
PUT  /v1/me/player/pause
PUT  /v1/me/player/seek?position_ms=90000
PUT  /v1/me/player/transfer         → move playback to a specific device
```

**Pros:**
- Minimal work — auth is already wired, these are just additional API calls
- Works with the existing Spotify client the user is already running
- No Premium restriction beyond what Spotify already requires for playback
- Seek to `position_ms` maps directly to cue point values

**Cons:**
- Requires an active Spotify session on another device — won't work standalone
- Latency between button press and audio response
- No waveform, no beat grid, no visual feedback
- Useless once we're playing local FLAC files from the acquisition workflow

**Best for:** Quick "jump to cue point" and "preview this section" while building a set,
before local file acquisition is in place. Low-effort, high immediate value.

---

#### Option B — Spotify Web Playback SDK

Embeds a full Spotify player *in the browser tab* as a new Spotify Connect device. Requires
Spotify Premium. Gives full playback control including `seek()`, `getCurrentState()` for
position polling, and event listeners for track changes.

```ts
const player = new Spotify.Player({ name: "Spotify Slayer", getOAuthToken: ... });
player.seek(positionMs);
player.getCurrentState(); // → { position, duration, track_window }
```

**Pros:**
- Self-contained — no external device needed
- Position polling enables real-time playhead visualization over the EDL bar
- Can trigger playback from the app without switching windows
- Integrates naturally with cue point "play from here" buttons

**Cons:**
- Requires Spotify Premium
- SDK is a black box; Spotify has a history of breaking/restricting it
- Still useless for local FLAC files post-acquisition

**Best for:** In-app preview and cue point verification while tracks are still Spotify-only.
Worth adding after Connect remote control, as a step up in UX.

---

#### Option C — Web Audio API (local file playback)

Load acquired FLAC/MP3 files directly into the browser via `AudioContext`. No Spotify
dependency. Enables waveform rendering, beat detection, and — crucially — Web MIDI API
integration for the transition automation recording feature (Phase 2.6 v2).

```ts
const ctx = new AudioContext();
const source = ctx.createBufferSource();
source.buffer = await ctx.decodeAudioData(arrayBuffer);
source.connect(ctx.destination);
source.start(0, offsetSeconds);   // play from cue point
```

**Pros:**
- Works for local files — the endgame once acquisition is in place
- Can render a real waveform from the decoded audio buffer
- Web MIDI API in the same browser context → could listen to MIDI CC from a controller
  and record transition automation natively (the Phase 2.6 v2 sidecar, built-in)
- Full control — no SDK restrictions, no Premium requirement

**Cons:**
- Only useful after files are acquired locally
- Decoding large FLACs in the browser is CPU-intensive; may want to pre-decode or stream
- CORS and local file access require either a file picker or a local HTTP server for the
  files directory
- No Spotify integration — can't play "want" tracks that aren't acquired yet

**Best for:** The acquisition-complete workflow. Pairs with the EDL bar and transition
recording. This is the long-term answer.

---

#### Recommended phasing

| Phase | Feature | Approach |
|-------|---------|----------|
| Near term | "Play from cue" button, preview in Spotify | Connect remote control (Option A) |
| Medium term | In-app preview without switching apps | Web Playback SDK (Option B) |
| Post-acquisition | Local file playback, waveform, MIDI recording | Web Audio API (Option C) |

Options A and B are complementary — A works for anyone, B upgrades the experience for
Premium users. Option C replaces B for acquired tracks and adds capabilities that B can
never have. All three can coexist: play via Web Audio if a local file exists, fall back to
SDK/Connect if not.

**Open questions:**
- Does the Web Playback SDK still work reliably as of 2026? (Worth checking changelog —
  Spotify has been deprecating APIs aggressively)
- For Web Audio + MIDI: browser MIDI access requires HTTPS or localhost — fine for dev,
  needs consideration for any hosted version
- File serving for local FLACs: local HTTP server (e.g. the Next.js dev server with a
  `/files` static route) vs. browser File System Access API (`showOpenFilePicker`)

---

### Phase 3 — Set Structure & Arc

Sets have named sections with target energy ranges. Tracks slot into sections.

```ts
interface DJSetSection {
  id: string;
  name: string;               // "Warm Up", "Build", "Peak Hour", "Come Down"
  targetEnergyMin: number;
  targetEnergyMax: number;
  tracks: SetTrackSlot[];
}
```

- Drag tracks between sections
- Set arc visualization warns if a track's energy doesn't fit its section's target range

### Phase 4 — Track Suggestions from Own Library

Since Spotify's recommendations API is deprecated, suggestions come from the user's own
tagged library. The more tracks tagged, the more useful this becomes.

- "Suggest tracks for this section" — filter library by section's target energy + genre
- "What else sounds like this?" — tracks with matching tags + similar energy
- Recently used tracks surfaced when building a new set in the same genre

### Phase 5 — Acquisition Workflow (Soulseek)

The bridge between "I want this track" (Spotify discovery) and "I have this file" (local).

- Acquisition queue view: all tracks across all sets with `acquisitionStatus: "want"`
- One-click open Soulseek search pre-filled with artist + title
  - Nicotine+ supports a `nicotine://` URL scheme or CLI trigger
  - Fallback: copy "Artist - Title" to clipboard
- Mark as acquired, optionally paste in local file path
- Export "need to find" list as text file for batch Soulseek sessions
- Longer term: sidecar local process (slskd/Nicotine+ headless) exposing a REST API on
  localhost; Next.js routes call it to search and trigger downloads in-app

#### Research: SoulSync integration

https://github.com/Nezreka/SoulSync — self-hosted music automation platform worth
evaluating as the download sidecar. Key findings:

**What it does:** Connects Spotify discovery to file acquisition. Given a track, it searches
Soulseek (via slskd) and YouTube, downloads FLAC or MP3, enriches metadata (MusicBrainz,
iTunes, Beatport, Genius), organizes files, and optionally scrobbles to Last.fm. Also
handles playlist automation (Release Radar, Discovery Weekly, genre/mood-based playlists).

**Stack:** Python 3.11 Flask backend, vanilla JS frontend, SQLite, ~80 REST endpoints,
runs on localhost:8008. Deploy via Docker or native Python.

**Integration path:** REST API. SoulSync runs as a separate service; Spotify Slayer calls
its endpoints to trigger downloads and query status. No need to touch its internals.

**What it requires:**
- A running slskd instance (Soulseek headless client) — separate setup
- Spotify API credentials (same ones we already have)
- Storage path for downloaded files
- Optional: Tidal/Qobuz/Deezer API credentials for higher-quality sources

**What it solves for us:**
- Automated FLAC/MP3 download from Soulseek without manual search
- YouTube fallback if Soulseek has no results
- Metadata enrichment already handled (overlaps with our MusicBrainz work, but covers
  Beatport genre/BPM data we don't have yet)
- File organization

**Open questions before committing:**
1. Does slskd expose enough of the Soulseek search results to pick the best file
   (bitrate, format, file size)? Or does SoulSync auto-pick?
2. Can we trigger a download for a specific Spotify track ID / ISRC and get back a
   file path, or does it only work in bulk playlist mode?
3. How actively maintained is SoulSync? (Check last commit date, open issues)
4. Licensing — is it MIT/open? Any restrictions on embedding or calling its API?
5. Does the slskd setup require sharing files back to the Soulseek network? (Upload
   requirement to avoid bans — relevant if running on a home machine)

**Alternatives if SoulSync doesn't fit:**
- Call slskd's own REST API directly (slskd has a documented API) — more work but
  gives full control over search result selection
- lidarr + slskd (arr-stack) — heavier, media-server oriented, but battle-tested
- spotDL — Python CLI, downloads from YouTube Music, simpler but lower quality ceiling

---

## Phase 2 — Detailed Implementation Plan

### 2a. Track metadata library (localStorage)

A separate localStorage store keyed by Spotify track ID. Metadata persists across sets —
tag a track once, it carries those tags everywhere.

**New file: `src/lib/library.ts`**
```ts
const LIBRARY_KEY = "track_library";
type Library = Record<string, TrackMetadata>;

export function getTrackMeta(id: string): TrackMetadata | undefined
export function setTrackMeta(id: string, patch: Partial<TrackMetadata>): void
export function getAllTrackMeta(): Library
```

**New type in `src/lib/types.ts`: `TrackMetadata`**
```ts
export interface TrackMetadata {
  spotifyId: string;
  isrc?: string;       // from Spotify external_ids.isrc — key for MusicBrainz lookup
  mbid?: string;       // MusicBrainz recording ID, populated after enrichment
  energyLevel?: number;   // 1–5: 1=ambient/sparse, 5=peak/banger
  busyness?: number;      // 1–5: 1=minimal, 5=dense/complex
  tags?: string[];        // freeform: "floor filler", "transition", "opener", "vocal", etc.
  genre?: string[];       // seeded from MusicBrainz, user can override
  bpm?: number;           // from BPM detection service or Beatport
  key?: string;           // musical key
  acquisitionStatus?: "want" | "acquired" | "skip";
  localPath?: string;     // path to local file once acquired
  notes?: string;
  mbEnriched?: boolean;   // true once MusicBrainz enrichment has been attempted
}
```

**Energy scale:**
- 1 — Ambient / sparse / intro
- 2 — Warm, low-key
- 3 — Mid-energy, flowing
- 4 — High energy, building
- 5 — Peak / floor filler / banger

**Busyness scale:**
- 1 — Minimal, lots of space
- 2 — Light elements
- 3 — Moderate density
- 4 — Busy, many layers
- 5 — Dense / complex

**Update `DJSetTrack` in `src/lib/types.ts`** — add `isrc?` field so we can do
MusicBrainz lookups later without re-fetching from Spotify:
```ts
export interface DJSetTrack {
  // ...existing fields...
  isrc?: string;
}
```

**Update `SpotifyTrack` in `src/lib/spotify.ts`** — add `external_ids`:
```ts
export interface SpotifyTrack {
  // ...existing fields...
  external_ids?: { isrc?: string };
}
```

**Update `spotifyTrackToDJSetTrack` in `src/lib/sets.ts`** — capture ISRC:
```ts
export function spotifyTrackToDJSetTrack(track: SpotifyTrack): DJSetTrack {
  return {
    ...existing,
    isrc: track.external_ids?.isrc,
  };
}
```

---

### 2b. Energy + busyness tagging UI in set builder

**Location:** `src/app/sets/[id]/page.tsx`

The set builder loads all track metadata once on mount:
```ts
const [library, setLibrary] = useState<Record<string, TrackMetadata>>({});
useEffect(() => { setLibrary(getAllTrackMeta()); }, [set?.id]);
```

`handleMetaChange` updates library and local state:
```ts
function handleMetaChange(trackId: string, patch: Partial<TrackMetadata>) {
  setTrackMeta(trackId, patch);
  setLibrary(getAllTrackMeta());
}
```

**`SortableTrackRow`** receives `metadata` and `onMetaChange` as props. Each row shows:
- 4px colored left stripe (energy + busyness → HSL color, gray if untagged)
- 5-dot energy selector (always visible, click to set level)
- 5-dot busyness selector
- Genre tags as small pills (when available from MusicBrainz)

**Color function:**
```ts
function trackColor(energy: number, busyness: number): string {
  const hue = 220 - (energy - 1) * 55;  // 220=blue → 0=red
  const sat = 50 + (busyness - 1) * 12;
  const light = 35 + (busyness - 1) * 7;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}
```

Color map:
- energy=1, busyness=1 → dark blue (ambient)
- energy=3, busyness=3 → green (mid)
- energy=5, busyness=5 → bright red (peak)
- untagged → zinc-700 gray

**`DotSelector` component** (inline, no modal):
- 5 small clickable squares (12px each, 2px gap, ~70px total)
- Filled up to current value, empty above
- Click sets level, click active level resets to undefined (toggle off)

---

### 2c. Set arc visualization

**`SetArcBar` component** — horizontal color strip at top of set builder:
- Each track is a colored block proportional to `durationMs / totalDuration`
- Color from `trackColor(energyLevel, busyness)` or gray if untagged
- Tooltip on hover showing track name + energy + busyness values
- Shows after the set name/stats header
- Only renders when set has tracks

This gives the "energy arc over time" view at a glance. A warm-up set should show blue
blocks shifting to green/yellow/red at peak and coming back down.

**Per-row left stripe:**
- 4px wide `div` with `alignSelf: stretch`, `borderRadius: 2px`
- Background color from `trackColor` or `#3f3f46` if untagged
- Lives between the drag handle and track number in the row layout

---

### 2d. MusicBrainz enrichment

**Why MusicBrainz over Discogs or Last.fm:**
- No API key required (just a `User-Agent` header)
- Oriented toward digital library organization (not physical media like Discogs)
- ISRC lookup — most reliable cross-source identifier
- Recording relationships — same recording across different releases (useful for
  matching Spotify tracks to Soulseek results)
- Completely free at personal-tool scale

**ISRC as the linking key:**
Spotify exposes ISRC on every track via `external_ids.isrc`. MusicBrainz can look up
recordings directly by ISRC. This is more reliable than fuzzy artist+title matching.

```
Spotify track
  └── external_ids.isrc → "USRC17607839"
        └── GET /ws/2/isrc/{isrc}?fmt=json&inc=recordings
              └── recording MBID
                    └── GET /ws/2/recording/{mbid}?fmt=json&inc=genres+tags
                          └── genre list, tag list → stored in TrackMetadata
```

**New file: `src/app/api/enrich/route.ts`**

```ts
// POST { isrc: string, spotifyId: string }
// Returns { mbid, genres, tags } or { error }
//
// MusicBrainz rate limit: 1 req/sec for unauthenticated.
// Required header: User-Agent: SpotifySlayer/1.0 (contact@email.com)
//
// Step 1: GET https://musicbrainz.org/ws/2/isrc/{isrc}?fmt=json&inc=recordings
// Step 2: GET https://musicbrainz.org/ws/2/recording/{mbid}?fmt=json&inc=genres+tags
// Return genres (curated, smaller) + high-vote tags (count > 1, noisier but more granular)
```

**Genre data from MusicBrainz:**
- `genres` — curated list (more reliable, smaller set)
- `tags` — folksonomy (noisier, more granular sub-genre detail)
- Strategy: use `genres` as canonical list, supplement with tags having `count > 1`

**Enrichment trigger in set builder:**
- On set load, find tracks with `isrc` but no `mbEnriched` in their metadata
- Enrich them sequentially with 1100ms delay between requests (respects rate limit)
- Show subtle loading indicator per track while enriching
- On success: update metadata in library, set `mbEnriched: true`, show genre pills on row
- On failure (no ISRC match): set `mbEnriched: true` anyway to prevent retrying

**Note:** Enrichment is background, non-blocking. User can tag energy/busyness immediately
without waiting for MusicBrainz.

---

## Track Sources

### Spotify (current)
- Browse playlists ✓
- Playlist track detail ✓
- Search (wired in lib, UI todo)
- Recently played (wired in lib, UI todo)
- Artist top tracks / discography (future — replaces deprecated radio/recommendations)

### MusicBrainz (Phase 2 — metadata enrichment only, not discovery)
- ISRC → genre/tags
- Cross-source recording identity (MBID links to Beatport, Discogs, etc.)

### Soulseek (Phase 5 — acquisition)
- Manual workflow support first (pre-filled search links), sidecar automation later

### Beatport (future — metadata + acquisition)
- Requires partner API application
- Best source for BPM, key, and precise electronic music genre/label data
- Beatport track IDs linkable via MusicBrainz URL relationships

### BPM Detection Service (separate project)
- Local service that analyzes audio files and returns BPM + key
- App calls it via localhost REST endpoint
- Populates `bpm` and `key` fields in TrackMetadata for acquired tracks

---

## Common Track Interface (future — when multiple sources are active)

```ts
interface Track {
  id: string;
  source: "spotify" | "soulseek" | "beatport" | "local";
  name: string;
  artists: string[];
  album?: string;
  durationMs: number;
  imageUrl?: string;
  spotifyUri?: string;
  spotifyId?: string;
  isrc?: string;
  mbid?: string;
  beatportId?: string;
  bpm?: number;
  key?: string;
  genre?: string[];
  energyLevel?: number;
  busyness?: number;
  tags?: string[];
  acquisitionStatus?: "want" | "acquired" | "skip";
  localPath?: string;
}
```

---

## Architecture Notes

- **Frontend + API routes:** Next.js (current)
- **Storage v1:** localStorage — sets, track library, metadata. No server DB needed until
  multi-device sync is wanted.
- **Storage v2 (future):** SQLite via a local API, or lightweight cloud DB if sync matters
- **MusicBrainz calls:** proxied through Next.js API routes (server-side, avoids CORS,
  rate-limited in one place)
- **Soulseek sidecar:** separate local process, called via localhost from Next.js API routes
- **BPM detection service:** separate project, same localhost pattern
- **Beatport OAuth:** handled via Next.js API routes when added, similar to Spotify auth
- No external services beyond Spotify OAuth needed for v1 or v2

---

## Dev Notes

- Dev server: `node node_modules/next/dist/bin/next dev --webpack` (SWC arm64 binary corrupted)
- Must access via `http://127.0.0.1:3000` (Spotify rejects `localhost` as "Insecure")
- `allowedDevOrigins: ["127.0.0.1"]` in `next.config.ts` required for HMR on 127.0.0.1
- `NEXTAUTH_URL=http://127.0.0.1:3000` in `.env`
- `getServerSession()` must receive `authOptions` argument or always returns null
