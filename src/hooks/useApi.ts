"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refetch: () => void;
}

/** Small fetch hook with loading/error states and manual refetch. */
export function useApi<T>(path: string): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const active = useRef(true);
  // Request identity: a new path or manual refetch yields a new key, which
  // makes `loading` true without an extra synchronous setState in the effect.
  const requestKey = `${path}#${tick}`;

  useEffect(() => {
    active.current = true;
    const ctrl = new AbortController();
    fetch(path, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`http-${res.status}`);
        const json = (await res.json()) as T;
        if (active.current) {
          setData(json);
          setError(null);
        }
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (active.current) setError(e instanceof Error ? e.message : "request-failed");
      })
      .finally(() => {
        if (active.current) setSettledKey(requestKey);
      });
    return () => {
      active.current = false;
      ctrl.abort();
    };
  }, [path, requestKey]);

  const loading = settledKey !== requestKey;
  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, refetch };
}

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
