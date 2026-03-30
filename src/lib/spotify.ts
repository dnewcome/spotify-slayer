const SPOTIFY_BASE = "https://api.spotify.com/v1";

async function spotifyFetch(path: string, accessToken: string, options: RequestInit = {}) {
  const res = await fetch(`${SPOTIFY_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`Spotify API ${res.status} on ${path}:`, JSON.stringify(err));
    throw new Error(err.error?.message ?? `Spotify API error: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function getPlaylists(accessToken: string) {
  const data = await spotifyFetch("/me/playlists?limit=50", accessToken);
  return data.items;
}

export async function getPlaylist(accessToken: string, id: string) {
  return spotifyFetch(`/playlists/${id}`, accessToken);
}

export async function getPlaylistTracks(accessToken: string, id: string) {
  const items: Record<string, unknown>[] = [];
  let url = `/playlists/${id}/items?limit=100`;
  while (url) {
    const data = await spotifyFetch(url, accessToken);
    items.push(...data.items);
    url = data.next ? data.next.replace(SPOTIFY_BASE, "") : "";
  }
  return items;
}

export async function getRecentlyPlayed(accessToken: string, limit = 50) {
  const data = await spotifyFetch(`/me/player/recently-played?limit=${limit}`, accessToken);
  return data.items;
}

export async function getCurrentTrack(accessToken: string) {
  return spotifyFetch("/me/player/currently-playing", accessToken);
}

export async function searchTracks(accessToken: string, query: string, limit = 20) {
  const data = await spotifyFetch(
    `/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
    accessToken
  );
  return data.tracks.items;
}

export async function createPlaylist(
  accessToken: string,
  userId: string,
  name: string,
  description: string
) {
  return spotifyFetch(`/users/${userId}/playlists`, accessToken, {
    method: "POST",
    body: JSON.stringify({ name, description, public: false }),
  });
}

export async function addTracksToPlaylist(
  accessToken: string,
  playlistId: string,
  uris: string[]
) {
  return spotifyFetch(`/playlists/${playlistId}/tracks`, accessToken, {
    method: "POST",
    body: JSON.stringify({ uris }),
  });
}

// Types
export interface SpotifyTrack {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  type?: string;
  artists: { id: string; name: string }[];
  album: {
    id: string;
    name: string;
    images: { url: string; width: number; height: number }[];
  };
  external_ids?: { isrc?: string };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  images: { url: string }[];
  items: { total: number };
  tracks?: { total: number };
  owner: { id: string; display_name: string };
}

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace SpotifyApi {
  interface PagingObject<T> {
    items: T[];
    next: string | null;
    total: number;
    limit: number;
    offset: number;
  }
  interface PlaylistTrackObject {
    track: SpotifyTrack | null;
    added_at: string;
  }
}
