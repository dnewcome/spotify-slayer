"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getSet, saveSet, deleteSet, totalDuration, formatDuration } from "@/lib/sets";
import { getAllTrackMeta, setTrackMeta } from "@/lib/library";
import { DJSet, DJSetTrack, TrackMetadata } from "@/lib/types";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

// Energy 1–5 maps hue from blue (220) to red (0).
// Busyness 1–5 adds saturation and lightness.
function trackColor(energy: number, busyness: number): string {
  const hue = 220 - (energy - 1) * 55;
  const sat = 50 + (busyness - 1) * 12;
  const light = 35 + (busyness - 1) * 7;
  return `hsl(${hue}, ${sat}%, ${light}%)`;
}

const UNTAGGED_COLOR = "#3f3f46"; // zinc-700

function resolveColor(meta?: TrackMetadata): string {
  if (!meta?.energyLevel) return UNTAGGED_COLOR;
  return trackColor(meta.energyLevel, meta.busyness ?? 1);
}

// ── Dot selector ─────────────────────────────────────────────────────────────

function DotSelector({
  value,
  onChange,
  color,
  title,
}: {
  value?: number;
  onChange: (v: number | undefined) => void;
  color: string;
  title: string;
}) {
  return (
    <div className="flex gap-0.5" title={title}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={(e) => {
            e.stopPropagation();
            onChange(n === value ? undefined : n);
          }}
          className="w-2.5 h-2.5 rounded-sm transition-all hover:scale-125"
          style={{
            backgroundColor: n <= (value ?? 0) ? color : UNTAGGED_COLOR,
          }}
        />
      ))}
    </div>
  );
}

// ── Arc bar ───────────────────────────────────────────────────────────────────

function SetArcBar({
  tracks,
  library,
  selectedSlotId,
}: {
  tracks: DJSetTrack[];
  library: Record<string, TrackMetadata>;
  selectedSlotId?: string;
}) {
  const total = tracks.reduce((acc, t) => acc + t.durationMs, 0);
  if (total === 0 || tracks.length === 0) return null;

  // Precompute cumulative left offsets for the selection overlay
  let cursor = 0;
  const positions = tracks.map((t) => {
    const widthPct = (t.durationMs / total) * 100;
    const leftPct = cursor;
    cursor += widthPct;
    return { slotId: t.slotId, widthPct, leftPct };
  });
  const selectedPos = positions.find((p) => p.slotId === selectedSlotId);

  return (
    <div className="mb-6">
      <div className="relative">
        <div className="flex h-5 rounded-lg overflow-hidden gap-px">
          {tracks.map((t) => {
            const meta = library[t.id];
            const color = resolveColor(meta);
            const widthPct = (t.durationMs / total) * 100;
            const label = meta?.energyLevel
              ? `${t.name} — E:${meta.energyLevel} B:${meta.busyness ?? "?"}`
              : `${t.name} — untagged`;
            return (
              <div
                key={t.slotId}
                title={label}
                style={{ width: `${widthPct}%`, backgroundColor: color, minWidth: 2 }}
              />
            );
          })}
        </div>
        {selectedPos && (
          <div
            style={{
              position: "absolute",
              left: `${selectedPos.leftPct}%`,
              width: `${selectedPos.widthPct}%`,
              top: -3,
              bottom: -3,
              border: "2px solid white",
              borderRadius: 3,
              pointerEvents: "none",
            }}
          />
        )}
      </div>
      <div className="flex items-center gap-4 mt-1.5">
        <div className="flex items-center gap-1">
          <div className="flex gap-px h-2">
            {[1, 2, 3, 4, 5].map((e) => (
              <div
                key={e}
                className="w-3 rounded-sm"
                style={{ backgroundColor: trackColor(e, 3) }}
              />
            ))}
          </div>
          <span className="text-xs text-zinc-600">energy</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex gap-px h-2">
            {[1, 2, 3, 4, 5].map((b) => (
              <div
                key={b}
                className="w-3 rounded-sm"
                style={{ backgroundColor: trackColor(3, b) }}
              />
            ))}
          </div>
          <span className="text-xs text-zinc-600">busyness</span>
        </div>
        <span className="text-xs text-zinc-700 ml-auto">
          {tracks.filter((t) => library[t.id]?.energyLevel).length}/{tracks.length} tagged
        </span>
      </div>
    </div>
  );
}

