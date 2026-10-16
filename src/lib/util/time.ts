// ---------------------------------------------------------------------------
// Timestamp helpers. ORBIS keeps FOUR distinct times apart, always:
//   eventTime      — when the development occurred (often unknown)
//   publishedAt    — when the source published its report
//   retrievedAt    — when ORBIS fetched the report
//   observedAt     — when ORBIS recorded a change to an event
// These are never conflated in the UI or the data model.
// ---------------------------------------------------------------------------

export function toIso(input: string | number | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) {
    throw new Error("invalid-date");
  }
  return d.toISOString();
}

export function hoursSince(iso: string, now: number = Date.now()): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return (now - t) / 3_600_000;
}

/** Human-friendly relative time. `now` is injectable for deterministic tests. */
export function relativeTime(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "unknown";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "unknown";
  const diffMs = now - t;
  const future = diffMs < 0;
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return future ? `in ${mins} min` : `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return future ? `in ${hours} h` : `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return future ? `in ${days} d` : `${days} d ago`;
  const months = Math.round(days / 30);
  return future ? `in ${months} mo` : `${months} mo ago`;
}

export function humanDateTime(iso: string | null): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${d.toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

/** Freshness bucket shown on retrieved reports. Honest, not marketing. */
export function freshnessOf(
  publishedAt: string,
  retrievedAt: string,
  now: number = Date.now(),
): "fresh" | "recent" | "aging" | "stale" {
  const publishedAge = hoursSince(publishedAt, now);
  const retrievedAge = hoursSince(retrievedAt, now);
  if (retrievedAge > 24) return "stale";
  if (publishedAge <= 3) return "fresh";
  if (publishedAge <= 24) return "recent";
  return "aging";
}
