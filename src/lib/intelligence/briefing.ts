import type {
  Article,
  Briefing,
  BriefingMode,
  Event,
  EventUpdate,
} from "@/lib/types";
import { CRITICAL_THRESHOLD, NOTABLE_THRESHOLD } from "@/lib/ingest/significance";
import { truncate } from "@/lib/util/text";
import { relativeTime } from "@/lib/util/time";

// ---------------------------------------------------------------------------
// Deterministic briefing engine.
//
// Produces an evidence-grounded structured briefing from ingested metadata.
// It never invents facts: everything derives from titles, sources, locations
// and timestamps actually ingested. Analysis-style fields are templated per
// category and explicitly labelled as analysis in the UI.
//
// When no AI provider is configured (or the AI call fails), this engine is
// the fallback and the briefing is marked generator="deterministic" so the
// UI can label it "basic summary".
// ---------------------------------------------------------------------------

const LOCATION_TEXT: Record<string, string> = {
  exact: "precisely located",
  city: "city-level location",
  admin: "province/state-level location",
  country: "country-level location only",
  region: "regional location",
  uncertain: "location uncertain",
};

function geoSentence(event: Event): string {
  const g = event.primaryGeo;
  const parts: string[] = [];
  if (g.kind === "uncertain") {
    parts.push("The available reporting does not establish a specific location.");
  } else {
    const scope = LOCATION_TEXT[g.kind] ?? "approximate location";
    parts.push(`Reported in connection with ${g.name} (${scope}).`);
    if (g.kind === "country" || g.kind === "region") {
      parts.push(
        "No more precise location is claimed — coordinates shown on the map are area centroids, not incident points.",
      );
    }
  }
  return parts.join(" ");
}

function timeSentence(event: Event, articles: Article[]): string {
  const parts: string[] = [];
  const withEventTime = articles.find((a) => a.eventTime);
  if (withEventTime?.eventTime) {
    parts.push(
      `The underlying development occurred around ${new Date(withEventTime.eventTime).toISOString().replace("T", " ").slice(0, 16)} UTC (as measured by the reporting source).`,
    );
  } else {
    parts.push("The exact occurrence time is not established in the available reporting.");
  }
  parts.push(
    `First report retrieved: ${relativeTime(event.firstSeenAt)}; latest update ${relativeTime(event.lastUpdatedAt)}.`,
  );
  return parts.join(" ");
}

const ORG_PATTERNS: Array<[RegExp, string]> = [
  [/\bun\b|united nations|un security council|secretary-general/i, "United Nations"],
  [/\bwho\b|world health organization/i, "World Health Organization"],
  [/\bnato\b/i, "NATO"],
  [/\beu\b|european union|european commission/i, "European Union"],
  [/\bwhite house\b|pentagon|state department|u\.?s\.? government/i, "US government"],
  [/\bkremlin\b|russian (?:government|mod)\b/i, "Russian government"],
  [/\bcentral bank\b|\bfed\b|\becb\b/i, "central bank"],
  [/\bcisa\b/i, "CISA"],
  [/\busgs\b/i, "USGS"],
];

function involvedActors(event: Event, articles: Article[]): string {
  const text = `${event.title} ${articles.map((a) => `${a.title} ${a.description}`).join(" ")}`;
  const found = new Set<string>();
  for (const [re, name] of ORG_PATTERNS) if (re.test(text)) found.add(name);
  for (const g of event.geo) if (g.country) found.add(g.country);
  if (found.size === 0) {
    return "The available reporting does not clearly identify the key actors; see the source list.";
  }
  return `Entities named or implicated in the reporting: ${[...found].slice(0, 6).join(", ")}.`;
}

const CATEGORY_NEXT: Record<string, string[]> = {
  "armed-conflict": [
    "Watch for official statements from the parties and any ceasefire or escalation announcements.",
    "Watch for independently corroborating reporting from outlets with access on the ground.",
  ],
  "natural-disaster": [
    "Watch for updated casualty/impact figures as assessments mature.",
    "Watch for follow-up advisories from geophysical or civil-protection agencies.",
  ],
  cybersecurity: [
    "Watch for vendor patches and follow-up advisories from national CERTs.",
    "Watch for confirmation of impact scope — initial reports often overstate it.",
  ],
  economics: [
    "Watch for official policy communications and market reaction.",
    "Watch for data releases that confirm or contradict the reported trend.",
  ],
  diplomacy: [
    "Watch for joint statements or readouts from the parties involved.",
    "Watch for concrete follow-up steps — summits often produce framework language without binding detail.",
  ],
  "public-health": [
    "Watch for updated case counts from health authorities.",
    "Watch for official guidance changes.",
  ],
};

