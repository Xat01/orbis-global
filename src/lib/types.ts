import { z } from "zod";

// ---------------------------------------------------------------------------
// ORBIS core data model.
// All persisted/fetched structures are validated with Zod at trust boundaries.
// ---------------------------------------------------------------------------

export const TOPICS = [
  "geopolitics",
  "diplomacy",
  "armed-conflict",
  "cybersecurity",
  "natural-disaster",
  "weather",
  "environment",
  "economics",
  "public-health",
  "transportation",
  "infrastructure",
  "technology",
] as const;
export const TopicSchema = z.enum(TOPICS);
export type Topic = z.infer<typeof TopicSchema>;

export const REGIONS = [
  "middle-east",
  "europe",
  "north-america",
  "south-america",
  "africa",
  "south-asia",
  "east-asia",
  "southeast-asia",
  "central-asia",
  "oceania",
  "global",
] as const;
export const RegionSchema = z.enum(REGIONS);
export type Region = z.infer<typeof RegionSchema>;

export const SOURCE_TYPES = [
  "news-rss",
  "official-api",
  "government-feed",
  "hazard-feed",
] as const;
export const SourceTypeSchema = z.enum(SOURCE_TYPES);
export type SourceType = z.infer<typeof SourceTypeSchema>;

/** How precisely an event is located. Never fake precision. */
export const LOCATION_PRECISIONS = [
  "exact", // point coordinates from a direct measurement (e.g. seismic epicentre)
  "city",
  "admin", // province/state level
  "country",
  "region", // multi-country area
  "uncertain",
] as const;
export const LocationPrecisionSchema = z.enum(LOCATION_PRECISIONS);
export type LocationPrecision = z.infer<typeof LocationPrecisionSchema>;

export const GeoRefSchema = z.object({
  name: z.string(),
  kind: LocationPrecisionSchema,
  country: z.string().optional(),
  region: RegionSchema.optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  /** Radius (km) within which the true location plausibly lies. */
  precisionRadiusKm: z.number().positive().optional(),
});
export type GeoRef = z.infer<typeof GeoRefSchema>;

export const SourceStatusSchema = z.enum(["ok", "error", "disabled", "never"]);
export type SourceStatus = z.infer<typeof SourceStatusSchema>;

export const SourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  homepage: z.string().url(),
  feedUrl: z.string().url(),
  type: SourceTypeSchema,
  coverage: z.array(RegionSchema),
  topics: z.array(TopicSchema),
  attribution: z.string(),
  enabled: z.boolean(),
  lastRetrievedAt: z.string().nullable(),
  lastStatus: SourceStatusSchema,
  lastError: z.string().nullable(),
  itemCount: z.number().int().nonnegative(),
});
export type Source = z.infer<typeof SourceSchema>;

export const ArticleSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  sourceName: z.string(),
  url: z.string().url(),
  canonicalUrl: z.string(),
  title: z.string().min(1),
  description: z.string(),
  publishedAt: z.string().datetime({ offset: true }),
  retrievedAt: z.string().datetime({ offset: true }),
  language: z.string().nullable(),
  /** When the underlying development occurred, if known (e.g. quake origin time). */
  eventTime: z.string().datetime({ offset: true }).nullable(),
  topics: z.array(TopicSchema),
  geo: z.array(GeoRefSchema),
  eventId: z.string().nullable(),
});
export type Article = z.infer<typeof ArticleSchema>;

export const EVENT_STATUS = [
  "developing",
  "ongoing",
  "contained",
  "resolved",
  "unclear",
] as const;
export const EventStatusSchema = z.enum(EVENT_STATUS);
export type EventStatus = z.infer<typeof EventStatusSchema>;

export const SIGNIFICANCE_LEVELS = ["critical", "notable", "routine"] as const;
export const SignificanceLevelSchema = z.enum(SIGNIFICANCE_LEVELS);
export type SignificanceLevel = z.infer<typeof SignificanceLevelSchema>;

export const SignificanceSchema = z.object({
  score: z.number(),
  level: SignificanceLevelSchema,
  factors: z.object({
    recency: z.number(),
    sourceCount: z.number(),
    sourceQuality: z.number(),
    geoScope: z.number(),
    categoryWeight: z.number(),
  }),
});
export type Significance = z.infer<typeof SignificanceSchema>;

