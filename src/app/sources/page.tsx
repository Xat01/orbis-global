"use client";

import { ExternalLink } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { relativeTime } from "@/lib/util/time";

interface SourceRow {
  id: string;
  name: string;
  homepage: string;
  feedUrl: string;
  type: string;
  coverage: string[];
  topics: string[];
  attribution: string;
  lastRetrievedAt: string | null;
  lastStatus: string;
  lastError: string | null;
  itemCount: number;
}

interface SourcesResponse {
  sources: SourceRow[];
  disabled: Array<{ id: string; name: string; homepage: string; reason: string }>;
  meta: { generatedAt: string; fixtureMode: boolean; aiConfigured: boolean; errors: Array<{ sourceId: string; error: string }> };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm leading-relaxed text-ink">{children}</CardContent>
    </Card>
  );
}

export default function SourcesPage() {
  const { data, error, loading, refetch } = useApi<SourcesResponse>("/api/sources");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">Sources &amp; Methodology</h1>
        <p className="text-sm text-muted">
          Exactly what ORBIS collects, how it groups and explains it, and what it cannot do.
        </p>
      </div>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState error={error} onRetry={refetch} /> : null}

      {data ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Active sources</CardTitle>
              <Badge tone={data.meta.errors.length ? "amber" : "green"}>
                {data.meta.errors.length
                  ? `${data.meta.errors.length} retrieval error(s)`
                  : "all healthy"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.sources.map((s) => (
                <div key={s.id} className="rounded border border-line p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={s.homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm font-semibold text-ink hover:text-accent"
                    >
                      {s.name}
                      <ExternalLink className="h-3 w-3 text-accent" />
                    </a>
                    <Badge tone="neutral">{s.type}</Badge>
                    <Badge tone={s.lastStatus === "ok" ? "green" : s.lastStatus === "error" ? "red" : "neutral"}>
                      {s.lastStatus === "ok"
                        ? `ok · ${s.itemCount} items`
                        : s.lastStatus === "error"
                          ? "retrieval error"
                          : s.lastStatus}
                    </Badge>
                  </div>
                  <div className="mt-1.5 grid gap-1 text-[11px] text-muted sm:grid-cols-2">
                    <p>
                      Last successful retrieval:{" "}
                      {s.lastRetrievedAt ? relativeTime(s.lastRetrievedAt) : "none this session"}
                    </p>
                    <p>
                      Retrieval method: HTTP feed fetch (allowlisted URL, 15s timeout, 5 MB cap, SSRF
                      checks)
                    </p>
                    <p>Coverage: {s.coverage.join(", ")}</p>
                    <p>Topics: {s.topics.join(", ")}</p>
                    <p className="sm:col-span-2">
                      Attribution: {s.attribution} — ORBIS links to originals and stores only
                      headline + short summary.
                    </p>
                    {s.lastError ? (
                      <p className="sm:col-span-2 text-danger">Last error: {s.lastError}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {data.disabled.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Configured but disabled</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.disabled.map((d) => (
                  <div key={d.id} className="rounded border border-line bg-surface-2/50 p-2.5">
                    <p className="text-sm font-medium text-ink">{d.name}</p>
                    <p className="mt-0.5 text-xs text-muted">{d.reason}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Section title="How ORBIS collects information">
            <p>
              ORBIS polls a fixed allowlist of public feeds — established news organisations&apos;
              RSS/Atom feeds, official primary feeds (USGS seismic, CISA exploited-vulnerability
              catalog) and approved humanitarian APIs. Adapters fetch with strict timeouts and size
              caps, validate responses, normalize fields and preserve attribution.
            </p>
            <p>
              Notice: a broken source never breaks the rest — failures are isolated, recorded and
              surfaced as source status. Periodically retrieved data is <strong>not</strong>{" "}
              real-time; every item shows its retrieval time.
            </p>
          </Section>

          <Section title="How reports are grouped into events">
            <p>
              Duplicates are removed by canonical URL and same-source title normalization.
              Remaining reports are clustered when headline similarity is high enough (token
              Jaccard ≥ 0.42, or ≥ 0.28 with a shared location) inside a 7-day window. Structured
              hazard items with precise coordinates and a measured event time cluster by (place, UTC
              day) so separate incidents never merge.
            </p>
            <p>
              Differing accounts are preserved. When sources frame a development differently, the
              event is labelled <em>conflicting reports</em> rather than being merged into a single
              false consensus.
            </p>
          </Section>

          <Section title="Significance scoring (transparent)">
            <p className="font-mono text-xs">
              score = (recency + sourceCount + sourceQuality + geoScope) × categoryWeight
            </p>
            <ul className="list-inside list-disc space-y-0.5 text-xs text-muted">
              <li>recency: &lt;6h = 3, &lt;24h = 2, &lt;72h = 1, older = 0.25</li>
              <li>sourceCount: 1 → 1, 2 → 2, 3+ → 3 distinct sources</li>
              <li>sourceQuality: official/primary = 2, established news = 1</li>
              <li>geoScope: global 2 · region 1.5 · country 1 · city/exact 0.75</li>
              <li>
                categoryWeight: armed conflict / natural disaster / public health 1.5 ·
                cybersecurity / diplomacy / geopolitics / economics 1.2 · others 1
              </li>
              <li>levels: critical ≥ 13 · notable ≥ 8 · routine otherwise</li>
            </ul>
          </Section>

          <Section title="Evidence labels">
            <p>
              Labels are applied only when the evidence supports them:{" "}
              <em>multiple sources agree</em>, <em>single-source report</em>,{" "}
              <em>official statement</em>, <em>developing</em>, <em>conflicting reports</em>,{" "}
              <em>unverified claim</em>, <em>corrected or retracted</em>. Repeated articles derived
              from one original source are never counted as independent corroboration.
            </p>
          </Section>

          <Section title="AI summarisation and fallback">
            <p>
              Briefings are generated by a provider-independent interface. When an AI provider is
              configured via environment variables, model output is schema-validated, grounded in
              supplied source excerpts, and claims are mapped to real source IDs. Retrieved text is
              treated as untrusted: it is length-capped, stripped of control characters and wrapped
              in explicit data delimiters, with system instructions that cannot be overridden by
              source content.
            </p>
            <p>
              Without a provider (or when a request fails), ORBIS produces <strong>basic
              deterministic summaries</strong> from metadata, labels them clearly, and keeps working.
              It never fabricates AI output or confidence percentages.
            </p>
            <p className="text-xs text-muted">
              Current status:{" "}
              {data.meta.aiConfigured
                ? "AI provider configured (see Settings)."
                : "no AI provider configured — basic summaries in use."}
            </p>
          </Section>

          <Section title="Limitations (stated plainly)">
            <ul className="list-inside list-disc space-y-0.5 text-sm">
              <li>Only headline-level metadata is stored — not full article text.</li>
              <li>ORBIS does not independently verify claims; it attributes them.</li>
              <li>
                Locations for country-level stories are approximate area centroids, never presented
                as precise incident points.
              </li>
              <li>Ingestion is on-demand with caching; there is no real-time stream.</li>
              <li>Saved items, alerts and preferences live only in this browser.</li>
              <li>No deployment, no public exposure: ORBIS runs locally by design.</li>
            </ul>
          </Section>
        </>
      ) : null}
    </div>
  );
}
