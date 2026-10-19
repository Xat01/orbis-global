"use client";

import { useState } from "react";
import type { BriefingMode, Region, ThemeMode, Topic } from "@/lib/types";
import { REGIONS, TOPICS } from "@/lib/types";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { useApi } from "@/hooks/useApi";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Label, Select } from "@/components/ui/Input";

export default function SettingsPage() {
  const {
    prefs,
    setBriefingMode,
    setTheme,
    setTopics,
    setRegions,
    clearLocation,
    resetAll,
    hydrated,
  } = usePreferences();
  const { data } = useApi<{ aiConfigured: boolean; fixtureMode: boolean }>("/api/overview");
  const [confirmReset, setConfirmReset] = useState(false);

  function toggleTopic(t: Topic) {
    setTopics(prefs.topics.includes(t) ? prefs.topics.filter((x) => x !== t) : [...prefs.topics, t]);
  }
  function toggleRegion(r: Region) {
    setRegions(prefs.regions.includes(r) ? prefs.regions.filter((x) => x !== r) : [...prefs.regions, r]);
  }

  const aiConfigured = data?.aiConfigured ?? false;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">Settings</h1>
        <p className="text-sm text-muted">
          Preferences are stored in this browser only and are never transmitted.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Briefing length</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="briefing-mode">Default briefing mode</Label>
          <Select
            id="briefing-mode"
            className="max-w-xs"
            value={prefs.briefingMode}
            onChange={(e) => setBriefingMode(e.target.value as BriefingMode)}
          >
            <option value="quick">Quick Brief — key facts and major uncertainties</option>
            <option value="standard">Standard Brief — full structured briefing</option>
            <option value="detailed">Detailed Brief — expanded context and limitations</option>
          </Select>
          <p className="mt-1 text-[11px] text-muted">
            Briefing length never changes the certainty of the underlying facts.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="theme-mode">Theme</Label>
          <Select
            id="theme-mode"
            className="max-w-xs"
            value={prefs.theme}
            onChange={(e) => setTheme(e.target.value as ThemeMode)}
          >
            <option value="system">Match system</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
          <p className="mt-1 text-[11px] text-muted">
            Stored in this browser only. The toggle in the top bar switches light and dark
            directly; &quot;Match system&quot; follows your operating system.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferred topics and regions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Topics (used to weight relevance)</Label>
            <div className="flex flex-wrap gap-1.5">
              {TOPICS.map((t) => (
                <button
                  key={t}
                  onClick={() => toggleTopic(t)}
                  aria-pressed={prefs.topics.includes(t)}
                  className={`rounded border px-2 py-0.5 text-[11px] ${
                    prefs.topics.includes(t)
                      ? "border-accent bg-accent text-white"
                      : "border-line text-muted hover:bg-surface-2"
                  }`}
                >
                  {t.replace(/-/g, " ")}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Regions (used to weight relevance)</Label>
            <div className="flex flex-wrap gap-1.5">
              {REGIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => toggleRegion(r)}
                  aria-pressed={prefs.regions.includes(r)}
                  className={`rounded border px-2 py-0.5 text-[11px] ${
                    prefs.regions.includes(r)
                      ? "border-forest bg-forest text-white"
                      : "border-line text-muted hover:bg-surface-2"
                  }`}
                >
                  {r.replace(/-/g, " ")}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {hydrated && prefs.location ? (
            <>
              <Badge tone="dark">
                {prefs.location.name} · {prefs.location.country} · {prefs.location.precision}-level
              </Badge>
              <Button variant="outline" size="sm" onClick={clearLocation}>
                Clear location
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted">No location set. Personalisation is optional.</p>
          )}
          <a href="/location" className="text-xs text-accent hover:underline">
            change location →
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI summarisation</CardTitle>
          <Badge tone={aiConfigured ? "blue" : "neutral"}>
            {aiConfigured ? "configured" : "not configured"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            {aiConfigured
              ? "An OpenAI-compatible provider is configured server-side. Briefings are AI-generated, schema-validated and grounded in supplied source excerpts."
              : "No AI provider is configured. Briefings use the deterministic engine and are labelled “basic summary”. To enable AI, set AI_BASE_URL, AI_API_KEY and AI_MODEL in .env.local (see .env.example) and restart the server."}
          </p>
          <p className="text-[11px] text-muted">
            API keys are read server-side only and are never exposed to the browser. Source text is
            treated as untrusted data.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data controls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted">
            Saved items, alerts, preferences and location live in this browser&apos;s localStorage.
            Ingested intelligence snapshots are cached on the local server under{" "}
            <code className="font-mono text-xs">.orbis-cache/</code> and contain no personal data.
          </p>
          {confirmReset ? (
            <div className="flex flex-wrap items-center gap-2 rounded border border-danger/40 bg-red-50 p-2.5">
              <p className="text-xs text-danger">
                This deletes all saved items, alerts and preferences in this browser. Continue?
              </p>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  resetAll();
                  setConfirmReset(false);
                }}
              >
                Yes, delete everything
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmReset(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setConfirmReset(true)}>
              Clear all local data
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About this instance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-xs text-muted">
          <p>ORBIS runs locally. No deployment, no public tunnel, no external analytics.</p>
          <p>
            Ingestion model: on-demand with a 20-minute freshness window and stale-while-revalidate
            refresh; manual refresh via <code className="font-mono">POST /api/ingest</code> with a
            Bearer token (INGEST_TOKEN).
          </p>
          <p>
            Data source list and scoring methodology:{" "}
            <a href="/sources" className="text-accent hover:underline">
              Sources &amp; Methodology
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
