# Spotify Slayer

A personal DJ set builder powered by Spotify and Soulseek. Browse your playlists, tag tracks with energy and feel, build ordered sets with a visual arc, acquire FLAC files via Soulseek, and export to rekordbox or Traktor.

Built for the real DJ prep workflow — not for casual listening.

---

## What it does

**The problem:** Spotify is great for discovering music but terrible for DJ prep. Adding tracks to a playlist buries them in "Liked Songs" by default. There's no way to tag tracks by energy or feel, no set structure, no arc, and no bridge to actually acquiring the files you need to play out.

**This app:** A secondary Spotify interface focused entirely on DJ set building — from discovery through to a USB stick you can take to a gig.

---

## Features

### Set building
- **Browse playlists** — all your Spotify playlists in one view
- **Recently played** — last 20 tracks on the home page, all addable to sets
- **Search** — full Spotify track search with one-click add to set
- **DJ sets** — create, rename, delete, drag-and-drop reorder, total and on-air duration
- **In/out points** — set entry and exit times per track (mm:ss). Duration display reflects the active region, not the full track length.
- **Energy & busyness tagging** — rate each track 1–5 on two axes. Tags persist in your local library across sets.
- **Freeform tags** — add any label ("opener", "floor filler", "vocal", "transition") per track
- **Energy arc visualization** — a horizontal color strip shows the energy shape of the full set. Each block is proportional to the track's active duration, colored from blue (ambient) through green to red (peak).

### Metadata
- **MusicBrainz enrichment** — when you add a track to a set, genre and tag data is fetched automatically via ISRC lookup. Artist-level and recording-level genres surface as pills on the track row.

### Playback
- **Spotify Web Playback SDK** — embedded player in the browser tab (requires Spotify Premium). Play any track from the set builder, seek to position, and use set in/out points for preview.
- **Auto-advance** — playback automatically advances to the next track at its out point.
- **Set In / Set Out buttons** — mark cue points at the current playback position while listening.

### Acquisition (Soulseek via slskd)
- **Find on Soulseek** — hover any track row and click "find". Searches slskd, polls until complete, and opens a results drawer showing all FLAC and MP3 results sorted by quality (FLAC by size, MP3 by bitrate).
- **One-click download** — click ↓ on any result to enqueue it in slskd.
- **Progress tracking** — live progress bar during download. Shows "queued…" when waiting in the remote peer's upload queue.
- **Cancel** — hover a downloading track and click × to cancel and try a different result.
- **Post-download normalization** — on completion, ffmpeg copies the file to `MUSIC_DIR` as `Artist - Title.ext`, embeds ISRC and tags, and removes the raw slskd download. `localPath` is stored in the track library.
- **Acquired badge** — once downloaded, a FLAC/MP3 badge appears on the track row.

### Export
- **rekordbox XML** — exports a set as a rekordbox-compatible XML file with the full track collection and playlist. In/out points export as memory cues (`POSITION_MARK`). Import into rekordbox, then use rekordbox's USB export for CDJ use.
- **m3u8 playlist** — extended M3U playlist with absolute paths. Works in Traktor and most other players.
- **Copy to folder** — copies all downloaded audio files for the set to a target directory (e.g. a USB mount point) and writes a relative-path m3u8 alongside them. Files already present with the same size are skipped. Use this to put a set on a USB stick.

All export options require all tracks in the set to be downloaded first.

---

## Energy & busyness scales

| Level | Energy | Busyness |
|-------|--------|----------|
| 1 | Ambient / sparse / intro | Minimal, lots of space |
| 2 | Warm, low-key | Light elements |
| 3 | Mid-energy, flowing | Moderate density |
| 4 | High energy, building | Busy, many layers |
| 5 | Peak / floor filler / banger | Dense / complex |

The arc bar maps energy to hue (blue → green → yellow → red) and busyness to saturation and brightness.

---

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS)
- **next-auth v4** — Spotify OAuth 2.0 Authorization Code flow
- **Spotify Web Playback SDK** — in-browser playback (Premium required)
- **@dnd-kit** — drag-and-drop set reordering
- **MusicBrainz WS2 API** — genre enrichment via ISRC lookup
- **slskd** — Soulseek daemon with REST API for file acquisition
- **ffmpeg** — post-download audio copy + tag embedding (no re-encode)
- **localStorage** — sets and track library, no server database needed

---

## Setup

### 1. Spotify app

