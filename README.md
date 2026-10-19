# ORBIS — Global Situational Intelligence

> Understand the world. See what matters.

ORBIS is a **local-only** situational-awareness web app. It pulls from a small,
explicitly allow-listed set of public feeds and government sources, groups
reports about the same development into **events**, scores their significance,
records **what changed** over time, and produces **structured briefings**.

It is designed to be honest about what it knows:

- every summary is labelled with the evidence behind it (single-source,
  conflicting accounts, official confirmation, corrections);
- AI is optional — without a configured provider ORBIS generates
  **deterministic, rule-based briefings** and says so in the UI;
- the app **runs entirely on your machine**. There is no cloud backend, no
  analytics, and no deployment.

## What is real vs. what is fixture data

- In normal operation (`npm run dev`) ORBIS fetches the live public feeds listed
  below on demand.
- When started with `ORBIS_E2E=1` (used by the automated tests) it serves
  deterministic **fixture** data through the real pipeline and displays a
  prominent **“TEST FIXTURE MODE”** badge. Fixture data is never presented as
  live.

## Quick start

```bash
# 1. Install dependencies (project pins an allow-scripts allowlist in package.json)
npm install

# 2. Start the dev server. Port 3000 is often busy; use 3001.
npm run dev -- -p 3001
```

Open <http://localhost:3001>. No environment variables are required.

### Optional configuration

Copy `.env.example` to `.env.local` and set only what you need:

| Variable | Purpose |
| --- | --- |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | Enable AI briefings via any OpenAI-compatible chat-completions endpoint. Server-side only. |
| `INGEST_TOKEN` | Bearer token required by `POST /api/ingest`. If unset, the endpoint is disabled (403). |
| `ORBIS_TILE_URL`, `ORBIS_TILE_ATTRIBUTION` | Custom raster tile provider. When omitted the map uses OpenFreeMap vector basemaps (free, no key), which follow the light/dark theme. |
| `ORBIS_RELIEFWEB_APPNAME` | Enables the ReliefWeb source (see below). |
| `ORBIS_SOURCE_<ID>_DISABLED=1` | Disable an individual source by id. |
| `AISSTREAM_API_KEY` | Enables the optional live vessel (AIS) layer on the World Map. Free key from <https://aisstream.io>; server-side only. Without a key the map shows the always-on maritime reference layer (watch area, major straits) plus clearly-labelled demo positions. |
| `ORBIS_AIS_BOXES` | AIS watch area as JSON `[[south, west], [north, east]]` boxes. Defaults to the Gulf / Red Sea corridor. |
| `ORBIS_AIS_NAVAL_MMSIS` | Optional comma-separated or JSON list of 9-digit MMSIs known to be naval hulls; listed vessels get a "listed" badge. Heuristic badges (ship-name prefixes such as HMS/USS) appear regardless — both are labelled unverified. |

## Data sources

The outbound URL allowlist lives in `src/lib/sources/registry.ts`. Adapters may
only fetch URLs from that list — users can never supply a fetch URL.

| Source | Adapter | Status |
| --- | --- | --- |
| BBC World (RSS) | `rss` | ✅ verified reachable |
| Al Jazeera English (RSS) | `rss` | ✅ verified reachable |
| Khaleej Times (RSS) | `rss` | ✅ verified reachable |
| The Guardian World (RSS) | `rss` | ✅ verified reachable |
| UN News (RSS) | `rss` | ✅ verified reachable |
| DW English (RDF / RSS 1.0) | `rss` | ✅ verified reachable |
| USGS M2.5+ earthquakes (GeoJSON) | `usgs` | ✅ verified reachable |
| CISA Known Exploited Vulnerabilities (JSON) | `cisa-kev` | ✅ verified reachable |
| ReliefWeb (v2 API) | `reliefweb` | ⛔ disabled by default — the v2 API requires an approved `appname`; set `ORBIS_RELIEFWEB_APPNAME` to enable |

