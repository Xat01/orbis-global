import { describe, expect, it } from "vitest";
import {
  parseKevCatalog,
  parseNewsFeed,
  parseReliefWeb,
  parseUsgsFeed,
} from "@/lib/sources/adapters";
import { SOURCE_CONFIGS } from "@/lib/sources/registry";

const retrievedAt = "2026-10-16T12:00:00.000Z";
const bbc = SOURCE_CONFIGS.find((s) => s.id === "bbc-world")!;
const usgs = SOURCE_CONFIGS.find((s) => s.id === "usgs-seismic")!;
const kev = SOURCE_CONFIGS.find((s) => s.id === "cisa-kev")!;
const reliefweb = SOURCE_CONFIGS.find((s) => s.id === "reliefweb")!;

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <item>
    <title>Town floods after record rainfall</title>
    <link>https://example.com/story-a</link>
    <description>Emergency crews rescue residents &amp; pets.</description>
    <pubDate>Thu, 16 Oct 2026 10:00:00 GMT</pubDate>
  </item>
  <item><title>   </title><link>https://example.com/empty-title</link></item>
  <item><title>No usable link</title><link>javascript:alert(1)</link></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Ceasefire talks resume</title>
    <link rel="alternate" href="https://example.com/atom-a"/>
    <link rel="self" href="https://example.com/atom-a.self"/>
    <updated>2026-10-16T09:30:00Z</updated>
    <summary>Negotiators returned to the table.</summary>
  </entry>
</feed>`;

const RDF = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <item>
    <title>Bond yields climb</title>
    <link>https://example.com/rdf-a</link>
    <description>Markets react to central bank signals.</description>
    <dc:date>2026-10-16T08:00:00Z</dc:date>
  </item>
</rdf:RDF>`;

const XXE = `<?xml version="1.0"?>
<!DOCTYPE rss [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<rss version="2.0"><channel>
  <item><title>Leak &xxe;</title><link>https://example.com/xxe</link><description>&xxe;</description></item>
</channel></rss>`;

describe("parseNewsFeed", () => {
  it("parses RSS 2.0, decodes entities and drops invalid items", () => {
    const { items, error } = parseNewsFeed(RSS, bbc, retrievedAt);
    expect(error).toBeUndefined();
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Town floods after record rainfall");
    expect(items[0].description).toContain("rescue residents & pets");
    expect(items[0].url).toBe("https://example.com/story-a");
    expect(items[0].sourceId).toBe("bbc-world");
  });

  it("parses Atom entries with rel=alternate links", () => {
    const { items } = parseNewsFeed(ATOM, bbc, retrievedAt);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Ceasefire talks resume");
    expect(items[0].url).toBe("https://example.com/atom-a");
  });

  it("parses RDF (RSS 1.0) items", () => {
    const { items } = parseNewsFeed(RDF, bbc, retrievedAt);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Bond yields climb");
  });

  it("rejects external entities (XXE-safe) instead of resolving them", () => {
    const { items, error } = parseNewsFeed(XXE, bbc, retrievedAt);
    const joined = JSON.stringify(items);
    expect(joined).not.toContain("root:");
    expect(joined).not.toContain("/etc/passwd");
    expect(error).toBe("xml-parse-error");
  });

  it("reports malformed XML as an error rather than throwing", () => {
    const { items, error } = parseNewsFeed("<rss><channel", bbc, retrievedAt);
    expect(Array.isArray(items)).toBe(true);
    expect(error).toBeTruthy();
  });
});

describe("parseUsgsFeed", () => {
  const feed = JSON.stringify({
    features: [
      {
        properties: {
          title: "M 5.4 - 74 km SW of Hualien City, Taiwan",
          mag: 5.4,
          place: "74 km SW of Hualien City, Taiwan",
          time: Date.parse("2026-10-16T03:00:00.000Z"),
          url: "https://earthquake.usgs.gov/earthquakes/eventpage/x",
          tsunami: 0,
        },
        geometry: { coordinates: [121.2, 23.6, 11] },
      },
      { properties: { title: "no coords" } },
    ],
  });

  it("extracts precise epicentre geo and origin time", () => {
    const { items } = parseUsgsFeed(feed, usgs, retrievedAt);
    expect(items).toHaveLength(1);
    expect(items[0].topicOverride).toEqual(["natural-disaster"]);
    expect(items[0].eventTime).toBe("2026-10-16T03:00:00.000Z");
    expect(items[0].geoOverride?.[0].kind).toBe("exact");
    expect(items[0].geoOverride?.[0].lat).toBe(23.6);
    expect(items[0].geoOverride?.[0].lng).toBe(121.2);
    expect(items[0].geoOverride?.[0].precisionRadiusKm).toBeGreaterThan(0);
  });

  it("returns an error for invalid JSON", () => {
    expect(parseUsgsFeed("{not json", usgs, retrievedAt).error).toBe("json-parse-error");
  });
});

describe("parseKevCatalog", () => {
  it("keeps recently-added known-exploited vulnerabilities only", () => {
    const recent = new Date(Date.now() - 2 * 24 * 3_600_000).toISOString().slice(0, 10);
    const old = "2020-01-01";
    const json = JSON.stringify({
      vulnerabilities: [
        {
          cveID: "CVE-2026-0001",
          dateAdded: recent,
          vulnerabilityName: "Acme Gateway RCE",
          vendorProject: "Acme",
          product: "Gateway",
          shortDescription: "Remote code execution.",
          requiredAction: "Apply updates.",
          knownRansomwareCampaignUse: "Known",
        },
        {
          cveID: "CVE-2019-9999",
          dateAdded: old,
          vulnerabilityName: "Ancient bug",
        },
        { vulnerabilityName: "missing id" },
      ],
    });
    const { items } = parseKevCatalog(json, kev, retrievedAt);
    expect(items).toHaveLength(1);
    expect(items[0].title).toContain("CVE-2026-0001");
    expect(items[0].topicOverride).toEqual(["cybersecurity"]);
    expect(items[0].description).toContain("ransomware");
  });
});

describe("parseReliefWeb", () => {
  it("maps the v2 shape when given a well-formed payload", () => {
    const json = JSON.stringify({
      data: [
        {
          id: "123",
          fields: {
            title: "Flooding displaces thousands",
            url: "https://reliefweb.int/report/x",
            date: { created: "2026-10-15T00:00:00+00:00" },
            country: [{ name: "Nigeria" }],
            source: [{ name: "OCHA" }],
          },
        },
      ],
    });
    const { items } = parseReliefWeb(json, reliefweb, retrievedAt);
    expect(items).toHaveLength(1);
    expect(items[0].sourceId).toBe("reliefweb");
    expect(items[0].url).toMatch(/^https?:\/\//);
    expect(items[0].geoOverride?.[0]).toMatchObject({ kind: "country", country: "Nigeria" });
  });

  it("returns an error when the payload has no usable reports", () => {
    const { error } = parseReliefWeb(JSON.stringify({ data: [] }), reliefweb, retrievedAt);
    expect(error).toBe("no-items-parsed");
  });
});
