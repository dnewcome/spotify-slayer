"use client";

import { useEffect, useState } from "react";
import { getSlskdSettings, saveSlskdSettings, clearSlskdSettings } from "@/lib/slskdSettings";

export default function SettingsPage() {
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);

  useEffect(() => {
    const s = getSlskdSettings();
    if (s) { setUrl(s.url); setApiKey(s.apiKey); }
  }, []);

  function handleSave() {
    if (url.trim()) {
      saveSlskdSettings({ url: url.trim(), apiKey: apiKey.trim() });
    } else {
      clearSlskdSettings();
    }
    setSaved(true);
    setTestResult(null);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${url.trim()}/api/v0/application`, {
        headers: { "X-API-Key": apiKey.trim() },
      });
      setTestResult(res.ok ? "ok" : "fail");
    } catch {
      setTestResult("fail");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">
          slskd connection
        </h2>
        <p className="text-sm text-zinc-500 mb-4">
          Point this to your local{" "}
          <a
            href="https://github.com/slskd/slskd"
            target="_blank"
            rel="noopener noreferrer"
            className="text-zinc-400 hover:text-white underline"
          >
            slskd
          </a>{" "}
          instance to enable Soulseek downloads. The app talks to slskd directly from your browser — your files never touch this server.
        </p>
        <p className="text-sm text-zinc-500 mb-4">
          slskd has no built-in CORS support, so your browser will be blocked from reaching it directly unless you put a reverse proxy in front that adds the right headers. A minimal Caddy config works well:
        </p>
        <pre className="text-xs bg-zinc-900 border border-zinc-800 rounded-lg p-3 mb-4 text-zinc-300 overflow-x-auto">
{`# Caddyfile
localhost:5031 {
  header Access-Control-Allow-Origin "${typeof window !== "undefined" ? window.location.origin : "https://your-app.example.com"}"
  header Access-Control-Allow-Headers "X-API-Key, Content-Type"
  header Access-Control-Allow-Methods "GET, POST, DELETE, OPTIONS"
  reverse_proxy localhost:5030
}`}
        </pre>
        <p className="text-sm text-zinc-500 mb-5">
          Then point the URL below at the proxy port (<code className="text-zinc-300 bg-zinc-800 px-1 rounded">http://localhost:5031</code>) instead of slskd directly.
        </p>

        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">slskd URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:5030"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 text-zinc-200 placeholder-zinc-600"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">API key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="from slskd web settings"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500 text-zinc-200 placeholder-zinc-600"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              className="bg-green-500 hover:bg-green-400 text-black font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
            >
              {saved ? "Saved" : "Save"}
            </button>
            <button
              onClick={handleTest}
              disabled={!url.trim() || testing}
              className="border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {testing ? "Testing…" : "Test connection"}
            </button>
            {testResult === "ok" && (
              <span className="text-sm text-green-400">Connected</span>
            )}
            {testResult === "fail" && (
              <span className="text-sm text-red-400">Could not connect — check URL, API key, and CORS</span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
