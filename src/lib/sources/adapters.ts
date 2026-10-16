import { XMLParser } from "fast-xml-parser";
import type { GeoRef } from "@/lib/types";
import { safeFetch } from "@/lib/security/urlGuard";
import { sanitizeText, truncate } from "@/lib/util/text";
import { toIso } from "@/lib/util/time";
import type { SourceConfig } from "@/lib/sources/registry";

// ---------------------------------------------------------------------------
// Source adapters. Each adapter:
//   - fetches via safeFetch (allowlisted URL, timeout, size cap, SSRF checks)
//   - validates + normalizes the response
//   - returns RawItems that the ingestion pipeline further normalizes
//   - never throws — failures are returned as { error } for isolation
// ---------------------------------------------------------------------------

export interface RawItem {
  sourceId: string;
  sourceName: string;
  url: string;
  title: string;
  description: string;
  publishedAt: string | null; // ISO
  eventTime?: string | null; // ISO, when known (e.g. quake origin time)
  language?: string | null;
  geoOverride?: GeoRef[]; // precise geo from structured feeds
  topicOverride?: string[]; // e.g. ["natural-disaster"] for USGS
  quality: number;
  attribution: string;
}

export interface AdapterResult {
  items: RawItem[];
  error?: string;
}

// ---------------------------------------------------------------------------
// RSS 2.0 / Atom / RDF reader
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // SECURITY: fast-xml-parser rejects external entities outright ("External
  // entities are not supported") and does not expand nested internal entities,
  // so XXE / billion-laughs are not possible. We still enable entity
  // processing so that legitimate entities (&amp;, &#233;) decode correctly.
  processEntities: true,
  // Namespace prefixes (rdf:, dc:, content:) are stripped so RDF/RSS 1.0 feeds
  // (e.g. DW, whose root is <rdf:RDF>) parse with predictable key names.
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
});

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function parseDate(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

interface RssItem {
  title?: string;
  link?: string;
  description?: string;
  guid?: string | { "#text"?: string; "@_isPermaLink"?: string };
  pubDate?: string;
  // Namespace prefixes stripped by the parser (removeNSPrefix: true).
  date?: string;
  encoded?: string;
  category?: string | string[];
}

interface AtomLink {
  "@_href"?: string;
  "@_rel"?: string;
}

interface AtomEntry {
  title?: string | { "#text"?: string };
  link?: AtomLink | AtomLink[];
  summary?: string;
  content?: string;
  published?: string;
  updated?: string;
}

export function parseNewsFeed(
  xml: string,
  config: SourceConfig,
  retrievedAt: string,
): AdapterResult {
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml);
  } catch {
    return { items: [], error: "xml-parse-error" };
  }

  const items: RawItem[] = [];
  const push = (
    title: string | undefined,
    link: string | undefined,
    description: string | undefined,
    publishedAt: string | null,
    language: string | null,
  ) => {
    const cleanTitle = sanitizeText(title ?? "").slice(0, 500);
    const cleanLink = (link ?? "").trim();
    if (!cleanTitle || !cleanLink) return;
    if (!/^https?:\/\//i.test(cleanLink)) return; // reject non-http links
    items.push({
      sourceId: config.id,
      sourceName: config.name,
      url: cleanLink,
      title: cleanTitle,
      description: truncate(sanitizeText(description ?? ""), 700),
      publishedAt,
      language,
      quality: config.quality,
      attribution: config.attribution,
    });
  };

  // RSS 2.0
  const rss = doc.rss as { channel?: { item?: RssItem | RssItem[] } } | undefined;
  if (rss?.channel) {
    for (const it of toArray(rss.channel.item)) {
      const guid = typeof it.guid === "string" ? it.guid : it.guid?.["#text"];
      const link = typeof it.link === "string" ? it.link : undefined;
      push(
        it.title,
        link ?? guid,
        it.description ?? it.encoded,
        parseDate(it.pubDate) ?? parseDate(it.date),
        null,
      );
    }
  }

  // RDF (RSS 1.0) — e.g. DW
  const rdf = doc.RDF as { item?: RssItem | RssItem[] } | undefined;
  if (rdf?.item) {
    for (const it of toArray(rdf.item)) {
      const link = typeof it.link === "string" ? it.link : undefined;
      push(it.title, link, it.description, parseDate(it.date), null);
    }
  }

  // Atom
  const atom = doc.feed as { entry?: AtomEntry | AtomEntry[] } | undefined;
  if (atom?.entry) {
    for (const e of toArray(atom.entry)) {
      const links = toArray(e.link);
      const preferred =
        links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? links[0];
      const title = typeof e.title === "string" ? e.title : e.title?.["#text"];
      push(
        title,
        preferred?.["@_href"],
        e.summary ?? e.content,
        parseDate(e.published) ?? parseDate(e.updated),
        null,
      );
    }
  }

  if (items.length === 0) {
    return { items: [], error: "no-items-parsed" };
  }
  void retrievedAt;
  return { items };
}

