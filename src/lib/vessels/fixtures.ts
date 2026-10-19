import type { Vessel } from "@/lib/vessels/types";
import { toIso } from "@/lib/util/time";

// ---------------------------------------------------------------------------
// FIXTURE vessel positions — used ONLY when ORBIS_E2E=1 (automated tests).
// Synthetic, clearly non-real vessels; the UI shows the global "test fixture
// mode" banner whenever fixture data is served.
// ---------------------------------------------------------------------------

function minutesAgo(m: number): string {
  return toIso(Date.now() - m * 60_000);
}

export function fixtureVessels(): Vessel[] {
  return [
    {
      mmsi: "636019876",
      name: "FIXTURE GULF PIONEER",
      lat: 26.55,
      lng: 56.25,
      sog: 12.4,
      cog: 148,
      heading: 150,
      navStatus: "under way using engine",
      observedAt: minutesAgo(2),
    },
    {
      mmsi: "538009123",
      name: "FIXTURE RED SEA TRADER",
      lat: 15.32,
      lng: 41.1,
      sog: 9.1,
      cog: 322,
      heading: 320,
      navStatus: "under way using engine",
      observedAt: minutesAgo(4),
    },
    {
      mmsi: "470998877",
      name: "FIXTURE JEBEL ALI",
      lat: 25.01,
      lng: 55.06,
      sog: 0,
      cog: null,
      heading: null,
      navStatus: "moored",
      observedAt: minutesAgo(9),
    },
    {
      mmsi: "209555123",
      name: "FIXTURE BABELMANDEB",
      lat: 12.6,
      lng: 43.4,
      sog: 14.7,
      cog: 171,
      heading: 173,
      navStatus: "under way using engine",
      observedAt: minutesAgo(1),
    },
    {
      mmsi: "636012345",
      name: null,
      lat: 23.9,
      lng: 57.6,
      sog: 7.3,
      cog: 96,
      heading: null,
      navStatus: null,
      observedAt: minutesAgo(6),
    },
    {
      mmsi: "566778899",
      name: "FIXTURE SUEZ APPROACH",
      lat: 29.9,
      lng: 32.55,
      sog: 5.2,
      cog: 5,
      heading: 4,
      navStatus: "constrained by draught",
      observedAt: minutesAgo(3),
    },
  ];
}