const DEFAULT_NEXT = [
  "Watch for independent corroboration and official responses.",
  "Watch for material updates that change the assessed status of this development.",
];

/**
 * The assessment rules that actually fired for this event, stated in plain
 * language with their real thresholds. Rendered verbatim in the UI under
 * "How this was assessed" so the reader can audit the logic.
 */
export function assessmentRules(event: Event, updates: EventUpdate[]): string[] {
  const n = event.sourceIds.length;
  const rules: string[] = [];

  rules.push(
    n >= 3
      ? `Source-diversity rule: ${n} independent sources reported this (threshold 3) — details treated as corroborated.`
      : n === 2
        ? "Source-diversity rule: exactly 2 independent sources — corroborated, but wording may still change."
        : "Source-diversity rule: single source — treated as provisional until independently confirmed.",
  );
  if (event.evidenceLabels.includes("conflicting-accounts")) {
    rules.push(
      "Conflict rule: headline wording diverges materially across sources — both framings are listed under “uncertain”, not “confirmed”.",
    );
  }
  if (event.evidenceLabels.includes("corrected-or-retracted")) {
    rules.push("Correction rule: at least one source issued a correction — earlier details are downgraded.");
  }
  if (event.evidenceLabels.includes("single-source")) {
    rules.push("Uncertainty rule: no detail appears under “confirmed” unless a source directly states it.");
  }

  const { score, level } = event.significance;
  rules.push(
    level === "critical"
      ? `Significance rule: score ${score} ≥ ${CRITICAL_THRESHOLD} → “critical”.`
      : level === "notable"
        ? `Significance rule: score ${score} ≥ ${NOTABLE_THRESHOLD} → “notable” (below the critical threshold of ${CRITICAL_THRESHOLD}).`
        : `Significance rule: score ${score} < ${NOTABLE_THRESHOLD} → “routine”; most events are, deliberately.`,
  );

  rules.push(
    event.primaryGeo.kind === "exact"
      ? "Location rule: reporting gives a precise location — the map marker is the reported point."
      : `Location rule: ${event.primaryGeo.kind}-level precision — map coordinates are an area centroid, not an incident point.`,
  );

  rules.push(
    articlesRuleText(event),
  );

  if (updates.length > 0) {
    rules.push(
      `Currency rule: the last-updated time comes from the most recent of ${updates.length} recorded change${updates.length === 1 ? "" : "s"}; stale claims are re-timestamped only when a source updates them.`,
    );
  }
  return rules;
}

function articlesRuleText(event: Event): string {
  return `Evidence rule: only claims traceable to the ${event.sourceIds.length} listed source${event.sourceIds.length === 1 ? "" : "s"} appear in the confirmed list; full article text is not stored.`;
}

/**
 * A readable multi-sentence narrative of the event, composed only from the
 * structured fields ORBIS actually has. Length follows the briefing mode
 * (quick = 2 sentences … detailed = full account).
 */
function buildSummary(input: {
  event: Event;
  articles: Article[];
  mode: BriefingMode;
  uncertain: string[];
  watch: string[];
}): string {
  const { event, articles, mode, uncertain, watch } = input;
  const n = event.sourceIds.length;

  const sentences: string[] = [];
  sentences.push(
    `${truncate(event.title, 300)} — reported in connection with ${event.primaryGeo.name}, first seen ${relativeTime(event.firstSeenAt)}${
      event.lastUpdatedAt !== event.firstSeenAt ? `, last updated ${relativeTime(event.lastUpdatedAt)}` : ""
    }.`,
  );
  sentences.push(
    `${n} independent source${n === 1 ? "" : "s"} across ${articles.length} article${articles.length === 1 ? "" : "s"} have reported this; ${
      event.evidenceLabels.includes("single-source")
        ? "it remains a single-source account, so details are provisional."
        : "the core claim is corroborated across them."
    }`,
  );
  const who = involvedActors(event, articles);
  sentences.push(
    who.startsWith("Entities named")
      ? `${who} Assessed as ${event.significance.level} significance under ORBIS scoring criteria.`
      : `Key actors are not clearly identified in the available reporting (assessed as ${event.significance.level} significance).`,
  );
  if (uncertain.length > 0) {
    sentences.push(`Main caveat: ${truncate(uncertain[0], 260)}`);
  } else {
    sentences.push("No material caveats were recorded from the available metadata.");
  }
  sentences.push(
    `What to watch: ${truncate(watch[0] ?? "independent corroboration and official responses.", 260)}`,
  );

  const limit =
    mode === "quick" ? 2 : mode === "standard" ? Math.min(sentences.length, 4) : sentences.length;
  return sentences.slice(0, limit).join(" ");
}