// ── Sortable track row ────────────────────────────────────────────────────────

function SortableTrackRow({
  track,
  index,
  metadata,
  isEnriching,
  isSelected,
  onSelect,
  onRemove,
  onMetaChange,
}: {
  track: DJSetTrack;
  index: number;
  metadata?: TrackMetadata;
  isEnriching?: boolean;
  isSelected?: boolean;
  onSelect: (slotId: string) => void;
  onRemove: (id: string) => void;
  onMetaChange: (id: string, patch: Partial<TrackMetadata>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: track.slotId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const color = resolveColor(metadata);

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 group">
      {/* Energy color stripe */}
      <div
        className="w-1 self-stretch rounded-full flex-shrink-0 transition-colors"
        style={{ backgroundColor: color }}
      />

      <div
        className={`flex-1 flex items-center gap-2 px-2 py-2 rounded-lg border transition-colors min-w-0 cursor-pointer ${
          isSelected
            ? "bg-zinc-800 border-zinc-600"
            : "bg-zinc-900 hover:bg-zinc-800 border-zinc-800"
        }`}
        onClick={() => onSelect(track.slotId)}
      >
        {/* Drag handle */}
        <span
          {...attributes}
          {...listeners}
          className="text-zinc-600 cursor-grab active:cursor-grabbing hover:text-zinc-400 transition-colors flex-shrink-0 text-sm"
        >
          ⠿
        </span>

        {/* Track number */}
        <span className="w-5 text-right text-xs text-zinc-600 flex-shrink-0">
          {index + 1}
        </span>

        {/* Album art */}
        {track.albumArt && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.albumArt}
            alt={track.albumName}
            className="w-9 h-9 rounded flex-shrink-0"
          />
        )}

        {/* Title + artist */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{track.name}</div>
          <div className="text-xs text-zinc-400 truncate">{track.artists.join(", ")}</div>
          {isEnriching && (
            <div className="text-xs text-zinc-600 animate-pulse">looking up…</div>
          )}
          {!isEnriching && metadata?.genre && metadata.genre.length > 0 && (
            <div className="flex gap-1 mt-0.5 flex-wrap">
              {metadata.genre.slice(0, 3).map((g) => (
                <span
                  key={g}
                  className="text-xs px-1.5 py-0 rounded bg-zinc-800 text-zinc-400 border border-zinc-700"
                >
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Duration */}
        <div className="text-xs text-zinc-600 flex-shrink-0">
          {formatDuration(track.durationMs)}
        </div>

        {/* Energy selector */}
        <DotSelector
          value={metadata?.energyLevel}
          color={color}
          title="Energy (1=ambient, 5=banger)"
          onChange={(v) => onMetaChange(track.id, { energyLevel: v })}
        />

        {/* Busyness selector */}
        <DotSelector
          value={metadata?.busyness}
          color="#a1a1aa" // zinc-400
          title="Busyness (1=minimal, 5=dense)"
          onChange={(v) => onMetaChange(track.id, { busyness: v })}
        />

        {/* Remove */}
        <button
          onClick={() => onRemove(track.slotId)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-red-400 text-lg leading-none flex-shrink-0"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SetBuilderPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const [set, setSet] = useState<DJSet | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [library, setLibrary] = useState<Record<string, TrackMetadata>>({});
  const [enriching, setEnriching] = useState<Set<string>>(new Set());
  const [selectedSlotId, setSelectedSlotId] = useState<string | undefined>();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    let s = getSet(id);
    if (s) {
      // Migrate old tracks that were saved before slotId existed
      const needsMigration = s.tracks.some((t) => !t.slotId);
      if (needsMigration) {
        s = { ...s, tracks: s.tracks.map((t) => ({ ...t, slotId: t.slotId ?? crypto.randomUUID() })) };
        saveSet(s);
      }
      setSet(s);
      setName(s.name);
    }
    setLibrary(getAllTrackMeta());
  }, [id]);

  // Auto-enrich tracks in this set that haven't been looked up yet
  useEffect(() => {
    if (!set) return;

    const lib = getAllTrackMeta();
    // Only enrich tracks that have never been attempted
    const toEnrich = set.tracks.filter((t) => !lib[t.id]?.mbEnriched);
    if (toEnrich.length === 0) return;

    setEnriching(new Set(toEnrich.map((t) => t.id)));

    let cancelled = false;

    (async () => {
      for (const track of toEnrich) {
        if (cancelled) break;
        try {
          const res = await fetch("/api/enrich", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ spotifyId: track.id, isrc: track.isrc }),
          });
          const data = await res.json();
          if (!data.error) {
            setTrackMeta(track.id, {
              spotifyId: track.id,
              isrc: data.isrc,
              mbid: data.mbid,
              genre: data.genres,
              tags: data.tags,
              mbEnriched: true,
            });
          } else {
            setTrackMeta(track.id, { spotifyId: track.id, mbEnriched: true });
          }
        } catch {
          setTrackMeta(track.id, { spotifyId: track.id, mbEnriched: true });
        }
        setEnriching((prev) => { const next = new Set(prev); next.delete(track.id); return next; });
        setLibrary(getAllTrackMeta());
        if (!cancelled && toEnrich.indexOf(track) < toEnrich.length - 1) {
          await new Promise((r) => setTimeout(r, 1100));
        }
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set?.id]);

  function persist(updated: DJSet) {
    const s = { ...updated, updatedAt: new Date().toISOString() };
    saveSet(s);
    setSet(s);
  }

  function handleMetaChange(trackId: string, patch: Partial<TrackMetadata>) {
    setTrackMeta(trackId, patch);
    setLibrary(getAllTrackMeta());
  }

  function handleDragEnd(event: DragEndEvent) {
    if (!set) return;
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = set.tracks.findIndex((t) => t.slotId === active.id);
      const newIndex = set.tracks.findIndex((t) => t.slotId === over.id);
      persist({ ...set, tracks: arrayMove(set.tracks, oldIndex, newIndex) });
    }
  }

  function removeTrack(slotId: string) {
    if (!set) return;
    persist({ ...set, tracks: set.tracks.filter((t) => t.slotId !== slotId) });
  }

  function saveName() {
    if (!set || !name.trim()) return;
    persist({ ...set, name: name.trim() });
    setEditingName(false);
  }

  function handleDelete() {
    if (!set || !confirm(`Delete "${set.name}"?`)) return;
    deleteSet(set.id);
    router.push("/sets");
  }

  if (!set) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 text-zinc-500">
        Set not found.{" "}
        <Link href="/sets" className="text-green-400 hover:underline">
          Back to sets
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1 min-w-0 mr-4">
          <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1">
            <Link href="/sets" className="hover:text-white transition-colors">
              DJ Sets
            </Link>
            {" / "}
          </div>
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                className="text-2xl font-bold bg-transparent border-b border-green-500 focus:outline-none flex-1"
              />
              <button
                onClick={saveName}
                className="text-sm text-green-400 hover:text-green-300"
              >
                Save
              </button>
            </div>
          ) : (
            <h1
              className="text-2xl font-bold cursor-pointer hover:text-green-400 transition-colors"
              onClick={() => setEditingName(true)}
            >
              {set.name}
            </h1>
          )}
          <div className="text-sm text-zinc-500 mt-1">
            {set.tracks.length} tracks
            {set.tracks.length > 0 && ` · ${totalDuration(set.tracks)}`}
          </div>
        </div>
        <button
          onClick={handleDelete}
          className="text-sm text-zinc-600 hover:text-red-400 transition-colors flex-shrink-0"
        >
          Delete set
        </button>
      </div>

      {/* Arc bar */}
      <SetArcBar tracks={set.tracks} library={library} selectedSlotId={selectedSlotId} />

      {/* Track list */}
      {set.tracks.length === 0 ? (
        <div className="text-center py-16 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
          <div className="text-3xl mb-2">🎵</div>
          <p>No tracks yet.</p>
          <p className="text-sm mt-1">
            Go to a{" "}
            <Link href="/playlists" className="text-green-400 hover:underline">
              playlist
            </Link>{" "}
            or{" "}
            <Link href="/search" className="text-green-400 hover:underline">
              search
            </Link>{" "}
            to add tracks.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={set.tracks.map((t) => t.slotId)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {set.tracks.map((track, i) => (
                <SortableTrackRow
                  key={track.slotId}
                  track={track}
                  index={i}
                  metadata={library[track.id]}
                  isEnriching={enriching.has(track.id)}
                  isSelected={selectedSlotId === track.slotId}
                  onSelect={(slotId) => setSelectedSlotId((prev) => prev === slotId ? undefined : slotId)}
                  onRemove={removeTrack}
                  onMetaChange={handleMetaChange}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
