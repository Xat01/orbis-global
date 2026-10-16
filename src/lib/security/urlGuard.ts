import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// ---------------------------------------------------------------------------
// SSRF protection for any server-side outbound URL fetch.
//
// Defence layers:
//   1. scheme allowlist (http/https only)
//   2. configured source allowlist (registry) — primary control
//   3. DNS resolution → reject loopback / link-local / private / CGNAT /
//      metadata / multicast addresses (IPv4 + IPv6)
//   4. redirect handling re-validates every hop
//   5. timeouts and response size caps (enforced by callers via helpers here)
//
// NOTE: hostname-string checks alone are NOT trusted; every hostname is
// resolved and every resolved address is inspected.
// ---------------------------------------------------------------------------

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "instance-data", // AWS/Azure/GCP instance metadata aliases
]);

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export interface UrlVerdict {
  ok: boolean;
  reason?: string;
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 + 192.0.2.0/24
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("::ffff:")) {
    const v4 = normalized.slice("::ffff:".length);
    if (isIP(v4) === 4) return isPrivateIPv4(v4);
    return true;
  }
  // fc00::/7 unique local, fe80::/10 link-local
  if (/^f[cd]/.test(normalized)) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith("64:ff9b:")) return true; // NAT64
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true; // not a valid IP at all → treat as unsafe
}

/** Static check: scheme + hostname blocklist. No DNS involved. */
export function checkUrlStatic(rawUrl: string): UrlVerdict {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "invalid-url" };
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: "protocol-not-allowed" };
  }
  // Strip the brackets WHATWG URL keeps around literal IPv6 hosts, e.g. "[::1]".
  const host = url.hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, reason: "blocked-hostname" };
  }
  // Literal IP hosts are checked immediately (no DNS needed).
  if (isIP(host)) {
    if (isPrivateAddress(host)) {
      return { ok: false, reason: "private-address" };
    }
  }
  return { ok: true };
}

/** Full check: static rules + DNS resolution + resolved-address inspection. */
export async function checkUrlSafe(rawUrl: string): Promise<UrlVerdict> {
  const staticVerdict = checkUrlStatic(rawUrl);
  if (!staticVerdict.ok) return staticVerdict;

  const url = new URL(rawUrl);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (isIP(host)) return { ok: true }; // already validated above

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    return { ok: false, reason: "dns-lookup-failed" };
  }
  if (addresses.length === 0) return { ok: false, reason: "dns-no-address" };
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      return { ok: false, reason: "resolved-to-private-address" };
    }
  }
  return { ok: true };
}

export const FETCH_TIMEOUT_MS = 15_000;
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Safe fetch with timeout + response-size cap + optional redirect
 * re-validation against the SSRF rules. Every redirect hop is re-checked.
 */
export async function safeFetch(
  rawUrl: string,
  opts: {
    timeoutMs?: number;
    maxBytes?: number;
    headers?: Record<string, string>;
    allowPrivate?: boolean; // tests only — never set in app code
  } = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? FETCH_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? MAX_RESPONSE_BYTES;

  let currentUrl = rawUrl;
  const maxRedirects = 5;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (!opts.allowPrivate) {
      const verdict = await checkUrlSafe(currentUrl);
      if (!verdict.ok) {
        throw new Error(`blocked-url:${verdict.reason}`);
      }
    }
    const res = await fetch(currentUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "user-agent": "ORBIS/0.1 (local situational intelligence; +https://github.com/Xat01/orbis-global)",
        accept: "*/*",
        ...opts.headers,
      },
    });
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get("location");
      if (!location) throw new Error("redirect-without-location");
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    // Enforce size cap while reading.
    const lengthHeader = res.headers.get("content-length");
    if (lengthHeader && Number(lengthHeader) > maxBytes) {
      throw new Error("response-too-large");
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > maxBytes) throw new Error("response-too-large");
    return new Response(buf, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  }
  throw new Error("too-many-redirects");
}