GDACS was evaluated and dropped (endpoint unavailable). ReliefWeb **v1** has
been decommissioned by the provider (HTTP 410).

## How data flows

```
public feeds ──▶ adapters (validate + normalize)
              ──▶ dedupe (canonical URL / title)
              ──▶ cluster into events (similarity + structured hazard keying)
              ──▶ significance scoring + evidence labelling
              ──▶ snapshot cache (.orbis-cache/snapshot.json)
              ──▶ API routes ──▶ UI
```

Refreshes are **lazy**: a request triggers a refresh only when the cached
snapshot is stale (fresh for 20 minutes, served stale up to 6 hours with a
background refresh). There is no background daemon. To drive ingestion from an
external scheduler, set `INGEST_TOKEN` and call:

```bash
curl -X POST http://localhost:3001/api/ingest -H "Authorization: Bearer $INGEST_TOKEN"
```

### API

| Route | Description |
| --- | --- |
| `GET /api/health` | Liveness check |
| `GET /api/overview` | Dashboard payload (top events, changes, aggregates) |
| `GET /api/events` | Filterable event list (`topic`, `region`, `level`, `hours`, `q`, `limit`, `offset`) |
| `GET /api/events/[id]` | One event + articles + updates + briefing (`?mode=quick\|standard\|detailed`) |
| `GET /api/articles` | Normalized article/report list |
| `GET /api/sources` | Source list with per-source status |
| `GET /api/search?q=` | Search across events and reports |
| `POST /api/ingest` | Force a refresh (token-protected) |

## Privacy

- **Everything runs locally.** No data leaves your machine except the outbound
  calls to the public feeds above.
- **Location is opt-in and coarse.** Location is only set after you explicitly
  search for a place or press “use my location”. Browser geolocation is
  converted to the nearest gazetteer city (city-level only); precise
  coordinates are not stored or transmitted.
- **Preferences are browser-local.** Location, saved items and preferences live
  in `localStorage` keys prefixed `orbis.`. This is **not** server-side
  persistence — it is per-browser and can be cleared at any time.

See [`SECURITY.md`](./SECURITY.md) for the security model.

## Testing

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm test              # Vitest unit + integration suite
npx playwright install chromium
npm run test:e2e      # Playwright (starts a fixture-mode server on port 3100)
npm run build         # production build
```

The Vitest suite covers URL canonicalization, SSRF checks, significance
scoring, geo resolution, dedupe/clustering, source adapters (including
XXE-safety), briefing generation, the AI fallback paths, relevance scoring,
environment validation, and the API routes against fixture data.
**Current status: 100 tests passing across 10 files** (`npm test`).

The Playwright suite exercises the UI end-to-end in a desktop and a mobile
viewport — 15 scenarios in each project (30 runs total; the mobile-only drawer
check is skipped on desktop). **Current status: 29 passed, 1 skipped**
(`npm run test:e2e`).

## Limitations

- ORBIS reads **headline metadata** (titles, summaries, timestamps, locations).
  It does not store full article text and does not verify claims independently.
- Significance scoring and briefings are **heuristic**, not authoritative.
- In-app **alerts only** — there is no email, SMS or push infrastructure.
- Feed availability can change without notice; disabled or failing sources are
  reported in the UI rather than hidden.
- Built for a single local user. If you ever expose it on a network, put a
  reverse proxy with authentication and rate limiting in front of it.

## Project structure

```
src/
  app/            Next.js routes (pages + API)
  components/      UI, charts, map, layout
  hooks/           data-fetching hooks
  lib/
    sources/       registry, adapters, fixtures
    ingest/        normalize, dedupe, cluster, significance, pipeline
    intelligence/  briefings, alerts, AI provider
    personalization/ location relevance
    security/      SSRF guard, rate limiting
    store/         snapshot cache
    geo/           gazetteer
tests/            unit, integration, e2e
```

## License

Private project — all rights reserved. Source attributions are shown in the
Sources page and on the map.
