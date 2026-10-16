import { describe, expect, it } from "vitest";
import {
  canonicalizeUrl,
  fnv1a,
  jaccard,
  normalizeTitle,
  sanitizeText,
  slugId,
  tokenSet,
  tokenize,
  truncate,
  wordCount,
} from "@/lib/util/text";

describe("canonicalizeUrl", () => {
  it("lowercases host and strips www", () => {
    expect(canonicalizeUrl("https://WWW.Example.COM/a")).toBe("https://example.com/a");
  });

  it("removes tracking parameters", () => {
    expect(canonicalizeUrl("https://example.com/a?utm_source=x&id=7&fbclid=y")).toBe(
      "https://example.com/a?id=7",
    );
  });

  it("sorts remaining query parameters", () => {
    expect(canonicalizeUrl("https://example.com/a?b=2&a=1")).toBe("https://example.com/a?a=1&b=2");
  });

  it("strips fragments and trailing slashes", () => {
    expect(canonicalizeUrl("https://example.com/path/?x=1#frag")).toBe(
      "https://example.com/path?x=1",
    );
  });

  it("removes default ports", () => {
    expect(canonicalizeUrl("https://example.com:443/a")).toBe("https://example.com/a");
    expect(canonicalizeUrl("http://example.com:80/a")).toBe("http://example.com/a");
  });

  it("keeps non-default ports", () => {
    expect(canonicalizeUrl("https://example.com:8443/a")).toBe("https://example.com:8443/a");
  });

  it("maps the same story URL with different tracking to one canonical form", () => {
    const a = canonicalizeUrl("https://news.example.com/story?utm_medium=rss");
    const b = canonicalizeUrl("https://www.news.example.com/story/");
    expect(a).toBe(b);
  });

  it("degrades gracefully for invalid input", () => {
    expect(canonicalizeUrl("not a url")).toBe("not a url");
  });
});

describe("hashing and ids", () => {
  it("fnv1a is stable and deterministic", () => {
    expect(fnv1a("hello")).toBe(fnv1a("hello"));
    expect(fnv1a("hello")).not.toBe(fnv1a("world"));
  });

  it("slugId prefixes the hash", () => {
    expect(slugId("evt", "x")).toMatch(/^evt_[0-9a-z]+$/);
  });
});

describe("tokenization and similarity", () => {
  it("removes stopwords and short tokens", () => {
    expect(tokenize("The cat is on a mat")).toEqual(["cat", "mat"]);
  });

  it("normalizeTitle strips punctuation", () => {
    expect(normalizeTitle("Quake: 5.6 — Taiwan!")).toBe("quake 5 6 taiwan");
  });

  it("jaccard is 1 for identical sets and 0 for disjoint", () => {
    const a = tokenSet("earthquake strikes taiwan coast");
    expect(jaccard(a, tokenSet("earthquake strikes taiwan coast"))).toBe(1);
    expect(jaccard(a, tokenSet("inflation rises in argentina"))).toBe(0);
  });

  it("jaccard handles empty sets", () => {
    expect(jaccard(new Set(), new Set(["a"]))).toBe(0);
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
});

describe("sanitizeText", () => {
  it("strips tags and control characters", () => {
    expect(sanitizeText("<b>Hello</b>\u0000 world")).toBe("Hello world");
  });

  it("collapses whitespace", () => {
    expect(sanitizeText("a    b\n\nc")).toBe("a b c");
  });

  it("neutralises script content by tag removal", () => {
    expect(sanitizeText('alert("x")<script>evil()</script>')).not.toContain("<script>");
  });
});

describe("truncate and wordCount", () => {
  it("truncates with ellipsis", () => {
    expect(truncate("abcdefghij", 5)).toHaveLength(5);
    expect(truncate("abc", 10)).toBe("abc");
  });

  it("counts words", () => {
    expect(wordCount("one two  three")).toBe(3);
  });
});
