import Link from "next/link";

export default function SignInPrompt() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="text-4xl">🎛️</div>
      <h1 className="text-2xl font-bold">Spotify Slayer</h1>
      <p className="text-zinc-400 text-sm">Connect your Spotify account to get started.</p>
      <Link
        href="/api/auth/signin/spotify"
        className="bg-green-500 hover:bg-green-400 text-black font-semibold px-6 py-2.5 rounded-full transition-colors"
      >
        Connect Spotify
      </Link>
    </div>
  );
}
