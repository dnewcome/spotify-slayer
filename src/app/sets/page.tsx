"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSets, createSet, saveSet, deleteSet, totalDuration } from "@/lib/sets";
import { getAllTrackMeta } from "@/lib/library";
import { DJSet, DJSetTrack, TrackMetadata } from "@/lib/types";

const UNTAGGED_COLOR = "#3f3f46";

function trackColor(energy: number, busyness: number): string {
  const hue = 220 - (energy - 1) * 55;
  const sat = 50 + (busyness - 1) * 12;
  const light = 35 + (busyness - 1) * 7;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

function resolveColor(meta?: TrackMetadata): string {
  if (!meta?.energyLevel) return UNTAGGED_COLOR;
  return trackColor(meta.energyLevel, meta.busyness ?? 1);
}

function SetArcMini({ tracks, library }: { tracks: DJSetTrack[]; library: Record<string, TrackMetadata> }) {
  const total = tracks.reduce((acc, t) => acc + t.durationMs, 0);
  if (total === 0 || tracks.length === 0) return null;
  return (
    <div className="flex h-2 rounded overflow-hidden gap-px mb-3">
      {tracks.map((t) => (
        <div
          key={t.slotId ?? t.id}
          title={t.name}
          style={{
            width: `${(t.durationMs / total) * 100}%`,
            backgroundColor: resolveColor(library[t.id]),
            minWidth: 2,
          }}
        />
      ))}
    </div>
  );
}

function setStats(set: DJSet, library: Record<string, TrackMetadata>) {
  const tagged = set.tracks.filter((t) => library[t.id]?.energyLevel).length;
  const genres: Record<string, number> = {};
  for (const t of set.tracks) {
    for (const g of library[t.id]?.genre ?? []) {
      genres[g] = (genres[g] ?? 0) + 1;
    }
  }
  const topGenres = Object.entries(genres)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([g]) => g);
  return { tagged, topGenres };
}

export default function SetsPage() {
  const [sets, setSets] = useState<DJSet[]>([]);
  const [library, setLibrary] = useState<Record<string, TrackMetadata>>({});
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setSets(getSets());
    setLibrary(getAllTrackMeta());
  }, []);

  function handleCreate() {
    if (!newName.trim()) return;
    const s = createSet(newName.trim());
    saveSet(s);
    setSets(getSets());
    setNewName("");
    setCreating(false);
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    deleteSet(id);
    setSets(getSets());
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">DJ Sets</h1>
        <button
          onClick={() => setCreating(true)}
          className="bg-green-500 hover:bg-green-400 text-black font-semibold text-sm px-4 py-2 rounded-full transition-colors"
        >
          New Set
        </button>
      </div>

      {creating && (
        <div className="mb-6 flex gap-2 max-w-sm">
          <input
            autoFocus
            type="text"
            placeholder="Set name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setCreating(false);
            }}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
          />
          <button
            onClick={handleCreate}
            className="bg-green-500 hover:bg-green-400 text-black font-semibold text-sm px-4 py-2 rounded-lg"
          >
            Create
          </button>
          <button
            onClick={() => setCreating(false)}
            className="text-sm text-zinc-500 px-3 py-2"
          >
            Cancel
          </button>
        </div>
      )}

      {sets.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <div className="text-4xl mb-3">🎛️</div>
          <p className="text-lg">No DJ sets yet.</p>
          <p className="text-sm mt-1">Create a set, then add tracks from your playlists.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sets.map((s) => {
            const { tagged, topGenres } = setStats(s, library);
            return (
              <div
                key={s.id}
                className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 hover:border-zinc-600 transition-colors group"
              >
                <Link href={`/sets/${s.id}`} className="block mb-2">
                  <div className="font-semibold group-hover:text-green-400 transition-colors truncate">
                    {s.name}
                  </div>
                  {s.description && (
                    <div className="text-sm text-zinc-400 mt-0.5 truncate">{s.description}</div>
                  )}
                </Link>

                {s.tracks.length > 0 && (
                  <SetArcMini tracks={s.tracks} library={library} />
                )}

                {topGenres.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {topGenres.map((g) => (
                      <span key={g} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="text-xs text-zinc-500 flex items-center gap-2">
                    <span>
                      {s.tracks.length} {s.tracks.length === 1 ? "track" : "tracks"}
                      {s.tracks.length > 0 && ` · ${totalDuration(s.tracks)}`}
                    </span>
                    {s.tracks.length > 0 && tagged < s.tracks.length && (
                      <span className="text-zinc-600">{tagged}/{s.tracks.length} tagged</span>
                    )}
                    {s.tracks.length > 0 && tagged === s.tracks.length && (
                      <span className="text-green-700">{tagged}/{s.tracks.length} tagged</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/sets/${s.id}`}
                      className="text-xs text-zinc-400 hover:text-white transition-colors"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(s.id, s.name)}
                      className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
