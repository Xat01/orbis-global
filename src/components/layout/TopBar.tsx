"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, MapPin, Moon, Search, Sun } from "lucide-react";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/States";
import { relativeTime } from "@/lib/util/time";
import Link from "next/link";

interface OverviewMeta {
  generatedAt: string;
  stale: boolean;
  fixtureMode: boolean;
  aiConfigured: boolean;
}

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const { prefs, hydrated, setTheme } = usePreferences();
  const [q, setQ] = useState("");
  const [meta, setMeta] = useState<OverviewMeta | null>(null);
  // Mirrors what is actually applied to <html data-theme> so the icon is
  // correct even when the preference is "system".
  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const read = () =>
      setEffectiveTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/overview")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j) {
          setMeta({
            generatedAt: j.generatedAt,
            stale: j.stale,
            fixtureMode: j.fixtureMode,
            aiConfigured: j.aiConfigured,
          });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    router.push(`/news?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur">
      <button
        className="rounded-md p-2 text-muted hover:bg-surface-2 lg:hidden"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <form onSubmit={submitSearch} className="relative max-w-md flex-1" role="search">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search events, places, sources…"
          className="pl-8"
          aria-label="Global search"
        />
      </form>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTheme(effectiveTheme === "dark" ? "light" : "dark")}
          className="rounded-md p-2 text-muted hover:bg-surface-2"
          aria-label={
            effectiveTheme === "dark" ? "Switch to light appearance" : "Switch to dark appearance"
          }
          aria-pressed={effectiveTheme === "dark"}
          title={
            effectiveTheme === "dark"
              ? "Switch to light appearance"
              : "Switch to dark appearance"
          }
        >
          {effectiveTheme === "dark" ? (
            <Sun className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        {meta?.fixtureMode ? (
          <Badge tone="amber" title="Data served from test fixtures (ORBIS_E2E=1)">TEST FIXTURE MODE</Badge>
        ) : null}
        {meta ? (
          <Badge tone={meta.stale ? "amber" : "green"} title="Time since last successful ingestion">
            {meta.stale ? (
              <>stale · updated {relativeTime(meta.generatedAt)}</>
            ) : (
              <>updated {relativeTime(meta.generatedAt)}</>
            )}
          </Badge>
        ) : (
          <Spinner />
        )}
        <Badge tone={meta?.aiConfigured ? "blue" : "neutral"} title="AI summarization status">
          {meta ? (meta.aiConfigured ? "AI summaries on" : "AI off · basic summaries") : "…"}
        </Badge>
        <Link
          href="/location"
          className="hidden items-center gap-1 rounded-md border border-line px-2 py-1 text-xs text-muted hover:bg-surface-2 sm:flex"
        >
          <MapPin className="h-3.5 w-3.5" />
          {hydrated && prefs.location ? prefs.location.name : "Set location"}
        </Link>
      </div>
    </header>
  );
}
