"use client";

import { useState } from "react";
import { SpotifyTrack } from "@/lib/spotify";
import { getSets, saveSet, spotifyTrackToDJSetTrack } from "@/lib/sets";
import { setTrackMeta } from "@/lib/library";
import TrackRow from "@/components/TrackRow";
import AddToSetModal from "@/components/AddToSetModal";

interface RecentItem {
  track: SpotifyTrack;
  played_at: string;
}

interface Props {
  items: RecentItem[];
}

export default function RecentlyPlayed({ items }: Props) {
  const [pendingTrack, setPendingTrack] = useState<SpotifyTrack | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function handleAddToSet(setId: string) {
    if (!pendingTrack) return;
    const sets = getSets();
    const set = sets.find((s) => s.id === setId);
    if (!set) return;
    set.tracks.push(spotifyTrackToDJSetTrack(pendingTrack));
    set.updatedAt = new Date().toISOString();
    saveSet(set);
    setToast(`Added "${pendingTrack.name}" to "${set.name}"`);

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
        .catch(() => {});
    } else {
      setTrackMeta(spotifyId, { spotifyId, mbEnriched: true });
    }

    setPendingTrack(null);
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <>
      <div className="space-y-1">
        {items.map((item, i) =>
          item.track ? (
            <TrackRow
              key={`${item.track.id}-${i}`}
              track={item.track}
              subtitle={new Date(item.played_at).toLocaleString()}
              onAdd={setPendingTrack}
            />
          ) : null
        )}
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
    </>
  );
}
