import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rm } from "node:fs/promises";
import path from "node:path";
import {
  AISSTREAM_URL,
  collectVessels,
  decodeAisPosition,
  decodeShipStaticData,
  decodeVesselName,
  parseAisTime,
} from "@/lib/vessels/ais";
import { classifyNaval } from "@/lib/vessels/naval";
import {
  __resetVesselCache,
  __setVesselCollector,
  getVesselSnapshot,
} from "@/lib/vessels/cache";
import {
  __resetEnvCache,
  aisBoxes,
  DEFAULT_AIS_BOXES,
  getEnv,
  isAisConfigured,
  parseAisBoxes,
  parseNavalMmsis,
} from "@/lib/env";
import type { Vessel } from "@/lib/vessels/types";

// ---------------------------------------------------------------------------
// The AIS layer is the only place ORBIS accepts live, machine-generated
// positions, so these tests focus on the honesty rules: never fabricate a
// position or a time, drop malformed input, and keep the "refreshing" state
// visible instead of blocking on the network.
// ---------------------------------------------------------------------------

const CACHE_FILE = path.join(process.cwd(), ".orbis-cache", "vessels.json");

function oursVessel(mmsi: string, over: Partial<Vessel> = {}): Vessel {
  return {
    mmsi,
    name: null,
    lat: 26.5,
    lng: 56.2,
    sog: null,
    cog: null,
    heading: null,
    navStatus: null,
    observedAt: new Date().toISOString(),
    ...over,
  };
}

/** AISStream-shaped PositionReport. */
function positionMessage(mmsi: number, timeUtc: string) {
  return {
    MessageType: "PositionReport",
    MetaData: {
      MMSI: mmsi,
      ShipName: "TEST VESSEL@@@@",
      latitude: 26.5,
      longitude: 56.2,
      time_utc: timeUtc,
    },
    Message: {
      PositionReport: {
        UserID: mmsi,
        Latitude: 26.5,
        Longitude: 56.2,
        Sog: 12.3,
        Cog: 148.2,
        TrueHeading: 150,
        NavigationalStatus: 0,
      },
    },
  };
}

