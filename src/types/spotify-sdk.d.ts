declare global {
  namespace Spotify {
    interface WebPlaybackTrack {
      id: string;
      uri: string;
      name: string;
      duration_ms: number;
      artists: { name: string; uri: string }[];
      album: { name: string; images: { url: string }[] };
    }
    interface WebPlaybackState {
      position: number;
      duration: number;
      paused: boolean;
      track_window: { current_track: WebPlaybackTrack };
    }
    interface WebPlaybackPlayer {
      device_id: string;
    }
    class Player {
      constructor(options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      });
      connect(): Promise<boolean>;
      disconnect(): void;
      addListener(event: "ready" | "not_ready", cb: (p: WebPlaybackPlayer) => void): void;
      addListener(event: "player_state_changed", cb: (s: WebPlaybackState | null) => void): void;
      addListener(event: string, cb: (data: unknown) => void): void;
      getCurrentState(): Promise<WebPlaybackState | null>;
      seek(positionMs: number): Promise<void>;
      pause(): Promise<void>;
      resume(): Promise<void>;
    }
  }
  interface Window {
    Spotify: { Player: typeof Spotify.Player };
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}
export {};
