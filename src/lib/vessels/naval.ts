import type { NavalInfo, Vessel } from "@/lib/vessels/types";

// ---------------------------------------------------------------------------
// Naval / government vessel classification.
//
// AIS has NO vessel-class field that identifies warships, so this is a
// deliberately conservative heuristic on public data, plus an operator-
// supplied allowlist. Everything it produces is labelled "possible" (or
// "listed" when it came from the operator's own list) — never "military" as
// fact. Equally important: vessels that switch AIS off are invisible here,
// so absence from this layer says nothing about where naval assets are.
// ---------------------------------------------------------------------------

/**
 * Commissioning/ranking prefixes used by navies and government fleets.
 * Matched as whole words at the start of the AIS ship name, so merchant
 * names that merely begin with the same letters (INSPIRATION vs INS …)
 * do not match. Two-letter prefixes are deliberately excluded — too
 * ambiguous against ordinary ship names.
 */
const NAVAL_PREFIXES = [
  "HMS", // Royal Navy
  "HMAS", // Royal Australian Navy
  "HMCS", // Royal Canadian Navy
  "HMNZS", // Royal New Zealand Navy
  "HNOMS", // Royal Norwegian Navy (HNoMS)
  "HDMS", // Royal Danish Navy
  "KDM", // Royal Danish Navy (Danish acronym)
  "FGS", // German Navy
  "RFA", // Royal Fleet Auxiliary (UK)
  "USS", // US Navy
  "USNS", // US Military Sealift Command
  "USCGC", // US Coast Guard
  "INS", // Indian Navy
  "PNS", // Pakistan Navy
  "BNS", // Bangladesh Navy
  "RSS", // Republic of Singapore Navy
  "ROKS", // Republic of Korea Navy
  "HCG", // Indian Coast Guard
  "CCG", // coast guard (Canada / China)
];

/** Destination strings that suggest a naval port or military user. */
const DESTINATION_RE = /\b(MILITARY|NAVY|DEFENCE|DEFENSE)\b/i;

/**
 * Classify one vessel. `allowlist` is the operator's ORBIS_AIS_NAVAL_MMSIS
 * set (may be empty). Returns null when nothing matched — the overwhelming
 * majority of vessels, which is the correct answer.
 */
export function classifyNaval(
  vessel: Pick<Vessel, "mmsi" | "name" | "destination">,
  allowlist: ReadonlySet<string>,
): NavalInfo | null {
  if (allowlist.has(vessel.mmsi)) {
    return {
      kind: "listed",
      reason: "MMSI is in your ORBIS_AIS_NAVAL_MMSIS reference list.",
    };
  }

  const name = (vessel.name ?? "").trim().toUpperCase();
  if (name) {
    for (const prefix of NAVAL_PREFIXES) {
      if (name === prefix || name.startsWith(`${prefix} `)) {
        const original = (vessel.name ?? "").trim();
        const shown = original.length > 24 ? `${original.slice(0, 24)}…` : original;
        return {
          kind: "possible",
          reason: `Ship name “${shown}” uses the “${prefix}” prefix associated with naval or government vessels (heuristic).`,
        };
      }
    }
  }

  const destination = (vessel.destination ?? "").trim();
  if (destination && DESTINATION_RE.test(destination)) {
    return {
      kind: "possible",
      reason: `AIS destination field reads “${destination.slice(0, 32)}”, suggesting a military port or user (heuristic).`,
    };
  }

  return null;
}

/** Attach badges to a snapshot's vessels. Cheap; runs at serve time so an
 * allowlist change takes effect without waiting for a new collection pass. */
export function withNavalBadges(
  vessels: Vessel[],
  allowlist: ReadonlySet<string>,
): Vessel[] {
  return vessels.map((v) => (v.naval ? v : { ...v, naval: classifyNaval(v, allowlist) }));
}
