import { afterEach, describe, expect, it } from "vitest";
import { getEnv, isAiConfigured, isFixtureMode } from "@/lib/env";

describe("getEnv", () => {
  it("treats every variable as optional (empty environment is valid)", () => {
    const env = getEnv({});
    expect(env.AI_BASE_URL).toBeUndefined();
    expect(env.AI_API_KEY).toBeUndefined();
    expect(env.INGEST_TOKEN).toBeUndefined();
    expect(env.ORBIS_TILE_URL).toBeUndefined();
  });

  it("normalizes the AI base URL and strips a trailing slash", () => {
    const env = getEnv({ AI_BASE_URL: "https://api.example.com/v1/" });
    expect(env.AI_BASE_URL).toBe("https://api.example.com/v1");
  });

  it("rejects a non-http AI base URL loudly", () => {
    expect(() => getEnv({ AI_BASE_URL: "ftp://example.com" })).toThrow(/AI_BASE_URL/);
    expect(() => getEnv({ AI_BASE_URL: "not a url" })).toThrow(/AI_BASE_URL/);
  });

  it("accepts a tile template and rejects an invalid one", () => {
    const env = getEnv({ ORBIS_TILE_URL: "https://tiles.example.com/{z}/{x}/{y}.png" });
    expect(env.ORBIS_TILE_URL).toBe("https://tiles.example.com/{z}/{x}/{y}.png");
    expect(() => getEnv({ ORBIS_TILE_URL: "javascript:alert(1)" })).toThrow(/ORBIS_TILE_URL/);
  });
});

describe("isAiConfigured", () => {
  it("requires base URL, key and model together", () => {
    expect(isAiConfigured(getEnv({}))).toBe(false);
    expect(isAiConfigured(getEnv({ AI_BASE_URL: "https://x.example.com" }))).toBe(false);
    expect(
      isAiConfigured(
        getEnv({
          AI_BASE_URL: "https://x.example.com",
          AI_API_KEY: "k",
          AI_MODEL: "m",
        }),
      ),
    ).toBe(true);
  });
});

describe("isFixtureMode", () => {
  afterEach(() => {
    delete process.env.ORBIS_E2E;
  });

  it("is true only when ORBIS_E2E=1", () => {
    delete process.env.ORBIS_E2E;
    expect(isFixtureMode()).toBe(false);
    process.env.ORBIS_E2E = "1";
    expect(isFixtureMode()).toBe(true);
    process.env.ORBIS_E2E = "0";
    expect(isFixtureMode()).toBe(false);
  });
});
