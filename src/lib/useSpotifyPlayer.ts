"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

export interface PlayerState {
  position: number;
  duration: number;
  paused: boolean;
  trackUri: string;
  trackName: string;
}

export function useSpotifyPlayer(enabled: boolean) {
  const { data: session } = useSession();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [playerState, setPlayerState] = useState<PlayerState | null>(null);

  const playerRef = useRef<Spotify.Player | null>(null);
  const tokenRef = useRef<string>("");

  useEffect(() => {
    tokenRef.current = (session?.accessToken as string) ?? "";
  }, [session?.accessToken]);

  useEffect(() => {
    if (!enabled || !session?.accessToken) return;

    if (!document.getElementById("spotify-sdk")) {
      const script = document.createElement("script");
      script.id = "spotify-sdk";
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      document.body.appendChild(script);
    }

    function initPlayer() {
      const player = new window.Spotify.Player({
        name: "Spotify Slayer",
        getOAuthToken: (cb) => cb(tokenRef.current),
        volume: 0.8,
      });

      player.addListener("ready", ({ device_id }) => {
        setDeviceId(device_id);
        // Transfer playback to this device so Spotify's backend registers it.
        // Without this, the first play command returns 404 "Device not found".
        setTimeout(() => {
          fetch("https://api.spotify.com/v1/me/player", {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${tokenRef.current}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ device_ids: [device_id], play: false }),
          }).then(() => setIsReady(true));
        }, 500);
      });

      player.addListener("not_ready", () => {
        setIsReady(false);
      });

      player.addListener("player_state_changed", (state) => {
        if (!state) return;
        setPlayerState({
          position: state.position,
          duration: state.duration,
          paused: state.paused,
          trackUri: state.track_window.current_track.uri,
          trackName: state.track_window.current_track.name,
        });
      });

      player.addListener("authentication_error", (e) => console.error("[player] auth error:", e));
      player.addListener("account_error", (e) => console.error("[player] account error (Premium required):", e));

      player.connect();
      playerRef.current = player;
    }

    if (window.Spotify) {
      initPlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = initPlayer;
    }

    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
      setIsReady(false);
      setDeviceId(null);
      setPlayerState(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, !!session?.accessToken]);

  async function play(uri: string, positionMs = 0) {
    if (!deviceId || !session?.accessToken) return;
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: [uri], position_ms: positionMs }),
    });
  }

  async function pause() {
    await playerRef.current?.pause();
  }

  async function resume() {
    await playerRef.current?.resume();
  }

  async function seek(ms: number) {
    await playerRef.current?.seek(ms);
  }

  async function getCurrentPosition(): Promise<number | null> {
    const state = await playerRef.current?.getCurrentState();
    return state?.position ?? null;
  }

  return { isReady, deviceId, playerState, play, pause, resume, seek, getCurrentPosition };
}
