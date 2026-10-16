import { describe, expect, it } from "vitest";
import {
  checkUrlSafe,
  checkUrlStatic,
  isPrivateAddress,
} from "@/lib/security/urlGuard";

describe("isPrivateAddress", () => {
  it("flags loopback and private IPv4 ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.5",
      "172.16.0.1",
      "172.31.255.254",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "255.255.255.255",
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("allows public IPv4", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "203.0.114.7"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it("flags loopback, link-local and unique-local IPv6", () => {
    for (const ip of ["::1", "::", "fe80::1", "fc00::1", "fd12::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it("allows public IPv6", () => {
    expect(isPrivateAddress("2606:4700::1111")).toBe(false);
  });

  it("treats non-IP strings as unsafe", () => {
    expect(isPrivateAddress("not-an-ip")).toBe(true);
  });
});

describe("checkUrlStatic", () => {
  it("rejects unsupported schemes", () => {
    for (const url of [
      "file:///etc/passwd",
      "ftp://example.com/x",
      "javascript:alert(1)",
      "gopher://example.com",
      "data:text/html,<script>",
    ]) {
      expect(checkUrlStatic(url).ok, url).toBe(false);
    }
  });

  it("rejects localhost and metadata hostnames", () => {
    expect(checkUrlStatic("http://localhost/x").ok).toBe(false);
    expect(checkUrlStatic("http://localhost:3000/x").ok).toBe(false);
    expect(checkUrlStatic("http://metadata.google.internal/").ok).toBe(false);
  });

  it("rejects literal private IP hosts", () => {
    expect(checkUrlStatic("http://127.0.0.1/").ok).toBe(false);
    expect(checkUrlStatic("http://[::1]/").ok).toBe(false);
    expect(checkUrlStatic("http://169.254.169.254/latest/meta-data/").ok).toBe(false);
  });

  it("allows public https URLs", () => {
    expect(checkUrlStatic("https://feeds.bbci.co.uk/news/world/rss.xml").ok).toBe(true);
  });

  it("rejects malformed URLs", () => {
    expect(checkUrlStatic("not a url").ok).toBe(false);
  });
});

describe("checkUrlSafe (DNS layer)", () => {
  it("blocks hostnames that resolve into private space", async () => {
    // localhost resolves to loopback even though the name itself is also blocked
    const verdict = await checkUrlSafe("http://localhost:8080/admin");
    expect(verdict.ok).toBe(false);
  });

  it("allows a public IP literal without DNS", async () => {
    const verdict = await checkUrlSafe("https://1.1.1.1/");
    expect(verdict.ok).toBe(true);
  });
});
