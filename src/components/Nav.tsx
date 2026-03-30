"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

export default function Nav() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Home" },
    { href: "/playlists", label: "Playlists" },
    { href: "/sets", label: "DJ Sets" },
    { href: "/search", label: "Search" },
  ];

  return (
    <nav className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-green-400 font-bold text-lg tracking-tight">
            Spotify Slayer
          </Link>
          <div className="flex items-center gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  pathname === l.href
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div>
          {status === "loading" ? null : session ? (
            <div className="flex items-center gap-3">
              {session.user?.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt="" className="w-7 h-7 rounded-full" />
              )}
              <span className="text-sm text-zinc-300">{session.user?.name}</span>
              <button
                onClick={() => signOut()}
                className="text-sm text-zinc-500 hover:text-white transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/api/auth/signin/spotify"
              className="bg-green-500 hover:bg-green-400 text-black font-semibold text-sm px-4 py-1.5 rounded-full transition-colors"
            >
              Connect Spotify
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
