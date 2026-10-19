import { NAV_STATUS, VesselSchema, type Vessel, type VesselBox } from "@/lib/vessels/types";

// ---------------------------------------------------------------------------
// AIS collector — subscribes to AISStream.io over a WebSocket for a bounded
// window, keeps the latest position per vessel, and disconnects.
//
// Deliberately NOT a long-lived daemon (same philosophy as the snapshot
// store): a collection pass runs only in response to a request, and the
// resulting positions are cached and revalidated by src/lib/vessels/cache.ts.
//
// The single outbound host is fixed in code and is not user-supplied, so this
// WebSocket is a narrow, auditable exception to the fetch allowlist (see
// SECURITY.md) rather than a second, general-purpose egress path.
// ---------------------------------------------------------------------------

export const AISSTREAM_URL = "wss://stream.aisstream.io/v0/stream";
export const DEFAULT_WINDOW_MS = 15_000;

export interface VesselCollection {
  vessels: Vessel[];
  error: string | null;
}

export interface VesselCollectionOptions {
  apiKey: string;
  boxes: VesselBox[];
  /** How long to listen for positions before resolving. */
  windowMs?: number;
  /** Hard cap on distinct vessels collected in one pass. */
  maxVessels?: number;
  /** Injectable for tests. Defaults to the global WebSocket. */
  WebSocketImpl?: typeof WebSocket;
}

interface MinimalSocket {
  send(data: string): void;
  close(): void;
  addEventListener(type: string, listener: (event: { data?: unknown }) => void): void;
}

/**
 * AIS pads ship names with trailing "@" characters and may pad with spaces.
 * Returns null when there is no usable name.
 */
export function decodeVesselName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/@+\s*$/, "").trim();
  return name.length > 0 ? name : null;
}

function numOrNull(raw: unknown, max: number, sentinels: number[] = []): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (sentinels.includes(raw)) return null;
  if (raw < 0 || raw > max) return null;
  return raw;
}

/**
 * AISStream reports time as e.g. "2023-09-09 06:05:41.826608 +0000 UTC" — not
 * ISO 8601. Convert it, or return null rather than guess a timestamp.
 */
