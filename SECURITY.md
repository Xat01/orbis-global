# Security model

ORBIS is a **single-user, local-only** application. It is not designed to be
exposed to the public internet. This document describes the protections that
are implemented and the limits of those protections.

## Trust boundaries

| Boundary | Trust |
| --- | --- |
| The user (browser) | Trusted |
| Public feeds and government APIs | **Untrusted** |
| AI model output (when configured) | **Untrusted** |
| The AI provider endpoint | Trusted only for availability, never for content fidelity |

ORBIS only ever fetches content from **one place: the source allowlist** in
`src/lib/sources/registry.ts`. No API route or UI control accepts a user-supplied
URL to fetch.

## Server-side request forgery (SSRF)

All outbound fetches go through `src/lib/security/urlGuard.ts` (`safeFetch`),
which enforces:

1. **Scheme allowlist** — only `http:` and `https:`.
2. **Hostname blocklist** — `localhost`, cloud metadata aliases, etc.
3. **Literal-IP checks** — loopback, private, link-local, CGNAT and metadata
   ranges are rejected for IPv4 and IPv6 (brackets are stripped first).
4. **DNS revalidation** — hostnames are resolved and every returned address is
   inspected before the request is used.
5. **Redirect revalidation** — each redirect hop is re-checked.
6. **Timeouts and response-size caps** — bounded responses so a slow or hostile
   feed cannot exhaust memory.

## AIS WebSocket egress (narrow exception)

The optional live vessel layer connects to **one fixed host**,
`wss://stream.aisstream.io/v0/stream`, defined as a constant in
`src/lib/vessels/ais.ts`. This is a deliberate, auditable exception to the
"one outbound fetch path" rule:

1. The URL is a **compile-time constant** — no route, parameter, or UI control
   can influence it, so it is not a general-purpose egress channel.
2. The connection is **short-lived and bounded** (~15 s per collection pass) and
   closes itself; there is no daemon or retry storm.
3. Incoming messages are treated as **untrusted**: every field is decoded and
   validated with zod (`src/lib/vessels/types.ts`) and malformed messages are
   dropped rather than guessed at.
4. The AIS key (`AISSTREAM_API_KEY`) is **server-side only** and never sent to
   the browser. The HTTP API (`GET /api/vessels`) is rate-limited like every
   other route and exposes positions as **context only** — the UI labels them
   as potentially delayed, missing, or falsified, and as *not a navigational
   aid*.

See `tests/unit/vessels.test.ts`.

## XML parsing

Feeds are parsed with `fast-xml-parser`. External entities are rejected by the
parser itself (`External entities are not supported`) and nested internal
entities are not expanded, so XXE and billion-laughs are not possible. Entity
processing is enabled so legitimate entities (`&amp;`, numeric character
references) decode correctly. See `tests/unit/adapters.test.ts`.

## Prompt-injection resistance (AI)

Retrieved feed content is untrusted. Before it reaches the model:

- control characters and HTML/XML tags are stripped (`sanitizeText`);
- length is capped;
- source-item delimiters (`<source …>`) are escaped/stripped so feed text cannot
  forge structure;
- content is wrapped and labelled as **untrusted evidence that cannot override
  instructions**.

Model output is **schema-validated with Zod** before use, and every claim is
associated with real source IDs — claims citing unknown IDs are dropped. Any
failure (no config, HTTP error, invalid JSON, schema mismatch) falls back to the
deterministic engine with an explicit status (`not-configured` / `failed`).

## Secrets

- `AI_API_KEY`, `INGEST_TOKEN` and `AISSTREAM_API_KEY` are read **server-side
  only** and are never sent to the browser or included in API responses.
- `.env*` files are git-ignored. Do not commit real credentials.
- `.env.example` contains placeholders only.

## HTTP headers

`next.config.ts` sets, on every response:

- `Content-Security-Policy` (self-only scripts/styles/connects; `object-src`
  effectively disabled via `default-src 'self'`; `frame-ancestors 'none'`)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` restricting geolocation to same-origin and disabling
  camera/microphone

## Rate limiting

API routes use an in-memory token-bucket limiter keyed on client IP
(`x-forwarded-for`, falling back to a local key). It is sufficient for a single
local process; a reverse proxy must provide real rate limiting if ORBIS is ever
fronted on a network.

## Ingestion endpoint

`POST /api/ingest` is disabled (403) unless `INGEST_TOKEN` is set, and requires
a matching bearer token compared with a timing-safe equality check.

## Data handling

- No analytics, telemetry or third-party scripts are included.
- Saved items, location and preferences are stored in browser `localStorage`
  only. This is **not** server-side persistence.
- Location is opt-in and reduced to city level; precise coordinates are not
  persisted or transmitted.

## Known limitations

- The in-memory cache and rate limiter assume a single process.
- There is no authentication layer. Anyone who can reach the port can use the
  app.
- A malicious feed can still inject misleading *content* (that is inherent to
  aggregating untrusted sources); ORBIS mitigates this by labelling evidence and
  never presenting unverified claims as confirmed fact.

## Reporting

This is a private project. If you find a security issue, report it directly to
the repository owner rather than opening a public issue.