export async function fetchNewsFeed(
  config: SourceConfig,
  retrievedAt: string,
): Promise<AdapterResult> {
  try {
    const res = await safeFetch(config.feedUrl, {
      headers: { accept: "application/rss+xml, application/xml, text/xml, application/atom+xml, */*" },
    });
    if (!res.ok) return { items: [], error: `http-${res.status}` };
    const text = await res.text();
    return parseNewsFeed(text, config, retrievedAt);
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message.slice(0, 200) : "fetch-failed" };
  }
}

// ---------------------------------------------------------------------------
// USGS seismic GeoJSON — precise coordinates from a primary source
// ---------------------------------------------------------------------------

interface UsgsFeature {
  properties?: {
    mag?: number;
    place?: string;
    time?: number;
    url?: string;
    title?: string;
    tsunami?: number;
    alert?: string;
  };
  geometry?: { coordinates?: [number, number, number] };
}

export function parseUsgsFeed(
  json: string,
  config: SourceConfig,
  retrievedAt: string,
): AdapterResult {
  let doc: { features?: UsgsFeature[] };
  try {
    doc = JSON.parse(json);
  } catch {
    return { items: [], error: "json-parse-error" };
  }
  const items: RawItem[] = [];
  for (const f of doc.features ?? []) {
    const p = f.properties;
    const coords = f.geometry?.coordinates;
    if (!p?.title || !coords) continue;
    const [lng, lat, depthKm] = coords;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    const originTime = typeof p.time === "number" ? toIso(p.time) : null;
    const geo: GeoRef[] = [
      {
        name: p.place ?? "Epicentre",
        kind: "exact",
        lat,
        lng,
        precisionRadiusKm: Math.max(5, (depthKm ?? 10) / 2),
      },
    ];
    items.push({
      sourceId: config.id,
      sourceName: config.name,
      url: p.url ?? config.homepage,
      title: sanitizeText(p.title).slice(0, 300),
      description: truncate(
        `Magnitude ${p.mag ?? "?"} earthquake${p.tsunami ? " (tsunami flag set)" : ""}. Depth ~${depthKm ?? "?"} km. Reported location: ${p.place ?? "unknown"}.`,
        500,
      ),
      publishedAt: retrievedAt, // feed has no publication time; retrieval time used
      eventTime: originTime,
      geoOverride: geo,
      topicOverride: ["natural-disaster"],
      quality: config.quality,
      attribution: config.attribution,
    });
  }
  if (items.length === 0) return { items: [], error: "no-items-parsed" };
  return { items };
}

export async function fetchUsgs(config: SourceConfig, retrievedAt: string): Promise<AdapterResult> {
  try {
    const res = await safeFetch(config.feedUrl, { headers: { accept: "application/geo+json, application/json" } });
    if (!res.ok) return { items: [], error: `http-${res.status}` };
    return parseUsgsFeed(await res.text(), config, retrievedAt);
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message.slice(0, 200) : "fetch-failed" };
  }
}

// ---------------------------------------------------------------------------
// CISA Known Exploited Vulnerabilities catalog (JSON, US government, public domain)
// ---------------------------------------------------------------------------

interface KevEntry {
  cveID?: string;
  vendorProject?: string;
  product?: string;
  vulnerabilityName?: string;
  dateAdded?: string;
  shortDescription?: string;
  requiredAction?: string;
  knownRansomwareCampaignUse?: string;
}

