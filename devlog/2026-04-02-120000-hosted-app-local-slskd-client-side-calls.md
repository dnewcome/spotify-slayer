# Hosted app + local slskd via client-side API calls

_2026-04-02_

## What happened

Deploying to DigitalOcean exposed a fundamental architecture problem: the server-side slskd proxy routes assumed slskd was running on the same machine as the Next.js app, hardcoded to `localhost`. That obviously doesn't work when the app is hosted remotely and slskd is running on the user's own machine. The fix turns out to be cleaner than a relay: the browser can reach `localhost` directly even when the page is served from a remote host, so slskd calls moved entirely client-side. All four slskd interactions — search, poll, download, transfer polling — now live in `src/lib/slskd.ts` and go straight from the browser to whatever URL the user configures. The only friction is CORS, which slskd doesn't handle natively, so the settings page explains how to front it with a Caddy reverse proxy. Also fixed a separate deploy-breaker: the Spotify OAuth `redirect_uri` was hardcoded to `http://127.0.0.1:3000`, so every login on the hosted app redirected back to localhost. Now reads from `NEXTAUTH_URL`.

## Files touched

  - src/lib/slskd.ts (new)
  - src/lib/slskdSettings.ts (new)
  - src/app/settings/page.tsx (new)
  - src/components/Nav.tsx
  - src/app/sets/[id]/page.tsx
  - src/lib/auth.ts

## Tweet draft

Got the DJ set builder deploying to DigitalOcean. Two bugs: Spotify OAuth was hardcoded to redirect back to localhost, and slskd downloads assumed the daemon was on the same server. Fixed both — OAuth now reads from NEXTAUTH_URL, and slskd calls moved fully client-side so the browser talks directly to the user's local instance. Files never touch the hosted server. [link]

---

_commit: 46b8908_