export function generateDeterministicBriefing(input: {
  event: Event;
  articles: Article[];
  updates: EventUpdate[];
  mode: BriefingMode;
}): Briefing {
  const { event, articles, updates, mode } = input;

  const confirmed: string[] = [];
  const uncertain: string[] = [];

  confirmed.push(
    `${event.sourceIds.length} distinct source${event.sourceIds.length === 1 ? "" : "s"} (${event.sourceNames.slice(0, 4).join(", ")}) reported this development.`,
  );
  if (event.evidenceLabels.includes("official-statement")) {
    confirmed.push("An official or primary source (e.g. UN, USGS, CISA) is among the reporting.");
  }
  const eq = articles.find((a) => a.eventTime);
  if (eq?.eventTime) {
    confirmed.push(`A primary measurement feed recorded the event time (${eq.sourceName}).`);
  }

  if (event.evidenceLabels.includes("single-source")) {
    uncertain.push(
      "Single-source report — not yet independently corroborated; treat details as provisional.",
    );
  }
  if (event.evidenceLabels.includes("conflicting-accounts")) {
    uncertain.push(
      "Sources frame this development differently; headline wording diverges materially across outlets.",
    );
  }
  if (!eq?.eventTime) {
    uncertain.push("Exact timing of the underlying development is not established.");
  }
  if (event.primaryGeo.kind === "country" || event.primaryGeo.kind === "region" || event.primaryGeo.kind === "uncertain") {
    uncertain.push("The precise location within the reported area is not established.");
  }
  if (event.evidenceLabels.includes("corrected-or-retracted")) {
    uncertain.push("At least one source issued a correction — earlier details may be unreliable.");
  }

  const scopeText = event.primaryGeo.country ?? event.primaryGeo.name;

  const why =
    `${event.categories.join(", ").replace(/-/g, " ")} development` +
    (event.primaryGeo.region ? ` with implications relevant to ${event.primaryGeo.region.replace(/-/g, " ")}` : "") +
    `. Reporting volume: ${articles.length} article${articles.length === 1 ? "" : "s"} from ${event.sourceIds.length} independent source${event.sourceIds.length === 1 ? "" : "s"}.` +
    (event.significance.level === "critical"
      ? " Assessed as high significance under ORBIS criteria (see Sources & Methodology)."
      : event.significance.level === "notable"
        ? " Assessed as notable under ORBIS criteria."
        : "");

  const next = CATEGORY_NEXT[event.categories[0]] ?? DEFAULT_NEXT;

  const watch = [
    "New independent sources joining the reporting.",
    ...updates.slice(0, 2).map((u) => `Change of type “${u.changeType.replace(/-/g, " ")}” recorded ${relativeTime(u.publishedAt ?? u.observedAt)}.`),
  ];

  const limitations = [
    "This briefing is generated from headline metadata (titles, summaries, timestamps, locations) — full article text is not stored.",
    "ORBIS does not verify claims independently; it reports what sources state and labels the evidence.",
  ];
  if (mode === "detailed") {
    limitations.push(
      `Chronology consists of ${updates.length} recorded update${updates.length === 1 ? "" : "s"} since first detection; earlier history is not available.`,
    );
  }

  const sources = articles.map((a) => ({
    sourceId: a.sourceId,
    sourceName: a.sourceName,
    url: a.url,
    title: a.title,
    publishedAt: a.publishedAt,
  }));

  const brief: Briefing = {
    eventId: event.id,
    mode,
    generatedAt: new Date().toISOString(),
    generator: "deterministic",
    summary: buildSummary({ event, articles, mode, uncertain, watch }),
    rules: assessmentRules(event, updates),
    whatHappened: truncate(event.title, 400),
    whereWhen: `${geoSentence(event)} ${timeSentence(event, articles)}`,
    whoIsInvolved: involvedActors(event, articles),
    confirmed,
    uncertain,
    whyItMatters: why,
    analysisLabel: "Analysis (rule-based): significance and implications are derived from ORBIS scoring criteria, not from source claims.",
    whatCouldHappenNext: next,
    affected: `Reported area: ${scopeText}. Persons or systems plausibly affected cannot be enumerated from metadata alone; see sources for specifics.`,
    watchNext: watch,
    limitations,
    sources,
  };
  return brief;
}