export function parseAisTime(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s*([+-]\d{4})?/);
  if (!m) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const frac = m[2];
  const hms = frac.length > 8 ? frac.slice(0, 12) : frac; // keep milliseconds at most
  const off = m[3] && m[3] !== "+0000" && m[3] !== "-0000" ? `${m[3].slice(0, 3)}:${m[3].slice(3)}` : "Z";
  const d = new Date(`${m[1]}T${hms}${off}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Decode one AISStream message into a Vessel. Returns null for anything that
 * is not a usable PositionReport (never fabricates a position or a time).
 */
export function decodeAisPosition(raw: unknown): Vessel | null {
  if (!raw || typeof raw !== "object") return null;
  const msg = raw as Record<string, unknown>;
  if (msg.MessageType !== "PositionReport") return null;

  const meta = (msg.MetaData ?? {}) as Record<string, unknown>;
  const payload = ((msg.Message ?? {}) as Record<string, unknown>).PositionReport as
    | Record<string, unknown>
    | undefined;

  const lat = typeof payload?.Latitude === "number" ? payload.Latitude : meta.latitude;
  const lng = typeof payload?.Longitude === "number" ? payload.Longitude : meta.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const mmsiRaw = payload?.UserID ?? meta.MMSI ?? meta.MMSI_String;
  const mmsi =
    typeof mmsiRaw === "number" && Number.isFinite(mmsiRaw)
      ? String(Math.trunc(mmsiRaw))
      : typeof mmsiRaw === "string" && mmsiRaw.trim()
        ? mmsiRaw.trim()
        : null;
  if (!mmsi) return null;

  const observedAt = parseAisTime(meta.time_utc ?? payload?.time_utc);
  if (!observedAt) return null;

  const navCode = typeof payload?.NavigationalStatus === "number" ? payload.NavigationalStatus : null;

  const candidate = {
    mmsi,
    name: decodeVesselName(meta.ShipName),
    lat,
    lng,
    sog: numOrNull(payload?.Sog, 102.3, [102.3]),
    cog: numOrNull(payload?.Cog, 360, [3600]),
    heading: numOrNull(payload?.TrueHeading, 360, [511]),
    navStatus: navCode === null ? null : (NAV_STATUS[navCode] ?? `code ${navCode}`),
    observedAt,
  };

  const parsed = VesselSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/** Static facts from an AIS ShipStaticData message (msg 5), merged by MMSI. */
export interface ShipStaticInfo {
  mmsi: string;
  name: string | null;
  /** Type of ship / cargo code exactly as transmitted — no interpretation. */
  shipType: number | null;
  /** Destination string as transmitted (AIS "@" padding stripped). */
  destination: string | null;
}

/**
 * Decode an AISStream ShipStaticData message. Returns null for anything
 * else or for unusable input — same honesty rule as decodeAisPosition.
 * AISStream puts the ship name in MetaData for every message type.
 */
export function decodeShipStaticData(raw: unknown): ShipStaticInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const msg = raw as Record<string, unknown>;
  if (msg.MessageType !== "ShipStaticData") return null;

  const meta = (msg.MetaData ?? {}) as Record<string, unknown>;
  const payload = ((msg.Message ?? {}) as Record<string, unknown>).ShipStaticData as
    | Record<string, unknown>
    | undefined;

  const mmsiRaw = payload?.UserID ?? meta.MMSI ?? meta.MMSI_String;
  const mmsi =
    typeof mmsiRaw === "number" && Number.isFinite(mmsiRaw)
      ? String(Math.trunc(mmsiRaw))
      : typeof mmsiRaw === "string" && mmsiRaw.trim()
        ? mmsiRaw.trim()
        : null;
  if (!mmsi) return null;

  const typeRaw = payload?.TypeOfShipAndCargoType ?? payload?.TypeOfShipCargoType;
  const shipType =
    typeof typeRaw === "number" && Number.isInteger(typeRaw) && typeRaw >= 0 && typeRaw <= 9999
      ? typeRaw
      : null;

  const destRaw = payload?.Destination;
  const destination =
    typeof destRaw === "string"
      ? (() => {
          const d = destRaw.replace(/@+\s*$/, "").trim();
          return d.length > 0 ? d : null;
        })()
      : null;

  const name = decodeVesselName(meta.ShipName ?? payload?.Name);
  if (name === null && shipType === null && destination === null) return null; // nothing usable

  return { mmsi, name, shipType, destination };
}

/** Merge static facts into a position-derived vessel (never overwrites a
 * known position; only fills fields the position report did not carry). */
function applyStatic(vessel: Vessel, info: ShipStaticInfo): Vessel {
  return {
    ...vessel,
    name: vessel.name ?? info.name,
    shipType: vessel.shipType ?? info.shipType,
    destination: vessel.destination ?? info.destination,
  };
}

/**
 * Open a websocket, subscribe to the watch area, and collect positions for a
 * bounded window. Never throws — failures are returned as { error }.
 */
export async function collectVessels(options: VesselCollectionOptions): Promise<VesselCollection> {
  const WS = options.WebSocketImpl ?? (globalThis as { WebSocket?: unknown }).WebSocket;
  if (typeof WS !== "function") {
    return { vessels: [], error: "websocket-unavailable" };
  }
  if (options.boxes.length === 0) {
    return { vessels: [], error: "no-watch-area" };
  }

  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const maxVessels = options.maxVessels ?? 3000;
  const byMmsi = new Map<string, Vessel>();
  const statics = new Map<string, ShipStaticInfo>();

  return new Promise<VesselCollection>((resolve) => {
    let settled = false;
    let error: string | null = null;
    let socket: MinimalSocket | null = null;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const finish = () => {
      if (settled) return;
      settled = true;
      for (const t of timers) clearTimeout(t);
      try {
        socket?.close();
      } catch {
        /* already closed */
      }
      const vessels = [...byMmsi.values()]
        .map((v) => {
          const info = statics.get(v.mmsi);
          return info ? applyStatic(v, info) : v;
        })
        .sort((a, b) => a.mmsi.localeCompare(b.mmsi));
      resolve({ vessels, error });
    };

    try {
      socket = new (WS as new (url: string) => MinimalSocket)(AISSTREAM_URL);
    } catch {
      resolve({ vessels: [], error: "connect-failed" });
      return;
    }

    timers.push(setTimeout(finish, windowMs));
    timers.push(setTimeout(finish, windowMs + 8_000)); // safety net

    socket.addEventListener("open", () => {
      try {
        socket?.send(
          JSON.stringify({
            APIKey: options.apiKey,
            BoundingBoxes: options.boxes,
            FilterMessageTypes: ["PositionReport", "ShipStaticData"],
          }),
        );
      } catch {
        error = error ?? "subscribe-failed";
        finish();
      }
    });

    socket.addEventListener("message", (event) => {
      let raw: unknown;
      try {
        raw = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const serverError = (raw as { error?: unknown }).error;
      if (typeof serverError === "string") {
        error = serverError;
        finish();
        return;
      }
      const vessel = decodeAisPosition(raw);
      if (vessel) {
        const prev = byMmsi.get(vessel.mmsi);
        if (!prev || vessel.observedAt >= prev.observedAt) byMmsi.set(vessel.mmsi, vessel);
        if (byMmsi.size >= maxVessels) finish();
        return;
      }
      // Static data may arrive before or after the position; it is merged in
      // at finish() either way, and only ever fills name/type/destination.
      const info = decodeShipStaticData(raw);
      if (info && (byMmsi.has(info.mmsi) || statics.size < maxVessels)) {
        statics.set(info.mmsi, info);
      }
    });

    socket.addEventListener("error", () => {
      error = error ?? "socket-error";
      finish();
    });
    socket.addEventListener("close", () => finish());
  });
}
