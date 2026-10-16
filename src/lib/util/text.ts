// ---------------------------------------------------------------------------
// Text + URL normalization used by deduplication, clustering and search.
// All functions are deterministic and unit-tested.
// ---------------------------------------------------------------------------

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
  "cmpid",
  "ito",
  "s",
]);

/** Canonicalize a URL for duplicate detection. */
export function canonicalizeUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw.trim().toLowerCase();
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
  const protocol = url.protocol.toLowerCase();

  // Stable query: drop tracking params, sort the rest.
  const params = [...url.searchParams.entries()]
    .filter(([k]) => !TRACKING_PARAMS.has(k.toLowerCase()))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  const query = params.length
    ? "?" +
      params
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&")
    : "";

  let path = url.pathname.replace(/\/{2,}/g, "/");
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path === "") path = "/";

  const port =
    (protocol === "http:" && url.port === "80") ||
    (protocol === "https:" && url.port === "443") ||
    !url.port
      ? ""
      : `:${url.port}`;

  return `${protocol}//${host}${port}${path}${query}`;
}

/** Stable non-cryptographic hash (FNV-1a 32-bit) for IDs. */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(7, "0");
}

export function slugId(prefix: string, input: string): string {
  return `${prefix}_${fnv1a(input)}`;
}

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "of", "to", "in", "on", "at", "by",
  "for", "with", "from", "as", "is", "are", "was", "were", "be", "been", "being",
  "it", "its", "this", "that", "these", "those", "has", "have", "had", "will",
  "would", "could", "should", "may", "might", "can", "shall", "do", "does", "did",
  "not", "no", "than", "then", "so", "such", "into", "over", "after", "before",
  "about", "up", "out", "his", "her", "their", "he", "she", "they", "we", "you",
  "i", "am", "what", "who", "why", "how", "when", "where", "new", "says", "said",
  "report", "reports", "news", "day", "year", "years",
]);

/** Lowercase, strip punctuation, split into significant tokens. */
export function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export function tokenSet(input: string): Set<string> {
  return new Set(tokenize(input));
}

/** Jaccard similarity between two token sets. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Normalized headline for duplicate detection (lowercase, punctuation-free). */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip XML/HTML tags and control characters from untrusted content. */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  return input.slice(0, max - 1).trimEnd() + "…";
}

/** Count words (for briefing length control). */
export function wordCount(input: string): number {
  return input.split(/\s+/).filter(Boolean).length;
}
