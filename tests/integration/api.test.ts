import { beforeEach, describe, expect, it, vi } from "vitest";

// Deterministic fixture mode for the whole file, set before the route modules
// (and their transitive env reads) are evaluated.
vi.hoisted(() => {
  process.env.ORBIS_E2E = "1";
  delete process.env.AI_BASE_URL;
  delete process.env.AI_API_KEY;
  delete process.env.AI_MODEL;
  delete process.env.INGEST_TOKEN;
});

import { GET as healthGET } from "@/app/api/health/route";
import { GET as overviewGET } from "@/app/api/overview/route";
import { GET as eventsGET } from "@/app/api/events/route";
import { GET as eventByIdGET } from "@/app/api/events/[id]/route";
import { GET as articlesGET } from "@/app/api/articles/route";
import { GET as sourcesGET } from "@/app/api/sources/route";
import { GET as searchGET } from "@/app/api/search/route";
import { POST as ingestPOST } from "@/app/api/ingest/route";
import { __resetEnvCache } from "@/lib/env";
import { __resetRateLimiter } from "@/lib/security/rateLimit";

const base = "http://127.0.0.1:3100";
const req = (path: string) => new Request(`${base}${path}`);
const json = async (res: Response) => (await res.json()) as Record<string, unknown>;

beforeEach(() => {
  __resetRateLimiter();
  __resetEnvCache();
});

describe("GET /api/health", () => {
  it("reports liveness", async () => {
    const res = await healthGET();
    expect(res.status).toBe(200);
    expect((await json(res)).ok).toBe(true);
  });
});

describe("GET /api/overview", () => {
  it("returns a fixture-mode dashboard payload", async () => {
    const res = await overviewGET(req("/api/overview"));
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(Array.isArray(body.events)).toBe(true);
    expect((body.events as unknown[]).length).toBeGreaterThan(0);
    expect(body.fixtureMode).toBe(true);
  });
});

describe("GET /api/events", () => {
  it("lists events and prevents invalid filters with a 400", async () => {
    const ok = await eventsGET(req("/api/events?limit=5"));
    expect(ok.status).toBe(200);
    const body = await json(ok);
    expect((body.events as unknown[]).length).toBeLessThanOrEqual(5);

    const bad = await eventsGET(req("/api/events?topic=not-a-topic"));
    expect(bad.status).toBe(400);
    expect((await json(bad)).error).toBe("invalid-topic");
  });
});

describe("GET /api/events/[id]", () => {
  it("returns an event with a deterministic, honestly-labelled briefing", async () => {
    const listRes = await eventsGET(req("/api/events?limit=1"));
    const { events } = (await json(listRes)) as { events: Array<{ id: string }> };
    const id = events[0].id;

    const res = await eventByIdGET(req(`/api/events/${id}`), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.aiStatus).toBe("not-configured");
    expect((body.briefing as { generator: string }).generator).toBe("deterministic");
  });

  it("returns 404 for an unknown event id", async () => {
    const res = await eventByIdGET(req("/api/events/does-not-exist"), {
      params: Promise.resolve({ id: "does-not-exist" }),
    });
    expect(res.status).toBe(404);
    expect((await json(res)).error).toBe("event-not-found");
  });
});

describe("GET /api/articles", () => {
  it("returns normalized article rows", async () => {
    const res = await articlesGET(req("/api/articles?limit=5"));
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(Array.isArray(body.articles ?? body.rows ?? body.items)).toBe(true);
  });
});

describe("GET /api/sources", () => {
  it("lists sources with attribution and a disabled list", async () => {
    const res = await sourcesGET(req("/api/sources"));
    expect(res.status).toBe(200);
    const body = await json(res);
    const sources = body.sources as Array<{ attribution: string }>;
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every((s) => typeof s.attribution === "string")).toBe(true);
    expect(Array.isArray(body.disabled)).toBe(true);
  });
});

describe("GET /api/search", () => {
  it("requires a query of at least two characters", async () => {
    const missing = await searchGET(req("/api/search"));
    expect(missing.status).toBe(400);
    const short = await searchGET(req("/api/search?q=a"));
    expect(short.status).toBe(400);

    const ok = await searchGET(req("/api/search?q=the"));
    expect(ok.status).toBe(200);
    const body = await json(ok);
    expect(Array.isArray(body.events)).toBe(true);
    expect(Array.isArray(body.articles)).toBe(true);
  });
});

describe("POST /api/ingest", () => {
  it("is disabled (403) when no INGEST_TOKEN is configured", async () => {
    const res = await ingestPOST(req("/api/ingest"));
    expect(res.status).toBe(403);
    expect((await json(res)).error).toBe("ingest-disabled");
  });
});
