import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getPlaylist, getPlaylistTracks, SpotifyTrack } from "@/lib/spotify";
import PlaylistDetail from "./PlaylistDetail";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PlaylistPage({ params }: Props) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) redirect("/api/auth/signin");

  const [playlist, rawTracks] = await Promise.all([
    getPlaylist(session.accessToken, id),
    getPlaylistTracks(session.accessToken, id),
  ]);

  const tracks: SpotifyTrack[] = rawTracks
    .map((item: { track?: SpotifyTrack | null; item?: SpotifyTrack | null }) => item.item ?? item.track)
    .filter((t: SpotifyTrack | null | undefined): t is SpotifyTrack => t != null && t.type === "track");

  return <PlaylistDetail playlist={playlist} tracks={tracks} />;
}
