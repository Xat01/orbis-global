import { z } from "zod";

// ---------------------------------------------------------------------------
// Live vessel positions (AIS).
//
// Sourced from AISStream.io, a community AIS receiver network. AIS is a
// best-effort broadcast system: positions can be delayed, missing in busy
// areas, or deliberately falsified. Nothing here is a navigational aid.
//
// ORBIS keeps the vessel *position observation time* (observedAt, reported by
// the vessel) separate from when ORBIS collected it, exactly as it does for
// event times — the two are never conflated.
// ---------------------------------------------------------------------------

export const VesselBoxSchema = z.tuple([
  z.tuple([z.number(), z.number()]),
  z.tuple([z.number(), z.number()]),
]);
export type VesselBox = z.infer<typeof VesselBoxSchema>;

/** AIS navigational status codes (ITU-R M.1371). */
export const NAV_STATUS: Record<number, string> = {
  0: "under way using engine",
  1: "at anchor",
  2: "not under command",
  3: "restricted manoeuvrability",
  4: "constrained by draught",
  5: "moored",
  6: "aground",
  7: "engaged in fishing",
  8: "under way sailing",
  9: "reserved (hazardous material)",
  10: "reserved (hazardous material)",
  11: "towing astern",
  12: "pushing ahead or towing alongside",
  13: "reserved",
  14: "AIS-SART / MOB / EPIRB active",
  15: "undefined",
};

/**
 * Naval/government classification attached to a vessel at serve time.
 * It is always one of two honest kinds:
 *   - "listed":  the MMSI is in the operator's ORBIS_AIS_NAVAL_MMSIS list
 *   - "possible": a heuristic matched (name prefix / destination string)
 * Never a claim of fact — AIS has no vessel-class field, and military
 * vessels commonly do not transmit AIS at all.
 */
export const NavalInfoSchema = z.object({
  kind: z.enum(["listed", "possible"]),
  /** Plain-language reason, shown in the vessel popup. */
  reason: z.string(),
});
export type NavalInfo = z.infer<typeof NavalInfoSchema>;

export const VesselSchema = z.object({
  /** Maritime Mobile Service Identity — the vessel's AIS identifier. */
  mmsi: z.string().min(1),
  name: z.string().nullable(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  /** Speed over ground, knots. */
  sog: z.number().nonnegative().nullable(),
  /** Course over ground, degrees true. */
  cog: z.number().min(0).max(360).nullable(),
  /** True heading, degrees. AIS reserves 511 for "not available". */
  heading: z.number().min(0).max(360).nullable(),
  /** AIS navigational status, decoded for display. */
  navStatus: z.string().nullable(),
  /** When the vessel reported this position (UTC). */
  observedAt: z.string().datetime({ offset: true }),
  /** Ship static data (AIS msg 5): cargo/type code exactly as transmitted. */
  shipType: z.number().int().nonnegative().nullish(),
  /** Ship static data (AIS msg 5): destination field as transmitted. */
  destination: z.string().max(64).nullish(),
  /** Derived naval/government badge; null when nothing matched. */
  naval: NavalInfoSchema.nullish(),
});
export type Vessel = z.infer<typeof VesselSchema>;

export const VesselMetaSchema = z.object({
  generatedAt: z.string().datetime({ offset: true }),
  /** Positions are older than the freshness window but still the latest known. */
  stale: z.boolean(),
  /** A collection pass is in flight; the list may grow on the next request. */
  refreshing: z.boolean(),
  fixtureMode: z.boolean(),
  /**
   * Where the data came from: "aisstream" (live), "demo" (no key configured —
   * clearly-labelled sample positions) or "fixture" (ORBIS_E2E tests only).
   */
  source: z.string(),
  count: z.number().int().nonnegative(),
  /** How long the collector listened for positions. */
  windowSeconds: z.number().nonnegative(),
  /** The watch area the collector subscribed to. */
  boxes: z.array(VesselBoxSchema),
  lastError: z.string().nullable(),
});
export type VesselMeta = z.infer<typeof VesselMetaSchema>;

export const VesselSnapshotSchema = z.object({
  meta: VesselMetaSchema,
  vessels: z.array(VesselSchema),
});
export type VesselSnapshot = z.infer<typeof VesselSnapshotSchema>;
