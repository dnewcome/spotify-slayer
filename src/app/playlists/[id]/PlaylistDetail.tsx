"use client";

import { useState } from "react";
import { SpotifyPlaylist, SpotifyTrack } from "@/lib/spotify";
import { getSets, saveSet, spotifyTrackToDJSetTrack } from "@/lib/sets";
import { setTrackMeta } from "@/lib/library";
import TrackRow from "@/components/TrackRow";
import AddToSetModal from "@/components/AddToSetModal";

interface Props {
  playlist: SpotifyPlaylist;
  tracks: SpotifyTrack[];
}

export default function PlaylistDetail({ playlist, tracks }: Props) {
  const [pendingTrack, setPendingTrack] = useState<SpotifyTrack | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function handleAdd(track: SpotifyTrack) {
    setPendingTrack(track);
  }

  function handleAddToSet(setId: string) {
    if (!pendingTrack) return;
    const sets = getSets();
    const set = sets.find((s) => s.id === setId);
    if (!set) return;
    set.tracks.push(spotifyTrackToDJSetTrack(pendingTrack));
    set.updatedAt = new Date().toISOString();
    saveSet(set);
    setToast(`Added "${pendingTrack.name}" to "${set.name}"`);

    // Fire MusicBrainz enrichment in the background — best effort, non-blocking
    const isrc = pendingTrack.external_ids?.isrc;
    const spotifyId = pendingTrack.id;
    if (isrc) {
      fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isrc, spotifyId }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (!data.error) {
            setTrackMeta(spotifyId, {
              spotifyId,
              isrc,
              mbid: data.mbid,
              genre: data.genres,
              tags: data.tags,
              mbEnriched: true,
            });
          } else {
            setTrackMeta(spotifyId, { spotifyId, isrc, mbEnriched: true });
          }
        })
        .catch(() => {
          // enrichment is best-effort — silent failure is fine
        });
    } else {
      // No ISRC available — mark as attempted so we don't retry
      setTrackMeta(spotifyId, { spotifyId, mbEnriched: true });
    }

    setPendingTrack(null);
    setTimeout(() => setToast(null), 3000);
  }

  const art = playlist.images?.[0]?.url;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-start gap-6 mb-8">
        <div className="w-40 h-40 flex-shrink-0 rounded-xl overflow-hidden bg-zinc-800">
          {art ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={art} alt={playlist.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-600 text-5xl">
              ♪
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Playlist</div>
          <h1 className="text-3xl font-bold mb-2 truncate">{playlist.name}</h1>
          {playlist.description && (
            <p className="text-sm text-zinc-400 mb-2">{playlist.description}</p>
          )}
          <div className="text-sm text-zinc-500">
            {playlist.owner?.display_name} · {tracks.length} tracks
          </div>
        </div>
      </div>

      <div className="space-y-1">
        {tracks.map((track, i) => (
          <div key={`${track.id}-${i}`} className="flex items-center">
            <span className="w-8 text-right text-xs text-zinc-600 flex-shrink-0 mr-1">
              {i + 1}
            </span>
            <div className="flex-1">
              <TrackRow track={track} onAdd={handleAdd} />
            </div>
          </div>
        ))}
      </div>

      {pendingTrack && (
        <AddToSetModal
          track={pendingTrack}
          onClose={() => setPendingTrack(null)}
          onAdd={handleAddToSet}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-800 text-sm px-4 py-2 rounded-full border border-zinc-700 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