export function parseKevCatalog(
  json: string,
  config: SourceConfig,
  retrievedAt: string,
): AdapterResult {
  let doc: { vulnerabilities?: KevEntry[] };
  try {
    doc = JSON.parse(json);
  } catch {
    return { items: [], error: "json-parse-error" };
  }
  const items: RawItem[] = [];
  const cutoff = Date.now() - 10 * 24 * 3_600_000; // only entries added in last 10 days
  for (const v of doc.vulnerabilities ?? []) {
    if (!v.cveID || !v.dateAdded) continue;
    const added = new Date(v.dateAdded);
    if (Number.isNaN(added.getTime()) || added.getTime() < cutoff) continue;
    items.push({
      sourceId: config.id,
      sourceName: config.name,
      url: `https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json`,
      title: `CISA: ${v.cveID} — ${v.vulnerabilityName ?? v.product ?? "known exploited vulnerability"}`.slice(0, 300),
      description: truncate(
        `${v.vendorProject ?? ""} ${v.product ?? ""}. ${v.shortDescription ?? ""} Required action: ${v.requiredAction ?? "see catalog"}.${v.knownRansomwareCampaignUse === "Known" ? " Linked to known ransomware campaigns." : ""}`,
        500,
      ),
      publishedAt: added.toISOString(),
      topicOverride: ["cybersecurity"],
      quality: config.quality,
      attribution: config.attribution,
    });
    if (items.length >= 30) break; // bound per-run volume
  }
  void retrievedAt;
  return { items };
}

export async function fetchKev(config: SourceConfig, retrievedAt: string): Promise<AdapterResult> {
  try {
    const res = await safeFetch(config.feedUrl, { headers: { accept: "application/json" } });
    if (!res.ok) return { items: [], error: `http-${res.status}` };
    return parseKevCatalog(await res.text(), config, retrievedAt);
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message.slice(0, 200) : "fetch-failed" };
  }
}

// ---------------------------------------------------------------------------
// ReliefWeb v2 (requires an approved free appname — disabled without it)
// ---------------------------------------------------------------------------

interface RwReport {
  id?: string;
  fields?: {
    title?: string;
    url?: string;
    date?: { created?: string };
    country?: Array<{ name?: string }>;
    source?: Array<{ acronym?: string; name?: string }>;
  };
}

export function parseReliefWeb(
  json: string,
  config: SourceConfig,
  retrievedAt: string,
): AdapterResult {
  let doc: { data?: RwReport[] };
  try {
    doc = JSON.parse(json);
  } catch {
    return { items: [], error: "json-parse-error" };
  }
  const items: RawItem[] = [];
  for (const r of doc.data ?? []) {
    const f = r.fields;
    if (!f?.title || !f.url) continue;
    const countries = (f.country ?? []).map((c) => c.name).filter(Boolean) as string[];
    const geo: GeoRef[] = countries.slice(0, 2).map((name) => ({
      name,
      kind: "country" as const,
      country: name,
      precisionRadiusKm: 350,
    }));
    items.push({
      sourceId: config.id,
      sourceName: config.name,
      url: f.url,
      title: sanitizeText(f.title).slice(0, 400),
      description: truncate(
        `Humanitarian report${countries.length ? ` concerning ${countries.join(", ")}` : ""}.`,
        400,
      ),
      publishedAt: parseDate(f.date?.created),
      geoOverride: geo.length ? geo : undefined,
      quality: config.quality,
      attribution: config.attribution,
    });
    if (items.length >= 40) break;
  }
  void retrievedAt;
  if (items.length === 0) return { items: [], error: "no-items-parsed" };
  return { items };
}

export async function fetchReliefWeb(
  config: SourceConfig,
  retrievedAt: string,
  appname: string,
): Promise<AdapterResult> {
  try {
    const url =
      `${config.feedUrl}?appname=${encodeURIComponent(appname)}&limit=25` +
      `&filter[field]=status&filter[value]=published` +
      `&sort[]=date.created:desc` +
      `&fields[include][]=title&fields[include][]=url&fields[include][]=date&fields[include][]=country`;
    const res = await safeFetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return { items: [], error: `http-${res.status}` };
    return parseReliefWeb(await res.text(), config, retrievedAt);
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message.slice(0, 200) : "fetch-failed" };
  }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export async function fetchSource(
  config: SourceConfig,
  retrievedAt: string,
  env: Record<string, string | undefined> = process.env,
): Promise<AdapterResult> {
  switch (config.adapter) {
    case "rss":
      return fetchNewsFeed(config, retrievedAt);
    case "usgs":
      return fetchUsgs(config, retrievedAt);
    case "cisa-kev":
      return fetchKev(config, retrievedAt);
    case "reliefweb": {
      const appname = env.ORBIS_RELIEFWEB_APPNAME;
      if (!appname) return { items: [], error: "reliefweb-appname-not-configured" };
      return fetchReliefWeb(config, retrievedAt, appname);
    }
    default:
      return { items: [], error: "unknown-adapter" };
  }
}
