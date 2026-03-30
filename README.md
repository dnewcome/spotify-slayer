# Spotify Slayer

A personal DJ set builder powered by Spotify. Browse your playlists and listening history, tag tracks with energy and feel, build ordered sets with a visual energy arc, and get genre metadata automatically from MusicBrainz.

Built for the real DJ prep workflow — not for casual listening.

---

## What it does

**The problem:** Spotify is great for discovering music but terrible for DJ prep. Adding tracks to a playlist buries them in "Liked Songs" by default. There's no way to tag tracks by energy or feel. No set structure. No arc. And once you've found the tracks you want, there's no bridge to actually acquiring the files.

**This app:** A secondary Spotify interface focused entirely on DJ set building.

### Features

- **Browse playlists** — all your Spotify playlists in one view, with track counts
- **Recently played** — last 20 tracks on the home page, all addable to sets
- **Search** — full Spotify track search with one-click add to set
- **DJ sets** — create, rename, delete, drag-and-drop reorder, total duration display
- **Active set workflow** — every track you see has a single "+" button, no menu navigation, no wrong defaults
- **Energy & busyness tagging** — rate each track 1–5 on two axes directly in the set builder. Tags persist in your local library across sets.
- **Energy arc visualization** — a horizontal color strip at the top of the set builder shows the energy shape of the full set. Each track is a block proportional to its duration, colored from blue (ambient) through green to red (peak). Click any track to highlight its position in the arc.
- **MusicBrainz enrichment** — when you add a track to a set, genre metadata is fetched automatically in the background. Uses ISRC (the universal recording identifier) to look up the track, pulls both recording-level and artist-level genre tags, and surfaces them as pills on each track row.

### Energy & busyness scales

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
- **@dnd-kit** — drag-and-drop set reordering
- **MusicBrainz WS2 API** — genre enrichment via ISRC lookup
- **localStorage** — sets and track library, no server database needed

---

## Setup

### 1. Spotify app

Create an app at [developer.spotify.com](https://developer.spotify.com/dashboard). Add this redirect URI:

```
http://127.0.0.1:3000/api/auth/callback/spotify
```

> **Note:** Spotify deprecated `localhost` redirect URIs in early 2026 — they're now rejected as "Insecure". Use `127.0.0.1` only.

### 2. Environment

Create `.env` in the project root:

```
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
NEXTAUTH_URL=http://127.0.0.1:3000
NEXTAUTH_SECRET=any_random_string
```

### 3. Install and run

Requires Node.js >= 20.9.0.

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) — use `127.0.0.1`, not `localhost`.

> **Note:** The dev script uses `--webpack` and invokes Next.js directly to work around a corrupted SWC arm64 binary issue. If you don't have this problem, you can replace the dev script in `package.json` with the standard `next dev`.

---

## How to use it

### Building a set

1. Go to **Playlists** or **Search**, find tracks you want
2. Click **+ Add** on any track — pick an existing set or create a new one
3. Go to **DJ Sets** → open your set
4. Drag tracks to reorder them
5. Click the dot selectors on each row to tag energy (left) and busyness (right)
6. Watch the arc bar at the top update as you tag — the goal is a shape that tells a story

### Reading the arc bar

The horizontal strip at the top of a set shows the full energy arc at a glance:

- **Blue blocks** — low energy, good for warm-up or wind-down
- **Green blocks** — mid energy, flowing sections
- **Red blocks** — peak energy, floor fillers
- **Gray blocks** — untagged, no energy data yet
- Block **width** is proportional to track duration
- Click any track row to **highlight** its position in the arc

### Genre enrichment

Genre tags appear automatically under the artist name on each track row, sourced from MusicBrainz. This happens in the background when you add a track to a set, or on page load for any tracks not yet enriched. Some tracks won't be in MusicBrainz — they're silently skipped.

### Track library

Your energy/busyness tags and genre data are stored in a separate `track_library` key in localStorage, keyed by Spotify track ID. Tags persist across sets — if you tag a track in one set, the same tags appear when it shows up in another.

---

## Roadmap

See [PLAN.md](PLAN.md) for the full design discussion. Short version:

- **Import/export** — JSON set files for backup and sharing; export as a Spotify playlist; plain text tracklist for posting to Mixcloud/SoundCloud
- **Set sections** — structured warm-up / build / peak / come-down sections with target energy ranges per section
- **Suggestions** — filter your own tagged library by energy range and genre to find tracks for a section (no algorithmic recommendations — Spotify deprecated that API)
- **Acquisition workflow** — one-click Soulseek search pre-filled with artist + title; track which files you have and which you still need; batch export "need to find" list
- **Beatport metadata** — BPM, key, precise electronic music genre data (requires partner API access)
- **BPM detection** — local analysis service for acquired files

---

## Spotify API notes (2026)

A few breaking changes hit during development that aren't well-documented yet:

- `GET /v1/playlists/{id}/tracks` — deprecated February 2026, use `/v1/playlists/{id}/items`
- Playlist item objects now use key `item` instead of `track`
- Simplified playlist objects now use `items: { total }` instead of `tracks: { total }`
- Audio features endpoint (BPM, key, energy) — deprecated, no Web API replacement
- Recommendations endpoint — deprecated
- `localhost` redirect URIs — rejected as "Insecure", use `http://127.0.0.1`
- Search `limit` parameter — now rejected as invalid; use `market=from_token` instead and omit `limit`

---

## Devlog

Development notes and screenshots are in [`devlog/`](devlog/).
