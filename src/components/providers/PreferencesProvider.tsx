"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { BriefingMode, Region, ThemeMode, Topic, UserPreferences } from "@/lib/types";
import { UserPreferencesSchema } from "@/lib/types";

// ---------------------------------------------------------------------------
// Browser-local state (localStorage only — nothing is transmitted).
//
//   orbis.prefs         → location, topics, regions, briefing mode, alert prefs
//   orbis.saved         → saved events/articles
//   orbis.alerts.read   → read alert IDs
//   orbis.alerts.dismissed → dismissed alert IDs
//
// This is deliberately NOT presented as server-side persistence: it is
// per-browser and can be cleared by the user at any time.
// ---------------------------------------------------------------------------

export interface SavedItem {
  id: string;
  kind: "event" | "article";
  title: string;
  url: string | null;
  snippet: string;
  savedAt: string;
}

const STORAGE_KEYS = {
  prefs: "orbis.prefs.v1",
  saved: "orbis.saved.v1",
  read: "orbis.alerts.read.v1",
  dismissed: "orbis.alerts.dismissed.v1",
} as const;

export const DEFAULT_PREFERENCES: UserPreferences = {
  location: null,
  topics: [],
  regions: [],
  briefingMode: "standard",
  theme: "system",
  alerts: {
    enabled: true,
    regions: [],
    topics: [],
    minSignificance: "notable",
  },
};

interface PreferencesContextValue {
  prefs: UserPreferences;
  hydrated: boolean;
  saved: SavedItem[];
  readAlerts: Set<string>;
  dismissedAlerts: Set<string>;
  setLocation: (location: NonNullable<UserPreferences["location"]>) => void;
  clearLocation: () => void;
  setTopics: (topics: Topic[]) => void;
  setRegions: (regions: Region[]) => void;
  setBriefingMode: (mode: BriefingMode) => void;
  setTheme: (mode: ThemeMode) => void;
  setAlertPrefs: (alerts: UserPreferences["alerts"]) => void;
  toggleSaved: (item: Omit<SavedItem, "savedAt">) => void;
  isSaved: (id: string) => boolean;
  markAlertRead: (id: string) => void;
  markAllAlertsRead: (ids: string[]) => void;
  dismissAlert: (id: string) => void;
  resetAll: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable (private mode / quota) — degrade gracefully.
  }
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [readAlerts, setReadAlerts] = useState<Set<string>>(new Set());
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount (avoids SSR/client mismatch).
  /* eslint-disable react-hooks/set-state-in-effect -- one-time hydration from an
     external store (localStorage) that is unavailable during SSR; a setState in
     the mount effect is the intended pattern here. */
  useEffect(() => {
    const storedPrefs = readJson<unknown>(STORAGE_KEYS.prefs, null);
    const parsed = UserPreferencesSchema.safeParse(storedPrefs);
    if (parsed.success) setPrefs(parsed.data);
    setSaved(readJson<SavedItem[]>(STORAGE_KEYS.saved, []));
    setReadAlerts(new Set(readJson<string[]>(STORAGE_KEYS.read, [])));
    setDismissedAlerts(new Set(readJson<string[]>(STORAGE_KEYS.dismissed, [])));
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const persistPrefs = useCallback((next: UserPreferences) => {
    setPrefs(next);
    writeJson(STORAGE_KEYS.prefs, next);
  }, []);

  // Apply the theme to <html data-theme>. The inline bootstrap script in the
  // root layout already set the correct value before paint; this keeps it in
  // sync afterwards and follows the OS when the preference is "system".
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const effective =
        prefs.theme === "system" ? (mql.matches ? "dark" : "light") : prefs.theme;
      document.documentElement.dataset.theme = effective;
    };
    apply();
    if (prefs.theme !== "system") return;
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, [prefs.theme]);

  const value = useMemo<PreferencesContextValue>(() => {
    return {
      prefs,
      hydrated,
      saved,
      readAlerts,
      dismissedAlerts,
      setLocation: (location) => persistPrefs({ ...prefs, location }),
      clearLocation: () => persistPrefs({ ...prefs, location: null }),
      setTopics: (topics) => persistPrefs({ ...prefs, topics }),
      setRegions: (regions) => persistPrefs({ ...prefs, regions }),
      setBriefingMode: (briefingMode) => persistPrefs({ ...prefs, briefingMode }),
      setTheme: (theme) => persistPrefs({ ...prefs, theme }),
      setAlertPrefs: (alerts) => persistPrefs({ ...prefs, alerts }),
      toggleSaved: (item) => {
        setSaved((prev) => {
          const exists = prev.some((s) => s.id === item.id);
          const next = exists
            ? prev.filter((s) => s.id !== item.id)
            : [{ ...item, savedAt: new Date().toISOString() }, ...prev];
          writeJson(STORAGE_KEYS.saved, next);
          return next;
        });
      },
      isSaved: (id) => saved.some((s) => s.id === id),
      markAlertRead: (id) => {
        setReadAlerts((prev) => {
          const next = new Set(prev);
          next.add(id);
          writeJson(STORAGE_KEYS.read, [...next]);
          return next;
        });
      },
      markAllAlertsRead: (ids) => {
        setReadAlerts((prev) => {
          const next = new Set(prev);
          for (const id of ids) next.add(id);
          writeJson(STORAGE_KEYS.read, [...next]);
          return next;
        });
      },
      dismissAlert: (id) => {
        setDismissedAlerts((prev) => {
          const next = new Set(prev);
          next.add(id);
          writeJson(STORAGE_KEYS.dismissed, [...next]);
          return next;
        });
      },
      resetAll: () => {
        setPrefs(DEFAULT_PREFERENCES);
        setSaved([]);
        setReadAlerts(new Set());
        setDismissedAlerts(new Set());
        for (const key of Object.values(STORAGE_KEYS)) {
          try {
            window.localStorage.removeItem(key);
          } catch {
            // ignore
          }
        }
      },
    };
  }, [prefs, hydrated, saved, readAlerts, dismissedAlerts, persistPrefs]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used inside <PreferencesProvider>");
  }
  return ctx;
}