Create an app at [developer.spotify.com](https://developer.spotify.com/dashboard). Add this redirect URI:

```
http://127.0.0.1:3000/api/auth/callback/spotify
```

> **Note:** Spotify deprecated `localhost` redirect URIs in early 2026 — they're now rejected as "Insecure". Use `127.0.0.1` only.

### 2. slskd (optional — for file acquisition)

[slskd](https://github.com/slskd/slskd) is a Soulseek daemon with a REST API. Install and run it separately. Generate an API key and add it to `slskd.yml`:

```yaml
web:
  authentication:
    api_keys:
      spotify_slayer:
        key: <your_key>   # openssl rand -hex 32
        role: readwrite
        cidr: 0.0.0.0/0,::/0
```

### 3. ffmpeg

Required for post-download normalization. Install via your package manager:

```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg
```

### 4. Environment

```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
NEXTAUTH_URL=http://127.0.0.1:3000
NEXTAUTH_SECRET=any_random_string

# slskd acquisition (optional)
SLSKD_URL=http://localhost:5030
SLSKD_API_KEY=your_slskd_api_key
SLSKD_DOWNLOADS_DIR=/home/user/.local/share/slskd/downloads
MUSIC_DIR=/home/user/Music/dj-library
```

### 5. Install and run

Requires Node.js >= 20.9.0.

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) — use `127.0.0.1`, not `localhost`.

---

## Workflow

### Building a set

1. Go to **Playlists** or **Search**, find tracks you want
2. Click **+ Add** on any track — pick an existing set or create a new one
3. Open the set in **DJ Sets**
4. Drag tracks to reorder
5. Set in/out points by typing `mm:ss` into the in/out fields, or enable the player and use **[in** / **out]** buttons while listening
6. Tag energy (left dots) and busyness (right dots) per track
7. Watch the arc bar update — the goal is a shape that tells a story

### Acquiring files

1. Hover any track row — a **find** button appears on the right
2. Click find — the app searches Soulseek, polls for ~10s, then opens a results drawer
3. Results are sorted: FLAC by size (largest first), then MP3 by bitrate
4. Click **↓** on the best result to download
5. Track shows "queued…" while waiting for the remote peer, then a progress bar once transferring
6. On completion the file is moved to `MUSIC_DIR`, tagged with ISRC, and the row shows a FLAC/MP3 badge
7. If a download is stuck, hover the row and click **×** to cancel and pick a different source

### Exporting a set

All tracks must be downloaded before exporting.

**For CDJ use (Pioneer):**
1. Click **rekordbox** in the set header to download a `.xml` file
2. In rekordbox: File → Import → rekordbox xml
3. Right-click the playlist → Export to device → select your USB
4. rekordbox writes the PIONEER/ database to the USB

**For Traktor or direct USB use:**
1. Type a destination path in the path field (e.g. `/media/USB`) and click **copy**
2. All audio files are copied flat into that folder, with a relative-path `.m3u8` alongside them
3. Point Traktor at the folder, or drag the m3u8 into a Traktor playlist
4. The same USB folder can later have rekordbox's PIONEER/ database added on top of it without conflict

---

## Data storage

Everything is stored in **localStorage** — no server, no database, no account beyond Spotify OAuth.

| Key | Contents |
|-----|----------|
| `dj_sets` | All DJ sets with track lists, in/out points |
| `track_library` | Per-track metadata: energy, busyness, tags, genres, ISRC, localPath |

`localPath` is relative to `MUSIC_DIR` (e.g. `Foo Fighters - Everlong.flac`). If localStorage is wiped, re-scanning `MUSIC_DIR` can rebuild it from ISRC tags embedded in the files.

---

## Spotify API notes (2026)

Breaking changes that hit during development:

- `GET /v1/playlists/{id}/tracks` — deprecated, use `/v1/playlists/{id}/items`
- Playlist item objects now use key `item` instead of `track`
- Simplified playlist objects now use `items: { total }` instead of `tracks: { total }`
- Audio features endpoint (BPM, key, energy) — deprecated, no Web API replacement
- Recommendations endpoint — deprecated
- `localhost` redirect URIs — rejected as "Insecure", use `http://127.0.0.1`
- Search `limit` parameter — rejected as invalid; omit it and use `market=from_token`

---

## Roadmap

See [PLAN.md](PLAN.md) for the full design discussion. Next up:

- **Batch download** — "download missing" button to acquire all tracks in a set automatically, auto-picking the best FLAC result
- **NML export** — Traktor native format with cue points pre-loaded (deferred pending live testing)
- **Cue points** — named markers beyond in/out (drop, loop, info) displayed as an EDL bar on each track row
- **rekordbox XML import** — round-trip cue points set in rekordbox back into the app
- **BPM detection** — local analysis for acquired files

---

## Devlog

Development notes and screenshots are in [`devlog/`](devlog/).