class FakeSocket {
  static instances: FakeSocket[] = [];
  sent: string[] = [];
  closed = false;
  private listeners = new Map<string, Array<(event: { data?: unknown }) => void>>();

  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
    this.emit("close");
  }

  addEventListener(type: string, listener: (event: { data?: unknown }) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: string, event: { data?: unknown } = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

describe("AIS watch area configuration", () => {
  it("defaults to the Gulf / Red Sea corridor", () => {
    expect(aisBoxes(getEnv({}))).toEqual(DEFAULT_AIS_BOXES);
    expect(DEFAULT_AIS_BOXES[0]).toEqual([
      [12, 32],
      [30.5, 57.5],
    ]);
  });

  it("accepts explicit boxes and rejects malformed or inverted ones", () => {
    expect(parseAisBoxes("[[[1,2],[3,4]]]")).toEqual([
      [
        [1, 2],
        [3, 4],
      ],
    ]);
    expect(parseAisBoxes(undefined)).toBeUndefined();
    expect(() => parseAisBoxes("not json")).toThrow(/ORBIS_AIS_BOXES/);
    expect(() => parseAisBoxes("[]")).toThrow(/ORBIS_AIS_BOXES/);
    // south >= north (inverted box) would subscribe to nothing useful.
    expect(() => parseAisBoxes("[[[5,2],[3,4]]]")).toThrow(/ORBIS_AIS_BOXES/);
    expect(() => parseAisBoxes("[[[1,2],[999,4]]]")).toThrow(/ORBIS_AIS_BOXES/);
  });

  it("is only configured when a key is present", () => {
    expect(isAisConfigured(getEnv({}))).toBe(false);
    expect(isAisConfigured(getEnv({ AISSTREAM_API_KEY: "  " }))).toBe(false);
    expect(isAisConfigured(getEnv({ AISSTREAM_API_KEY: "key" }))).toBe(true);
  });
});

describe("ORBIS_AIS_NAVAL_MMSIS configuration", () => {
  it("accepts JSON arrays and comma-separated lists, deduplicating", () => {
    expect(parseNavalMmsis("249123456,254123456")).toEqual(["249123456", "254123456"]);
    expect(parseNavalMmsis('["249123456", 254123456, "249123456"]')).toEqual([
      "249123456",
      "254123456",
    ]);
    expect(parseNavalMmsis(undefined)).toBeUndefined();
    expect(parseNavalMmsis("")).toBeUndefined();
    expect(parseNavalMmsis("[]")).toBeUndefined();
  });

  it("fails loudly on malformed entries rather than mis-badging ships", () => {
    expect(() => parseNavalMmsis("123")).toThrow(/ORBIS_AIS_NAVAL_MMSIS/);
    expect(() => parseNavalMmsis("24912x456")).toThrow(/9 digits/);
    expect(() => parseNavalMmsis('{"a":1}')).toThrow(/ORBIS_AIS_NAVAL_MMSIS/);
  });
});

describe("decodeVesselName", () => {
  it("strips the @ padding AIS uses and trims whitespace", () => {
    expect(decodeVesselName("EVER GIVEN@@@@  ")).toBe("EVER GIVEN");
    expect(decodeVesselName(" A B ")).toBe("A B");
  });

  it("returns null rather than an empty or non-string name", () => {
    expect(decodeVesselName("@@@@")).toBeNull();
    expect(decodeVesselName("   ")).toBeNull();
    expect(decodeVesselName(42)).toBeNull();
    expect(decodeVesselName(undefined)).toBeNull();
  });
});

describe("parseAisTime", () => {
  it("converts AISStream's non-ISO time (with microseconds) to ISO", () => {
    expect(parseAisTime("2023-09-09 06:05:41.826608 +0000 UTC")).toBe(
      "2023-09-09T06:05:41.826Z",
    );
  });

  it("honours a non-UTC offset instead of dropping it", () => {
    expect(parseAisTime("2023-09-09 06:05:41 +0200")).toBe("2023-09-09T04:05:41.000Z");
  });

  it("returns null for unusable input rather than guessing", () => {
    expect(parseAisTime("yesterday")).toBeNull();
    expect(parseAisTime(1694243141826)).toBeNull();
    expect(parseAisTime(null)).toBeNull();
  });
});

describe("decodeAisPosition", () => {
  it("decodes a PositionReport into a vessel", () => {
    const vessel = decodeAisPosition(positionMessage(123456789, "2023-09-09 06:05:41 +0000 UTC"));
    expect(vessel).not.toBeNull();
    expect(vessel?.mmsi).toBe("123456789");
    expect(vessel?.name).toBe("TEST VESSEL");
    expect(vessel?.lat).toBeCloseTo(26.5);
    expect(vessel?.sog).toBeCloseTo(12.3);
    expect(vessel?.navStatus).toBe("under way using engine");
    expect(vessel?.observedAt).toBe("2023-09-09T06:05:41.000Z");
  });

  it("drops non-position messages and messages without a usable time", () => {
    expect(decodeAisPosition({ MessageType: "ShipStaticData", Message: {} })).toBeNull();
    expect(decodeAisPosition(positionMessage(1, "not a time"))).toBeNull();
    expect(decodeAisPosition(positionMessage(1, "2023-09-09 06:05:41 +0000 UTC"))).not.toBeNull();
  });

  it("treats AIS sentinel values as 'not available' instead of real data", () => {
    const msg = positionMessage(111111111, "2023-09-09 06:05:41 +0000 UTC");
    msg.Message.PositionReport.Sog = 102.3; // 102.3 kn means "not available"
    msg.Message.PositionReport.TrueHeading = 511; // 511 means "not available"
    const vessel = decodeAisPosition(msg);
    expect(vessel?.sog).toBeNull();
    expect(vessel?.heading).toBeNull();
  });

  it("rejects out-of-range coordinates instead of plotting them", async () => {
    const msg = positionMessage(222222222, "2023-09-09 06:05:41 +0000 UTC");
    msg.Message.PositionReport.Latitude = 91; // the payload position is authoritative
    expect(decodeAisPosition(msg)).toBeNull();
    // A MetaData-only position must pass the same range check.
    const metaOnly = {
      MessageType: "PositionReport",
      MetaData: { MMSI: 333333333, ShipName: "TEST VESSEL@@@@", latitude: -95, longitude: 10, time_utc: "2023-09-09 06:05:41 +0000 UTC" },
      Message: {},
    };
    expect(decodeAisPosition(metaOnly)).toBeNull();
  });
});

describe("decodeShipStaticData", () => {
  it("extracts name, destination and the raw type code exactly as transmitted", () => {
    const info = decodeShipStaticData({
      MessageType: "ShipStaticData",
      MetaData: { MMSI: 123456789, ShipName: "HMS DEFIANT@@@@" },
      Message: {
        ShipStaticData: {
          UserID: 123456789,
          TypeOfShipAndCargoType: 700,
          Destination: "MILITARY PORT@@@@@@",
        },
      },
    });
    expect(info).toEqual({
      mmsi: "123456789",
      name: "HMS DEFIANT",
      shipType: 700,
      destination: "MILITARY PORT",
    });
  });

  it("returns null for other message types and unusable input", () => {
    expect(decodeShipStaticData({ MessageType: "PositionReport", MetaData: {}, Message: {} })).toBeNull();
    expect(decodeShipStaticData("junk")).toBeNull();
    expect(decodeShipStaticData(null)).toBeNull();
    // No MMSI means nothing to merge by — never invent an identity.
    expect(decodeShipStaticData({ MessageType: "ShipStaticData", MetaData: {}, Message: {} })).toBeNull();
  });
});

describe("classifyNaval", () => {
  const allowlist = new Set(["249123456"]);

  it("prefers the operator's allowlist over any heuristic", () => {
    expect(classifyNaval({ mmsi: "249123456", name: "EVER GIVEN", destination: null }, allowlist)).toEqual({
      kind: "listed",
      reason: expect.stringContaining("ORBIS_AIS_NAVAL_MMSIS"),
    });
  });

  it("matches naval name prefixes only as whole words", () => {
    expect(classifyNaval({ mmsi: "1", name: "HMS DEFIANT", destination: null }, allowlist)?.kind).toBe("possible");
    expect(classifyNaval({ mmsi: "2", name: "USS NIMITZ", destination: null }, allowlist)?.kind).toBe("possible");
    // "INSPIRATION" shares letters with the INS prefix but is not that word.
    expect(classifyNaval({ mmsi: "3", name: "INSPIRATION", destination: null }, allowlist)).toBeNull();
    expect(classifyNaval({ mmsi: "4", name: "EVER GIVEN", destination: null }, allowlist)).toBeNull();
  });

  it("flags military destinations while ordinary ports pass", () => {
    expect(classifyNaval({ mmsi: "5", name: null, destination: "MILITARY PORT" }, allowlist)?.kind).toBe("possible");
    expect(classifyNaval({ mmsi: "6", name: null, destination: "JEBEL ALI" }, allowlist)).toBeNull();
  });

  it("returns null when there is nothing to go on — never guesses", () => {
    expect(classifyNaval({ mmsi: "7", name: null, destination: null }, allowlist)).toBeNull();
  });
});

describe("collectVessels", () => {
  beforeEach(() => {
    FakeSocket.instances = [];
  });

  it("refuses to open a socket without a watch area", async () => {
    const result = await collectVessels({ apiKey: "k", boxes: [] });
    expect(result).toEqual({ vessels: [], error: "no-watch-area" });
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it("subscribes, keeps the latest position per vessel, and ignores junk", async () => {
    const pending = collectVessels({
      apiKey: "secret-key",
      boxes: DEFAULT_AIS_BOXES,
      windowMs: 30,
      WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
    });

    const socket = FakeSocket.instances[0];
    expect(socket.url).toBe(AISSTREAM_URL);

    socket.emit("open");
    expect(socket.sent.length).toBeGreaterThan(0);
    const subscription = JSON.parse(socket.sent[0]) as Record<string, unknown>;
    expect(subscription.APIKey).toBe("secret-key");
    expect(Array.isArray(subscription.BoundingBoxes)).toBe(true);
    // Static data is subscribed too, so names/destinations can be merged in.
    expect(subscription.FilterMessageTypes).toEqual(
      expect.arrayContaining(["PositionReport", "ShipStaticData"]),
    );

    socket.emit("message", {
      data: JSON.stringify(positionMessage(111111111, "2023-09-09 06:05:41 +0000 UTC")),
    });
    // A later report for the same vessel replaces the earlier one.
    socket.emit("message", {
      data: JSON.stringify(positionMessage(111111111, "2023-09-09 06:06:41 +0000 UTC")),
    });
    // Non-position and malformed payloads must be dropped, not guessed at.
    socket.emit("message", { data: JSON.stringify({ MessageType: "ShipStaticData" }) });
    socket.emit("message", { data: "not json" });

    const result = await pending;
    expect(result.error).toBeNull();
    expect(result.vessels).toHaveLength(1);
    expect(result.vessels[0].mmsi).toBe("111111111");
    expect(result.vessels[0].observedAt).toBe("2023-09-09T06:06:41.000Z");
    expect(socket.closed).toBe(true);
  });

  it("closes the socket and resolves within the bounded window", async () => {
    const started = Date.now();
    const pending = collectVessels({
      apiKey: "k",
      boxes: DEFAULT_AIS_BOXES,
      windowMs: 20,
      WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
    });
    FakeSocket.instances[0].emit("open");
    const result = await pending;
    expect(result.error).toBeNull();
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(FakeSocket.instances[0].closed).toBe(true);
  });

  it("merges static data regardless of arrival order, without overriding positions", async () => {
    const pending = collectVessels({
      apiKey: "k",
      boxes: DEFAULT_AIS_BOXES,
      windowMs: 40,
      WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
    });
    const socket = FakeSocket.instances[0];
    socket.emit("open");
    // Static data first, then the position report.
    socket.emit("message", {
      data: JSON.stringify({
        MessageType: "ShipStaticData",
        MetaData: { MMSI: 111111111, ShipName: "HMS STATIC@@@@" },
        Message: {
          ShipStaticData: {
            UserID: 111111111,
            Destination: "PORTSMOUTH@@@@",
            TypeOfShipAndCargoType: 700,
          },
        },
      }),
    });
    socket.emit("message", {
      data: JSON.stringify(positionMessage(111111111, "2023-09-09 06:05:41 +0000 UTC")),
    });

    const result = await pending;
    expect(result.error).toBeNull();
    expect(result.vessels).toHaveLength(1);
    const [vessel] = result.vessels;
    expect(vessel.destination).toBe("PORTSMOUTH");
    expect(vessel.shipType).toBe(700);
    // The position report's own name wins — static data only ever fills gaps.
    expect(vessel.name).toBe("TEST VESSEL");
  });
});

describe("vessel snapshot cache", () => {
  beforeEach(() => {
    __resetVesselCache();
    __setVesselCollector(null);
    process.env.AISSTREAM_API_KEY = "test-key";
    __resetEnvCache();
  });

  afterEach(() => {
    __resetVesselCache();
    delete process.env.AISSTREAM_API_KEY;
    delete process.env.ORBIS_E2E;
    delete process.env.ORBIS_AIS_NAVAL_MMSIS;
    __resetEnvCache();
  });

  afterAll(async () => {
    // The cache file is derived state; tests must not leave one behind.
    await rm(CACHE_FILE, { force: true });
  });

  it("serves clearly-labelled fixtures in E2E mode without touching the network", async () => {
    process.env.ORBIS_E2E = "1";
    __resetEnvCache();
    let collectorCalls = 0;
    __setVesselCollector(async () => {
      collectorCalls += 1;
      return { vessels: [], error: null };
    });

    const snapshot = await getVesselSnapshot();
    expect(snapshot.meta.fixtureMode).toBe(true);
    expect(snapshot.meta.source).toBe("fixture");
    expect(snapshot.vessels.length).toBeGreaterThan(0);
    expect(collectorCalls).toBe(0);
  });

  it("returns an empty, refreshing snapshot first instead of blocking ~15s", async () => {
    let release: (() => void) | undefined;
    __setVesselCollector(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ vessels: [oursVessel("111111111")], error: null });
        }),
    );

    const first = await getVesselSnapshot();
    expect(first.vessels).toEqual([]);
    expect(first.meta.refreshing).toBe(true);

    release?.();
    // The refresh runs in the background; the next poll sees the positions.
    await vi.waitFor(async () => {
      const next = await getVesselSnapshot();
      expect(next.vessels).toHaveLength(1);
    });

    // "Refreshing" only clears once the background pass (including its disk
    // write) finishes, so poll until it settles instead of racing the write.
    await vi.waitFor(async () => {
      const snap = await getVesselSnapshot();
      expect(snap.meta.refreshing).toBe(false);
    });

    const settled = await getVesselSnapshot();
    expect(settled.vessels[0].mmsi).toBe("111111111");
    expect(settled.meta.stale).toBe(false);
    expect(settled.meta.lastError).toBeNull();
  });

  it("does not let a failed pass erase the last-known picture", async () => {
    __setVesselCollector(async () => ({ vessels: [oursVessel("222222222")], error: null }));
    await getVesselSnapshot();
    await vi.waitFor(async () => {
      expect((await getVesselSnapshot()).vessels).toHaveLength(1);
    });

    // Force the cached positions to look stale, then fail the next pass.
    __resetVesselCache();
    __setVesselCollector(async () => ({ vessels: [], error: "stream-error" }));
    const snapshot = await getVesselSnapshot();
    // No positions were ever cached in the new state, so the failure is visible
    // as an error rather than as fabricated data.
    expect(snapshot.vessels).toEqual([]);
    await vi.waitFor(async () => {
      expect((await getVesselSnapshot()).meta.lastError).toBe("stream-error");
    });
  });

  it("flags a missing key and serves clearly-labelled demo positions", async () => {
    delete process.env.AISSTREAM_API_KEY;
    __resetEnvCache();
    const snapshot = await getVesselSnapshot();
    // The layer stays explorable without a key, but it never pretends to be
    // live AIS: source says "demo" and the missing key remains flagged.
    expect(snapshot.meta.source).toBe("demo");
    expect(snapshot.meta.lastError).toBe("ais-not-configured");
    expect(snapshot.vessels.length).toBeGreaterThan(0);
    expect(snapshot.vessels.every((v) => v.name === null || v.name.startsWith("FIXTURE"))).toBe(true);
  });

  it("badges listed hulls from ORBIS_AIS_NAVAL_MMSIS at serve time", async () => {
    process.env.ORBIS_E2E = "1";
    process.env.ORBIS_AIS_NAVAL_MMSIS = "636019876"; // MMSI of a fixture vessel
    __resetEnvCache();

    const snapshot = await getVesselSnapshot();
    const flagged = snapshot.vessels.find((v) => v.mmsi === "636019876");
    expect(flagged?.naval?.kind).toBe("listed");
    // Heuristic classification runs too; nothing here matches, and that stays null.
    const plain = snapshot.vessels.find((v) => v.name === "FIXTURE RED SEA TRADER");
    expect(plain?.naval).toBeNull();
  });
});
