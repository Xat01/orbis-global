import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BriefingSchema } from "@/lib/types";
import { generateDeterministicBriefing } from "@/lib/intelligence/briefing";
import { extractJson, generateBriefing } from "@/lib/intelligence/ai/provider";
import { __resetEnvCache } from "@/lib/env";
import { loadFixtureSnapshot } from "@/lib/sources/fixtures";

const snap = loadFixtureSnapshot();
const event = snap.events[0];
const articles = snap.articles.filter((a) => a.eventId === event.id);
const updates = snap.updates.filter((u) => u.eventId === event.id);

describe("generateDeterministicBriefing", () => {
  it("produces a schema-valid, clearly-labelled deterministic briefing", () => {
    const briefing = generateDeterministicBriefing({ event, articles, updates, mode: "standard" });
    expect(() => BriefingSchema.parse(briefing)).not.toThrow();
    expect(briefing.generator).toBe("deterministic");
    expect(briefing.eventId).toBe(event.id);
    expect(briefing.confirmed.length).toBeGreaterThan(0);
    expect(briefing.limitations.length).toBeGreaterThan(0);
    expect(briefing.analysisLabel).toMatch(/rule-based/i);
    expect(briefing.sources.length).toBe(articles.length);
  });

  it("is deterministic in its non-time content for identical input", () => {
    const a = generateDeterministicBriefing({ event, articles, updates, mode: "quick" });
    const b = generateDeterministicBriefing({ event, articles, updates, mode: "quick" });
    expect(a.whatHappened).toBe(b.whatHappened);
    expect(a.confirmed).toEqual(b.confirmed);
    expect(a.whatCouldHappenNext).toEqual(b.whatCouldHappenNext);
  });
});

describe("extractJson", () => {
  it("parses fenced and raw JSON and returns null on garbage", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('noise {"a":2} trailing')).toEqual({ a: 2 });
    expect(extractJson("not json at all")).toBeNull();
  });
});

describe("generateBriefing (AI path)", () => {
  const validSourceId = articles[0]?.sourceId ?? "bbc-world";

  beforeEach(() => {
    delete process.env.ORBIS_E2E;
    process.env.AI_BASE_URL = "https://ai.example.com/v1";
    process.env.AI_API_KEY = "test-key";
    process.env.AI_MODEL = "test-model";
    __resetEnvCache();
  });

  afterEach(() => {
    delete process.env.AI_BASE_URL;
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
    __resetEnvCache();
    vi.restoreAllMocks();
  });

  it("uses the AI result when the model returns valid, grounded JSON", async () => {
    const aiOutput = {
      whatHappened: "Summary from model.",
      whereWhen: "Somewhere, sometime.",
      whoIsInvolved: "Actors.",
      confirmed: [
        { text: "Grounded claim.", sourceIds: [validSourceId] },
        { text: "Fabricated claim.", sourceIds: ["made-up-source"] },
      ],
      uncertain: [],
      whyItMatters: "Because.",
      whatCouldHappenNext: ["Watch X."],
      affected: "Some people.",
      watchNext: ["Watch Y."],
      limitations: ["Metadata only."],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(aiOutput) } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const result = await generateBriefing({ event, articles, updates, mode: "standard" });
    expect(result.aiStatus).toBe("ok");
    expect(result.briefing.generator).toBe("ai");
    const confirmedText = result.briefing.confirmed.join("\n");
    expect(confirmedText).toContain("Grounded claim.");
    // Fabricated source IDs are dropped — the claim must not survive.
    expect(confirmedText).not.toContain("Fabricated claim.");
  });

  it("falls back to the deterministic engine with an honest status on HTTP failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));
    const result = await generateBriefing({ event, articles, updates, mode: "standard" });
    expect(result.aiStatus).toBe("failed");
    expect(result.aiError).toBeTruthy();
    expect(result.briefing.generator).toBe("deterministic");
  });

  it("falls back on a schema mismatch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: '{"whatHappened":"x"}' } }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const result = await generateBriefing({ event, articles, updates, mode: "standard" });
    expect(result.aiStatus).toBe("failed");
    expect(result.aiError).toBe("ai-schema-mismatch");
  });
});

describe("generateBriefing (no provider)", () => {
  afterEach(() => {
    __resetEnvCache();
  });

  it("reports not-configured and returns the deterministic briefing", async () => {
    delete process.env.AI_BASE_URL;
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
    __resetEnvCache();
    const result = await generateBriefing({ event, articles, updates, mode: "standard" });
    expect(result.aiStatus).toBe("not-configured");
    expect(result.briefing.generator).toBe("deterministic");
  });
});
