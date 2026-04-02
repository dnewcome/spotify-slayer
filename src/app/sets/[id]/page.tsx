"use client";

import { use, useEffect, useRef, useState } from "react";
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
import { getSet, saveSet, deleteSet, totalDuration, onAirDuration, hasInOutPoints, activeDurationMs, formatDuration } from "@/lib/sets";
import { getAllTrackMeta, setTrackMeta } from "@/lib/library";
import { DJSet, DJSetTrack, TrackMetadata } from "@/lib/types";
import { useSpotifyPlayer } from "@/lib/useSpotifyPlayer";
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

// ── In/Out point input ────────────────────────────────────────────────────────

function parseMmSs(s: string): number | undefined {
  const m = s.trim().match(/^(\d+):(\d{2})$/);
  if (!m) return undefined;
  return (parseInt(m[1]) * 60 + parseInt(m[2])) * 1000;
}

function formatMmSs(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function InOutInput({
  value,
  placeholder,
  onCommit,
}: {
  value?: number;
  placeholder: string;
  onCommit: (ms: number | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");

  function commit() {
    const trimmed = text.trim();
    onCommit(trimmed === "" ? undefined : parseMmSs(trimmed));
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setText(value !== undefined ? formatMmSs(value) : "");
          setEditing(true);
        }}
        className="text-xs font-mono w-10 text-center text-zinc-600 hover:text-zinc-300 transition-colors"
        title={placeholder === "in" ? "In point (mm:ss)" : "Out point (mm:ss)"}
      >
        {value !== undefined ? formatMmSs(value) : <span className="text-zinc-600">{placeholder}</span>}
      </button>
    );
  }

  return (
    <input
      autoFocus
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
      className="text-xs font-mono w-10 text-center bg-zinc-800 border border-zinc-600 rounded px-1 focus:outline-none focus:border-green-500"
      placeholder="0:00"
    />
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
  const program = tracks.reduce((acc, t) => acc + activeDurationMs(t), 0);
  if (program === 0 || tracks.length === 0) return null;

  // Precompute cumulative left offsets for the selection overlay
  let cursor = 0;
  const positions = tracks.map((t) => {
    const widthPct = (activeDurationMs(t) / program) * 100;
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
            const widthPct = (activeDurationMs(t) / program) * 100;
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
  isPlaying,
  playerEnabled,
  onSelect,
  onRemove,
  onMetaChange,
  onTrackChange,
  onPlay,
}: {
  track: DJSetTrack;
  index: number;
  metadata?: TrackMetadata;
  isEnriching?: boolean;
  isSelected?: boolean;
  isPlaying?: boolean;
  playerEnabled?: boolean;
  onSelect: (slotId: string) => void;
  onRemove: (slotId: string) => void;
  onMetaChange: (id: string, patch: Partial<TrackMetadata>) => void;
  onTrackChange: (slotId: string, patch: Partial<DJSetTrack>) => void;
  onPlay?: (track: DJSetTrack) => void;
}) {
  const [tagInput, setTagInput] = useState("");
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: track.slotId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const color = resolveColor(metadata);

  function addTag(raw: string) {
    const val = raw.trim().replace(/,+$/, "");
    if (!val) return;
    const newTags = [...new Set([...(metadata?.tags ?? []), val])];
    onMetaChange(track.id, { tags: newTags });
    setTagInput("");
  }

  function removeTag(tag: string) {
    onMetaChange(track.id, { tags: (metadata?.tags ?? []).filter((t) => t !== tag) });
  }

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col group">
      <div className="flex items-center gap-2">
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

        {/* Play button (only when player enabled) */}
        {playerEnabled && (
          <button
            onClick={(e) => { e.stopPropagation(); onPlay?.(track); }}
            className={`flex-shrink-0 text-xs w-5 h-5 flex items-center justify-center rounded-full transition-colors ${
              isPlaying
                ? "text-green-400 bg-green-950 border border-green-700"
                : "text-zinc-600 hover:text-green-400"
            }`}
            title="Play from in point"
          >
            {isPlaying ? "▶" : "▷"}
          </button>
        )}

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
          {!isEnriching && (() => {
            const allTags = [...new Set([...(metadata?.genre ?? []), ...(metadata?.tags ?? [])])];
            return allTags.length > 0 ? (
              <div className="flex gap-1 mt-0.5 flex-wrap">
                {allTags.slice(0, 4).map((g) => (
                  <span
                    key={g}
                    className="text-xs px-1.5 py-0 rounded bg-zinc-800 text-zinc-400 border border-zinc-700"
                  >
                    {g}
                  </span>
                ))}
              </div>
            ) : null;
          })()}
        </div>

        {/* Duration + in/out */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="text-xs text-zinc-600 w-9 text-right">
            {formatDuration(track.durationMs)}
          </div>
          <InOutInput
            value={track.inPoint}
            placeholder="in"
            onCommit={(ms) => onTrackChange(track.slotId, { inPoint: ms })}
          />
          <span className="text-zinc-700 text-xs">–</span>
          <InOutInput
            value={track.outPoint}
            placeholder="out"
            onCommit={(ms) => onTrackChange(track.slotId, { outPoint: ms })}
          />
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
      </div>{/* end row */}

      {/* Tag editor — shown when selected */}
      {isSelected && (
        <div
          className="ml-3 flex flex-wrap gap-1 items-center px-2 py-1.5 border-x border-b border-zinc-600 rounded-b-lg bg-zinc-800"
          onClick={(e) => e.stopPropagation()}
        >
          {(metadata?.tags ?? []).map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300 border border-zinc-600"
            >
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="text-zinc-500 hover:text-red-400 leading-none"
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            placeholder="add tag…"
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag(tagInput);
              }
              e.stopPropagation();
            }}
            className="text-xs bg-transparent border-b border-zinc-600 focus:border-zinc-400 focus:outline-none px-1 py-0.5 text-zinc-300 placeholder-zinc-600 w-24"
          />
        </div>
      )}
    </div>
  );
}

