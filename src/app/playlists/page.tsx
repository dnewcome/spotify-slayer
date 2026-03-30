import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getPlaylists, SpotifyPlaylist } from "@/lib/spotify";
import Link from "next/link";

export default async function PlaylistsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) redirect("/api/auth/signin");

  const playlists: SpotifyPlaylist[] = await getPlaylists(session.accessToken);
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Your Playlists</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {playlists.map((pl) => (
          <Link
            key={pl.id}
            href={`/playlists/${pl.id}`}
            className="group bg-zinc-900 rounded-xl p-3 border border-zinc-800 hover:border-zinc-600 transition-colors"
          >
            <div className="aspect-square mb-3 rounded-lg overflow-hidden bg-zinc-800">
              {pl.images?.[0]?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pl.images[0].url}
                  alt={pl.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600 text-3xl">
                  ♪
                </div>
              )}
            </div>
            <div className="text-sm font-medium truncate group-hover:text-green-400 transition-colors">
              {pl.name}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">{pl.items?.total ?? pl.tracks?.total ?? 0} tracks</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
