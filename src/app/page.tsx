import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRecentlyPlayed, getCurrentTrack } from "@/lib/spotify";
import RecentlyPlayed from "@/components/RecentlyPlayed";
import SignInPrompt from "@/components/SignInPrompt";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return <SignInPrompt />;

  const [recent, current] = await Promise.allSettled([
    getRecentlyPlayed(session.accessToken, 20),
    getCurrentTrack(session.accessToken),
  ]);

  const recentTracks = recent.status === "fulfilled" ? recent.value : [];
  const currentTrack = current.status === "fulfilled" ? current.value : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {currentTrack?.item && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
            Now Playing
          </h2>
          <div className="flex items-center gap-4 bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            {currentTrack.item.album?.images?.[0]?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentTrack.item.album.images[0].url}
                alt={currentTrack.item.album.name}
                className="w-16 h-16 rounded-lg"
              />
            )}
            <div>
              <div className="font-semibold">{currentTrack.item.name}</div>
              <div className="text-sm text-zinc-400">
                {currentTrack.item.artists?.map((a: { name: string }) => a.name).join(", ")}
              </div>
              <div className="text-xs text-zinc-600 mt-0.5">{currentTrack.item.album?.name}</div>
            </div>
            <div className="ml-auto">
              <span className="inline-flex items-center gap-1.5 text-xs text-green-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                Live
              </span>
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
          Recently Played
        </h2>
        <RecentlyPlayed items={recentTracks} />
      </section>
    </div>
  );
}
