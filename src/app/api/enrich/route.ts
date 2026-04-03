import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const MB_BASE = "https://musicbrainz.org/ws/2";
const MB_USER_AGENT = "DJSetBuilder/1.0 (dj-set-builder)";

async function mbFetch(path: string) {
  const res = await fetch(`${MB_BASE}${path}`, {
    headers: { "User-Agent": MB_USER_AGENT, Accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`MusicBrainz ${res.status} on ${path}`);
  return res.json();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { isrc, spotifyId } = body;
    console.log(`[enrich] START spotifyId=${spotifyId} isrc=${isrc ?? "none"}`);

    if (!spotifyId) {
      return NextResponse.json({ error: "missing_spotify_id" }, { status: 400 });
    }

    // If no ISRC provided, fetch the full Spotify track to get it.
    // Recently played uses simplified track objects that omit external_ids.
    if (!isrc) {
      console.log(`[enrich] no ISRC — fetching from Spotify for ${spotifyId}`);
      try {
        const session = await getServerSession(authOptions);
        console.log(`[enrich] session accessToken present: ${!!session?.accessToken}`);
        if (session?.accessToken) {
          const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${spotifyId}`, {
            headers: { Authorization: `Bearer ${session.accessToken}` },
          });
          console.log(`[enrich] Spotify track fetch status: ${trackRes.status}`);
          if (trackRes.ok) {
            const trackData = await trackRes.json();
            isrc = trackData.external_ids?.isrc ?? null;
            console.log(`[enrich] got ISRC from Spotify: ${isrc ?? "none"}`);
          }
        }
      } catch (err) {
        console.warn(`[enrich] Spotify ISRC fetch error:`, err);
      }
    }

    if (!isrc) {
      console.log(`[enrich] no ISRC available for ${spotifyId}`);
      return NextResponse.json({ error: "no_isrc", spotifyId });
    }

    // Step 1: look up recordings by ISRC
    console.log(`[enrich] MB ISRC lookup: ${isrc}`);
    const isrcData = await mbFetch(`/isrc/${encodeURIComponent(isrc)}?fmt=json`);
    if (!isrcData) {
      console.log(`[enrich] MB ISRC not found: ${isrc}`);
      return NextResponse.json({ error: "not_found", spotifyId, isrc });
    }
    const recordings: { id: string }[] = isrcData.recordings ?? [];
    console.log(`[enrich] MB found ${recordings.length} recording(s)`);

    if (recordings.length === 0) {
      return NextResponse.json({ error: "not_found", spotifyId, isrc });
    }

    const mbid = recordings[0].id;

    // Step 2: fetch recording + artist credits
    await new Promise((r) => setTimeout(r, 300));
    console.log(`[enrich] MB recording lookup: ${mbid}`);
    const recording = await mbFetch(
      `/recording/${mbid}?fmt=json&inc=genres+tags+artist-credits`
    );
    if (!recording) {
      console.log(`[enrich] MB recording not found: ${mbid}`);
      return NextResponse.json({ error: "not_found", spotifyId, isrc, mbid });
    }

    const recGenres: string[] = (recording.genres ?? []).map((g: { name: string }) => g.name);
    const recTags: string[] = (recording.tags ?? [])
      .filter((t: { count: number }) => t.count > 1)
      .map((t: { name: string }) => t.name);
    console.log(`[enrich] recording genres: [${recGenres.join(", ")}] tags: [${recTags.join(", ")}]`);

    // Step 3: fetch artist genres/tags — much better populated than recording-level
    const artistCredits: { artist: { id: string } }[] = recording["artist-credit"] ?? [];
    let artistGenres: string[] = [];
    let artistTags: string[] = [];

    if (artistCredits.length > 0) {
      const artistMbid = artistCredits[0].artist.id;
      await new Promise((r) => setTimeout(r, 300));
      console.log(`[enrich] MB artist lookup: ${artistMbid}`);
      try {
        const artist = await mbFetch(`/artist/${artistMbid}?fmt=json&inc=genres+tags`);
        artistGenres = (artist.genres ?? []).map((g: { name: string }) => g.name);
        artistTags = (artist.tags ?? [])
          .filter((t: { count: number }) => t.count > 1)
          .map((t: { name: string }) => t.name);
        console.log(`[enrich] artist genres: [${artistGenres.join(", ")}] tags: [${artistTags.join(", ")}]`);
      } catch (err) {
        console.warn(`[enrich] artist lookup failed:`, err);
      }
    }

    const genres = [...new Set([...recGenres, ...artistGenres])];
    const tags = [...new Set([...recTags, ...artistTags])];
    console.log(`[enrich] DONE genres: [${genres.join(", ")}] tags: [${tags.join(", ")}]`);

    return NextResponse.json({ mbid, genres, tags, isrc, spotifyId });
  } catch (err) {
    console.error("[enrich] unhandled error:", err);
    return NextResponse.json({ error: "enrichment_failed" }, { status: 500 });
  }
}