export const EVIDENCE_LABELS = [
  "multiple-sources-agree",
  "single-source",
  "official-statement",
  "developing",
  "conflicting-accounts",
  "unverified",
  "corrected-or-retracted",
] as const;
export const EvidenceLabelSchema = z.enum(EVIDENCE_LABELS);
export type EvidenceLabel = z.infer<typeof EvidenceLabelSchema>;

export const CHANGE_TYPES = [
  "new-information",
  "status-change",
  "official-statement",
  "correction",
  "new-location",
  "warning-issued",
  "warning-withdrawn",
  "new-source",
] as const;
export const ChangeTypeSchema = z.enum(CHANGE_TYPES);
export type ChangeType = z.infer<typeof ChangeTypeSchema>;

export const EventSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  categories: z.array(TopicSchema),
  status: EventStatusSchema,
  primaryGeo: GeoRefSchema,
  geo: z.array(GeoRefSchema),
  firstSeenAt: z.string().datetime({ offset: true }),
  lastUpdatedAt: z.string().datetime({ offset: true }),
  articleIds: z.array(z.string()),
  sourceIds: z.array(z.string()),
  sourceNames: z.array(z.string()),
  significance: SignificanceSchema,
  evidenceLabels: z.array(EvidenceLabelSchema),
});
export type Event = z.infer<typeof EventSchema>;

export const EventUpdateSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  observedAt: z.string().datetime({ offset: true }),
  eventTime: z.string().datetime({ offset: true }).nullable(),
  publishedAt: z.string().datetime({ offset: true }).nullable(),
  changeType: ChangeTypeSchema,
  description: z.string(),
  articleIds: z.array(z.string()),
  previousStatus: EventStatusSchema.nullable(),
  currentStatus: EventStatusSchema.nullable(),
});
export type EventUpdate = z.infer<typeof EventUpdateSchema>;

// ---------------------------------------------------------------------------
// Briefings
// ---------------------------------------------------------------------------

export const BriefingModeSchema = z.enum(["quick", "standard", "detailed"]);
export type BriefingMode = z.infer<typeof BriefingModeSchema>;

export const BriefingSchema = z.object({
  eventId: z.string(),
  mode: BriefingModeSchema,
  generatedAt: z.string().datetime({ offset: true }),
  generator: z.enum(["ai", "deterministic"]),
  whatHappened: z.string(),
  whereWhen: z.string(),
  whoIsInvolved: z.string(),
  confirmed: z.array(z.string()),
  uncertain: z.array(z.string()),
  whyItMatters: z.string(),
  analysisLabel: z.string().nullable(),
  whatCouldHappenNext: z.array(z.string()),
  affected: z.string(),
  watchNext: z.array(z.string()),
  limitations: z.array(z.string()),
  sources: z.array(
    z.object({
      sourceId: z.string(),
      sourceName: z.string(),
      url: z.string(),
      title: z.string(),
      publishedAt: z.string(),
    }),
  ),
});
export type Briefing = z.infer<typeof BriefingSchema>;

// ---------------------------------------------------------------------------
// Snapshot — the full ingested state served to the UI
// ---------------------------------------------------------------------------

export const SnapshotMetaSchema = z.object({
  generatedAt: z.string().datetime({ offset: true }),
  stale: z.boolean(),
  fixtureMode: z.boolean(),
  aiConfigured: z.boolean(),
  errors: z.array(z.object({ sourceId: z.string(), error: z.string() })),
});
export type SnapshotMeta = z.infer<typeof SnapshotMetaSchema>;

export const SnapshotSchema = z.object({
  meta: SnapshotMetaSchema,
  sources: z.array(SourceSchema),
  articles: z.array(ArticleSchema),
  events: z.array(EventSchema),
  updates: z.array(EventUpdateSchema),
});
export type Snapshot = z.infer<typeof SnapshotSchema>;

// ---------------------------------------------------------------------------
// User preferences (browser-local, never sent anywhere)
// ---------------------------------------------------------------------------

export const UserPreferencesSchema = z.object({
  location: z
    .object({
      name: z.string(),
      country: z.string(),
      region: RegionSchema,
      lat: z.number(),
      lng: z.number(),
      precision: LocationPrecisionSchema,
    })
    .nullish(),
  topics: z.array(TopicSchema),
  regions: z.array(RegionSchema),
  briefingMode: BriefingModeSchema,
  alerts: z.object({
    regions: z.array(RegionSchema),
    topics: z.array(TopicSchema),
    minSignificance: SignificanceLevelSchema,
    enabled: z.boolean(),
  }),
});
export type UserPreferences = z.infer<typeof UserPreferencesSchema>;
