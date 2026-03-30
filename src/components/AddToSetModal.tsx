"use client";

import { useEffect, useState } from "react";
import { getSets, createSet, saveSet } from "@/lib/sets";
import { DJSet } from "@/lib/types";
import { SpotifyTrack } from "@/lib/spotify";

interface Props {
  track: SpotifyTrack;
  onClose: () => void;
  onAdd: (setId: string) => void;
}

export default function AddToSetModal({ track, onClose, onAdd }: Props) {
  const [sets, setSets] = useState<DJSet[]>([]);
  const [newSetName, setNewSetName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setSets(getSets());
  }, []);

  function handleCreate() {
    if (!newSetName.trim()) return;
    const s = createSet(newSetName.trim());
    saveSet(s);
    setSets(getSets());
    setNewSetName("");
    setCreating(false);
    onAdd(s.id);
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold mb-1">Add to DJ Set</h3>
        <p className="text-sm text-zinc-400 mb-4 truncate">{track.name}</p>

        <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
          {sets.length === 0 && !creating && (
            <p className="text-sm text-zinc-500">No sets yet.</p>
          )}
          {sets.map((s) => (
            <button
              key={s.id}
              onClick={() => onAdd(s.id)}
              className="w-full text-left px-3 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm"
            >
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-zinc-500">{s.tracks.length} tracks</div>
            </button>
          ))}
        </div>

        {creating ? (
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              placeholder="Set name"
              value={newSetName}
              onChange={(e) => setNewSetName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
            />
            <button
              onClick={handleCreate}
              className="bg-green-500 hover:bg-green-400 text-black font-semibold text-sm px-3 py-2 rounded-lg"
            >
              Create
            </button>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="w-full text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-lg px-3 py-2 transition-colors"
          >
            + New Set
          </button>
        )}
      </div>
    </div>
  );
}
