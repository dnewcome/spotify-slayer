"use client";

import { SpotifyTrack } from "@/lib/spotify";
import { formatDuration } from "@/lib/sets";

interface Props {
  track: SpotifyTrack;
  subtitle?: string;
  onAdd?: (track: SpotifyTrack) => void;
  actions?: React.ReactNode;
}

export default function TrackRow({ track, subtitle, onAdd, actions }: Props) {
  const art = track.album?.images?.find((i) => i.width <= 64) ?? track.album?.images?.[0];

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50 group transition-colors">
      {art?.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={art.url} alt={track.album.name} className="w-10 h-10 rounded flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{track.name}</div>
        <div className="text-xs text-zinc-400 truncate">
          {subtitle ?? track.artists.map((a) => a.name).join(", ")}
          {subtitle && (
            <span className="ml-2 text-zinc-600">
              {track.artists.map((a) => a.name).join(", ")}
            </span>
          )}
        </div>
      </div>
      <div className="text-xs text-zinc-600 flex-shrink-0">
        {formatDuration(track.duration_ms)}
      </div>
      {actions}
      {onAdd && (
        <button
          onClick={() => onAdd(track)}
          className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-xs bg-green-500 hover:bg-green-400 text-black font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
        >
          + Add
        </button>
      )}
    </div>
  );
}
