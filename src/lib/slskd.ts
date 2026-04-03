// Client-side slskd API wrapper.
// All calls go directly from the browser to the user's local slskd instance.
// Requires slskd CORS config to allow the hosted app origin.

import { SlskdResult } from "./types";
import { getSlskdSettings } from "./slskdSettings";

const AUDIO_EXTS = new Set([".flac", ".mp3", ".wav", ".aac", ".ogg", ".m4a", ".aiff", ".wv"]);

function formatFromFilename(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return ext.slice(1).toUpperCase();
}

function isAudio(filename: string): boolean {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return AUDIO_EXTS.has(ext);
}

function sortResults(results: SlskdResult[]): SlskdResult[] {
  return [...results].sort((a, b) => {
    const af = a.format;
    const bf = b.format;
    if (af === "FLAC" && bf !== "FLAC") return -1;
    if (bf === "FLAC" && af !== "FLAC") return 1;
    if (af === "FLAC" && bf === "FLAC") return b.size - a.size;
    if (af === "MP3" && bf !== "MP3") return -1;
    if (bf === "MP3" && af !== "MP3") return 1;
    if (af === "MP3" && bf === "MP3") return (b.bitRate ?? 0) - (a.bitRate ?? 0);
    return b.size - a.size;
  });
}

function settings() {
  const s = getSlskdSettings();
  if (!s?.url) throw new Error("slskd not configured");
  return s;
}

function headers(apiKey: string): HeadersInit {
  return { "X-API-Key": apiKey, "Content-Type": "application/json" };
}

// Start a search. Returns the search ID.
export async function slskdSearch(artist: string, title: string): Promise<{ searchId: string }> {
  const { url, apiKey } = settings();
  const res = await fetch(`${url}/api/v0/searches`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({
      searchText: `${artist} ${title}`,
      fileLimit: 100,
      responseLimit: 20,
      searchTimeout: 10000,
    }),
  });
  if (!res.ok) throw new Error(`slskd search failed: ${res.status}`);
  const data = await res.json();
  return { searchId: data.id };
}

// Poll a search for results.
export async function slskdPollSearch(
  searchId: string
): Promise<{ state: string; results: SlskdResult[]; done: boolean }> {
  const { url, apiKey } = settings();
  const res = await fetch(
    `${url}/api/v0/searches/${encodeURIComponent(searchId)}?includeResponses=true`,
    { headers: { "X-API-Key": apiKey } }
  );
  if (!res.ok) throw new Error(`slskd poll failed: ${res.status}`);
  const data = await res.json();
  const done: boolean = (data.state as string)?.startsWith("Completed") ?? false;

  const flat: SlskdResult[] = [];
  for (const response of data.responses ?? []) {
    for (const file of response.files ?? []) {
      if (!isAudio(file.filename)) continue;
      flat.push({
        username: response.username,
        filename: file.filename,
        size: file.size,
        bitRate: file.bitRate ?? null,
        format: formatFromFilename(file.filename),
      });
    }
  }
  return { state: data.state, results: sortResults(flat), done };
}

// Enqueue a download. Returns transferId and username.
export async function slskdDownload(
  username: string,
  filename: string,
  size: number
): Promise<{ transferId: string; username: string }> {
  const { url, apiKey } = settings();
  const res = await fetch(
    `${url}/api/v0/transfers/downloads/${encodeURIComponent(username)}`,
    {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify([{ filename, size }]),
    }
  );
  if (!res.ok) throw new Error(`slskd download failed: ${res.status}`);
  const data = await res.json();
  const transfer = data.enqueued?.[0];
  if (!transfer) throw new Error("slskd: nothing enqueued");
  return { transferId: transfer.id, username };
}

export interface TransferStatus {
  state: string;
  rawState: string;
  bytesTransferred: number;
  size: number;
  filename: string;
  progress: number;
}

// Poll a transfer for status.
export async function slskdPollTransfer(
  transferId: string,
  username: string
): Promise<TransferStatus> {
  const { url, apiKey } = settings();
  const res = await fetch(
    `${url}/api/v0/transfers/downloads/${encodeURIComponent(username)}`,
    { headers: { "X-API-Key": apiKey } }
  );
  if (!res.ok) throw new Error(`slskd transfer poll failed: ${res.status}`);
  const data = await res.json();

  const files = (data.directories ?? []).flatMap(
    (d: { files: unknown[] }) => d.files ?? []
  ) as Array<{ id: string; state: string; bytesTransferred: number; size: number; filename: string }>;

  const transfer = files.find((f) => f.id === transferId);
  if (!transfer) throw new Error("transfer not found");

  const progress =
    transfer.size > 0 ? Math.round((transfer.bytesTransferred / transfer.size) * 100) : 0;

  const state = transfer.state as string;
  const normalizedState = state.startsWith("Completed") ? "Completed"
    : state.startsWith("Errored") ? "Errored"
    : state.startsWith("Cancelled") ? "Cancelled"
    : state;

  return {
    state: normalizedState,
    rawState: transfer.state,
    bytesTransferred: transfer.bytesTransferred,
    size: transfer.size,
    filename: transfer.filename,
    progress,
  };
}

// Cancel a transfer.
export async function slskdCancelTransfer(
  transferId: string,
  username: string
): Promise<void> {
  const { url, apiKey } = settings();
  await fetch(
    `${url}/api/v0/transfers/downloads/${encodeURIComponent(username)}/${encodeURIComponent(transferId)}`,
    { method: "DELETE", headers: { "X-API-Key": apiKey } }
  ).catch(() => {}); // best-effort
}
