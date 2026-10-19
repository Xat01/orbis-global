import type { Feature, FeatureCollection, Polygon } from "geojson";
import type { VesselBox } from "@/lib/vessels/types";

// ---------------------------------------------------------------------------
// Static maritime reference geography.
//
// Publicly known reference marks (major straits/canals) plus the configured
// AIS watch-area outline. This is static reference data — NOT AIS positions,
// NOT routing advice, and never presented as navigational data. It renders on
// the map regardless of whether a live AIS key is configured, so the maritime
// context is always visible.
// ---------------------------------------------------------------------------

export interface Chokepoint {
  id: string;
  name: string;
  lng: number;
  lat: number;
  /** Short factual descriptor — no traffic figures are claimed. */
  note: string;
}

/** Coordinates are approximate reference points, not survey positions. */
export const CHOKEPOINTS: Chokepoint[] = [
  { id: "hormuz", name: "Strait of Hormuz", lng: 56.5, lat: 26.6, note: "Gulf export chokepoint" },
  { id: "bab-el-mandeb", name: "Bab-el-Mandeb", lng: 43.35, lat: 12.58, note: "Red Sea entrance" },
  { id: "suez", name: "Suez Canal", lng: 32.55, lat: 30.0, note: "Red Sea–Mediterranean link" },
  { id: "malacca", name: "Strait of Malacca", lng: 100.9, lat: 2.6, note: "Main Asia–Europe sea lane" },
  { id: "gibraltar", name: "Strait of Gibraltar", lng: -5.6, lat: 35.95, note: "Mediterranean entrance" },
  { id: "bosphorus", name: "Bosphorus", lng: 29.05, lat: 41.1, note: "Black Sea passage" },
  { id: "cape", name: "Cape of Good Hope", lng: 19.0, lat: -34.9, note: "Asia–Europe routing alternative" },
  { id: "panama", name: "Panama Canal", lng: -79.7, lat: 9.1, note: "Atlantic–Pacific link" },
];

/** GeoJSON polygon (closed ring) for a watch box [[south, west], [north, east]]. */
export function boxPolygon(box: VesselBox): Feature<Polygon> {
  const [[south, west], [north, east]] = box;
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    },
    properties: {},
  };
}

/** FeatureCollection of the watch-area outlines (may be empty). */
export function watchAreaCollection(boxes: VesselBox[]): FeatureCollection<Polygon> {
  return {
    type: "FeatureCollection",
    features: boxes.map(boxPolygon),
  };
}
