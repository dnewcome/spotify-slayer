"use client";

import { useState, useTransition } from "react";
import { SpotifyTrack } from "@/lib/spotify";
import TrackRow from "@/components/TrackRow";
import AddToSetModal from "@/components/AddToSetModal";
import { getSets, saveSet, spotifyTrackToDJSetTrack } from "@/lib/sets";
import { setTrackMeta } from "@/lib/library";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [isPending, startTransition] = useTransition();
  const [pendingTrack, setPendingTrack] = useState<SpotifyTrack | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function handleSearch(q: string) {
    setQuery(q);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.tracks ?? []);
    });
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

    const isrc = pendingTrack.external_ids?.isrc;
    const spotifyId = pendingTrack.id;
    fetch("/api/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isrc, spotifyId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setTrackMeta(spotifyId, { spotifyId, isrc, mbid: data.mbid, genre: data.genres, tags: data.tags, mbEnriched: true });
        } else {
          setTrackMeta(spotifyId, { spotifyId, mbEnriched: true });
        }
      })
      .catch(() => {});

    setPendingTrack(null);
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Search</h1>
      <div className="relative mb-6 max-w-lg">
        <input
          type="text"
          placeholder="Search for tracks..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-500 pr-10"
        />
        {isPending && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      <div className="space-y-1">
        {results.map((track, i) => (
          <TrackRow key={`${track.id}-${i}`} track={track} onAdd={setPendingTrack} />
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