// ── Player bar ────────────────────────────────────────────────────────────────

function PlayerBar({
  tracks,
  playingSlotId,
  playerState,
  isReady,
  onPlayTrack,
  onPause,
  onResume,
  onSetIn,
  onSetOut,
  onSeek,
}: {
  tracks: DJSetTrack[];
  playingSlotId: string | null;
  playerState: ReturnType<typeof useSpotifyPlayer>["playerState"];
  isReady: boolean;
  onPlayTrack: (track: DJSetTrack) => void;
  onPause: () => void;
  onResume: () => void;
  onSetIn: () => void;
  onSetOut: () => void;
  onSeek: (ms: number) => void;
}) {
  if (!isReady) return null;

  const playingTrack = tracks.find((t) => t.slotId === playingSlotId);
  const paused = !playerState || playerState.paused;
  const position = playerState?.position ?? 0;
  const outPoint = playingTrack?.outPoint ?? playingTrack?.durationMs ?? 0;
  const inPoint = playingTrack?.inPoint ?? 0;
  const activeRange = outPoint - inPoint;
  const progressPct = activeRange > 0 ? Math.min(100, ((position - inPoint) / activeRange) * 100) : 0;

  const idx = playingSlotId ? tracks.findIndex((t) => t.slotId === playingSlotId) : -1;
  const prevTrack = idx > 0 ? tracks[idx - 1] : null;
  const nextTrack = idx >= 0 && idx < tracks.length - 1 ? tracks[idx + 1] : null;

  return (
    <div className="sticky bottom-0 mt-6 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 flex flex-col gap-2">
      {/* Progress bar — click to seek */}
      <div
        className="h-3 flex items-center cursor-pointer group"
        onClick={(e) => {
          if (!playingTrack) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const pct = (e.clientX - rect.left) / rect.width;
          const inPoint = playingTrack.inPoint ?? 0;
          const outPoint = playingTrack.outPoint ?? playingTrack.durationMs;
          onSeek(Math.round(inPoint + pct * (outPoint - inPoint)));
        }}
      >
        <div className="h-1 group-hover:h-2 transition-all bg-zinc-700 rounded-full overflow-hidden w-full">
          <div
            className="h-full bg-green-500 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Track info */}
        <div className="flex-1 min-w-0">
          {playingTrack ? (
            <>
              <div className="text-sm font-medium truncate">{playingTrack.name}</div>
              <div className="text-xs text-zinc-400 truncate">{playingTrack.artists.join(", ")}</div>
            </>
          ) : (
            <div className="text-sm text-zinc-500">No track playing</div>
          )}
        </div>

        {/* Position */}
        {playingTrack && (
          <div className="text-xs font-mono text-zinc-400 flex-shrink-0">
            {formatMmSs(position)} / {formatMmSs(outPoint)}
          </div>
        )}

        {/* Set In / Set Out */}
        {playingTrack && (
          <>
            <button
              onClick={onSetIn}
              title="Set in point to current position"
              className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-600 flex-shrink-0"
            >
              [in
            </button>
            <button
              onClick={onSetOut}
              title="Set out point to current position"
              className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-600 flex-shrink-0"
            >
              out]
            </button>
          </>
        )}

        {/* Prev */}
        <button
          onClick={() => prevTrack && onPlayTrack(prevTrack)}
          disabled={!prevTrack}
          className="text-zinc-400 hover:text-white disabled:opacity-20 flex-shrink-0 text-lg leading-none"
          title="Previous track"
        >
          ⏮
        </button>

        {/* Play / Pause */}
        <button
          onClick={() => {
            if (!playingTrack) return;
            paused ? onResume() : onPause();
          }}
          disabled={!playingTrack}
          className="w-9 h-9 rounded-full bg-green-500 hover:bg-green-400 disabled:opacity-20 flex items-center justify-center text-black flex-shrink-0"
        >
          {paused ? "▶" : "⏸"}
        </button>

        {/* Next */}
        <button
          onClick={() => nextTrack && onPlayTrack(nextTrack)}
          disabled={!nextTrack}
          className="text-zinc-400 hover:text-white disabled:opacity-20 flex-shrink-0 text-lg leading-none"
          title="Next track"
        >
          ⏭
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
  const [playerEnabled, setPlayerEnabled] = useState(false);
  const [playingSlotId, setPlayingSlotId] = useState<string | null>(null);

  const player = useSpotifyPlayer(playerEnabled);

  // Refs for auto-advance (avoids stale closures in interval)
  const setRef = useRef(set);
  useEffect(() => { setRef.current = set; }, [set]);
  const playingSlotIdRef = useRef(playingSlotId);
  useEffect(() => { playingSlotIdRef.current = playingSlotId; }, [playingSlotId]);
  const playerRef2 = useRef(player);
  useEffect(() => { playerRef2.current = player; }, [player]);
  const advancingRef = useRef(false);

  // Auto-advance: poll every 500ms, trigger next track when out point is hit
  useEffect(() => {
    const interval = setInterval(async () => {
      const slotId = playingSlotIdRef.current;
      const currentSet = setRef.current;
      const p = playerRef2.current;
      if (!slotId || !currentSet || advancingRef.current || !p.isReady) return;

      const position = await p.getCurrentPosition();
      if (position === null) return;

      const track = currentSet.tracks.find((t) => t.slotId === slotId);
      if (!track) return;

      const outPoint = track.outPoint ?? track.durationMs;
      if (position >= outPoint - 300) {
        advancingRef.current = true;
        const idx = currentSet.tracks.findIndex((t) => t.slotId === slotId);
        const next = currentSet.tracks[idx + 1];
        if (next) {
          await p.play(next.uri, next.inPoint ?? 0);
          setPlayingSlotId(next.slotId);
        } else {
          setPlayingSlotId(null);
        }
        setTimeout(() => { advancingRef.current = false; }, 1500);
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

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

  function handleTrackChange(slotId: string, patch: Partial<DJSetTrack>) {
    if (!set) return;
    persist({ ...set, tracks: set.tracks.map((t) => t.slotId === slotId ? { ...t, ...patch } : t) });
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

  async function playTrack(track: DJSetTrack) {
    await player.play(track.uri, track.inPoint ?? 0);
    setPlayingSlotId(track.slotId);
  }

  async function handleSetIn() {
    if (!playingSlotId) return;
    const pos = await player.getCurrentPosition();
    if (pos !== null) handleTrackChange(playingSlotId, { inPoint: pos });
  }

  async function handleSetOut() {
    if (!playingSlotId) return;
    const pos = await player.getCurrentPosition();
    if (pos !== null) handleTrackChange(playingSlotId, { outPoint: pos });
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
            {set.tracks.length} {set.tracks.length === 1 ? "track" : "tracks"}
            {set.tracks.length > 0 && ` · ${totalDuration(set.tracks)} program`}
            {set.tracks.length > 0 && hasInOutPoints(set.tracks) && (
              <span className="text-zinc-400"> · {onAirDuration(set.tracks)} on air</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setPlayerEnabled((v) => !v)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              playerEnabled
                ? player.isReady
                  ? "border-green-600 text-green-400 bg-green-950"
                  : "border-zinc-600 text-zinc-400 bg-zinc-800 animate-pulse"
                : "border-zinc-700 text-zinc-500 hover:text-zinc-300"
            }`}
            title={player.isReady ? "Player ready" : playerEnabled ? "Connecting…" : "Enable player"}
          >
            {player.isReady ? "▶ ready" : playerEnabled ? "▶ connecting…" : "▶ player"}
          </button>
          <button
            onClick={handleDelete}
            className="text-sm text-zinc-600 hover:text-red-400 transition-colors"
          >
            Delete set
          </button>
        </div>
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
                  isPlaying={playingSlotId === track.slotId}
                  playerEnabled={playerEnabled}
                  onSelect={(slotId) => setSelectedSlotId((prev) => prev === slotId ? undefined : slotId)}
                  onRemove={removeTrack}
                  onMetaChange={handleMetaChange}
                  onTrackChange={handleTrackChange}
                  onPlay={playTrack}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <PlayerBar
        tracks={set.tracks}
        playingSlotId={playingSlotId}
        playerState={player.playerState}
        isReady={player.isReady}
        onPlayTrack={playTrack}
        onPause={player.pause}
        onResume={player.resume}
        onSetIn={handleSetIn}
        onSetOut={handleSetOut}
        onSeek={player.seek}
      />
    </div>
  );
}
