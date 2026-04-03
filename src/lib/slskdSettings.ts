const SETTINGS_KEY = "slskd_settings";

export interface SlskdSettings {
  url: string;    // e.g. "http://localhost:5030"
  apiKey: string;
}

export function getSlskdSettings(): SlskdSettings | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SlskdSettings;
  } catch {
    return null;
  }
}

export function saveSlskdSettings(settings: SlskdSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function clearSlskdSettings(): void {
  localStorage.removeItem(SETTINGS_KEY);
}

export function isSlskdConfigured(): boolean {
  const s = getSlskdSettings();
  return !!s?.url?.trim();
}
