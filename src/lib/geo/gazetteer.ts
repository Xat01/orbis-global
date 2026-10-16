import type { GeoRef, Region } from "@/lib/types";

// ---------------------------------------------------------------------------
// Compact gazetteer: countries (with centroids) + major cities.
// Used for: geo-resolution of headlines, region inference, and reverse
// geolocation of a browser position to a *city-level* place (privacy: we
// never persist precise coordinates).
//
// Coordinates are public-domain approximate centroids, not survey points.
// Country-level matches are stored with precision "country" and a large
// uncertainty radius — we never claim a precise location we don't have.
// ---------------------------------------------------------------------------

export interface CountryInfo {
  name: string;
  region: Region;
  lat: number;
  lng: number;
  aliases: string[];
}

export interface CityInfo {
  name: string;
  country: string;
  lat: number;
  lng: number;
  aliases?: string[];
}

export const COUNTRIES: CountryInfo[] = [
  { name: "Afghanistan", region: "south-asia", lat: 33.9, lng: 67.7, aliases: ["afghanistan"] },
  { name: "Algeria", region: "africa", lat: 28.0, lng: 1.7, aliases: ["algeria"] },
  { name: "Angola", region: "africa", lat: -11.2, lng: 17.9, aliases: ["angola"] },
  { name: "Argentina", region: "south-america", lat: -38.4, lng: -63.6, aliases: ["argentina"] },
  { name: "Australia", region: "oceania", lat: -25.3, lng: 133.8, aliases: ["australia", "australian"] },
  { name: "Austria", region: "europe", lat: 47.5, lng: 14.6, aliases: ["austria", "austrian"] },
  { name: "Armenia", region: "central-asia", lat: 40.1, lng: 45.0, aliases: ["armenia", "armenian"] },
  { name: "Azerbaijan", region: "central-asia", lat: 40.1, lng: 47.6, aliases: ["azerbaijan", "azeri"] },
  { name: "Bahrain", region: "middle-east", lat: 26.0, lng: 50.5, aliases: ["bahrain"] },
  { name: "Bangladesh", region: "south-asia", lat: 23.7, lng: 90.4, aliases: ["bangladesh", "bangladeshi"] },
  { name: "Belarus", region: "europe", lat: 53.7, lng: 27.95, aliases: ["belarus", "belarusian"] },
  { name: "Belgium", region: "europe", lat: 50.5, lng: 4.5, aliases: ["belgium", "belgian"] },
  { name: "Bolivia", region: "south-america", lat: -16.3, lng: -63.6, aliases: ["bolivia"] },
  { name: "Bosnia and Herzegovina", region: "europe", lat: 43.9, lng: 17.7, aliases: ["bosnia"] },
  { name: "Brazil", region: "south-america", lat: -14.2, lng: -51.9, aliases: ["brazil", "brazilian"] },
  { name: "Bulgaria", region: "europe", lat: 42.7, lng: 25.5, aliases: ["bulgaria"] },
  { name: "Cambodia", region: "southeast-asia", lat: 12.6, lng: 105.0, aliases: ["cambodia"] },
  { name: "Cameroon", region: "africa", lat: 7.4, lng: 12.4, aliases: ["cameroon"] },
  { name: "Canada", region: "north-america", lat: 56.1, lng: -106.3, aliases: ["canada", "canadian"] },
  { name: "Chile", region: "south-america", lat: -35.7, lng: -71.5, aliases: ["chile", "chilean"] },
  { name: "China", region: "east-asia", lat: 35.9, lng: 104.2, aliases: ["china", "chinese", "beijing"] },
  { name: "Colombia", region: "south-america", lat: 4.6, lng: -74.3, aliases: ["colombia", "colombian"] },
  { name: "Costa Rica", region: "north-america", lat: 9.7, lng: -83.8, aliases: ["costa rica"] },
  { name: "Croatia", region: "europe", lat: 45.1, lng: 15.2, aliases: ["croatia"] },
  { name: "Cuba", region: "north-america", lat: 21.5, lng: -77.8, aliases: ["cuba", "cuban"] },
  { name: "Cyprus", region: "europe", lat: 35.1, lng: 33.4, aliases: ["cyprus"] },
  { name: "Czech Republic", region: "europe", lat: 49.8, lng: 15.5, aliases: ["czech", "czech republic"] },
  { name: "DR Congo", region: "africa", lat: -4.0, lng: 21.8, aliases: ["dr congo", "democratic republic of the congo", "congo"] },
  { name: "Denmark", region: "europe", lat: 56.3, lng: 9.5, aliases: ["denmark", "danish"] },
  { name: "Dominican Republic", region: "north-america", lat: 18.7, lng: -70.2, aliases: ["dominican republic"] },
  { name: "Ecuador", region: "south-america", lat: -1.8, lng: -78.2, aliases: ["ecuador"] },
  { name: "Egypt", region: "africa", lat: 26.8, lng: 30.8, aliases: ["egypt", "egyptian", "cairo"] },
  { name: "Ethiopia", region: "africa", lat: 9.1, lng: 40.5, aliases: ["ethiopia", "ethiopian"] },
  { name: "Finland", region: "europe", lat: 61.9, lng: 25.7, aliases: ["finland", "finnish"] },
  { name: "France", region: "europe", lat: 46.2, lng: 2.2, aliases: ["france", "french", "paris"] },
  { name: "Germany", region: "europe", lat: 51.2, lng: 10.5, aliases: ["germany", "german", "berlin"] },
  { name: "Georgia", region: "central-asia", lat: 42.3, lng: 43.4, aliases: ["georgia", "georgian"] },
  { name: "Ghana", region: "africa", lat: 7.9, lng: -1.0, aliases: ["ghana"] },
  { name: "Greece", region: "europe", lat: 39.1, lng: 21.8, aliases: ["greece", "greek", "athens"] },
  { name: "Guatemala", region: "north-america", lat: 15.8, lng: -90.2, aliases: ["guatemala"] },
  { name: "Haiti", region: "north-america", lat: 19.0, lng: -72.3, aliases: ["haiti"] },
  { name: "Honduras", region: "north-america", lat: 15.2, lng: -86.2, aliases: ["honduras"] },
  { name: "Hungary", region: "europe", lat: 47.2, lng: 19.5, aliases: ["hungary"] },
  { name: "Iceland", region: "europe", lat: 64.96, lng: -19.02, aliases: ["iceland"] },
  { name: "India", region: "south-asia", lat: 20.6, lng: 79.0, aliases: ["india", "indian", "new delhi"] },
  { name: "Indonesia", region: "southeast-asia", lat: -0.8, lng: 113.9, aliases: ["indonesia", "indonesian"] },
  { name: "Iran", region: "middle-east", lat: 32.4, lng: 53.7, aliases: ["iran", "iranian", "tehran"] },
  { name: "Iraq", region: "middle-east", lat: 33.2, lng: 43.7, aliases: ["iraq", "iraqi", "baghdad"] },
  { name: "Ireland", region: "europe", lat: 53.4, lng: -8.2, aliases: ["ireland", "irish"] },
  { name: "Israel", region: "middle-east", lat: 31.0, lng: 34.9, aliases: ["israel", "israeli", "tel aviv", "jerusalem"] },
  { name: "Italy", region: "europe", lat: 41.9, lng: 12.6, aliases: ["italy", "italian", "rome"] },
  { name: "Ivory Coast", region: "africa", lat: 7.5, lng: -5.5, aliases: ["ivory coast", "cote d'ivoire"] },
  { name: "Japan", region: "east-asia", lat: 36.2, lng: 138.3, aliases: ["japan", "japanese", "tokyo"] },
  { name: "Jordan", region: "middle-east", lat: 30.6, lng: 36.2, aliases: ["jordan"] },
  { name: "Kazakhstan", region: "central-asia", lat: 48.0, lng: 66.9, aliases: ["kazakhstan"] },
  { name: "Kenya", region: "africa", lat: -0.02, lng: 37.9, aliases: ["kenya", "kenyan", "nairobi"] },
  { name: "Kuwait", region: "middle-east", lat: 29.3, lng: 47.5, aliases: ["kuwait"] },
  { name: "Kyrgyzstan", region: "central-asia", lat: 41.2, lng: 74.8, aliases: ["kyrgyzstan"] },
  { name: "Lebanon", region: "middle-east", lat: 33.9, lng: 35.9, aliases: ["lebanon", "lebanese", "beirut"] },
  { name: "Libya", region: "africa", lat: 26.3, lng: 17.2, aliases: ["libya", "libyan"] },
  { name: "Mali", region: "africa", lat: 17.6, lng: -4.0, aliases: ["mali", "malian"] },
  { name: "Malaysia", region: "southeast-asia", lat: 4.2, lng: 101.98, aliases: ["malaysia", "malaysian"] },
  { name: "Mexico", region: "north-america", lat: 23.6, lng: -102.6, aliases: ["mexico", "mexican"] },
  { name: "Moldova", region: "europe", lat: 47.4, lng: 28.4, aliases: ["moldova"] },
  { name: "Mongolia", region: "east-asia", lat: 46.9, lng: 103.8, aliases: ["mongolia"] },
  { name: "Morocco", region: "africa", lat: 31.8, lng: -7.1, aliases: ["morocco", "moroccan"] },
  { name: "Mozambique", region: "africa", lat: -18.7, lng: 35.5, aliases: ["mozambique"] },
  { name: "Myanmar", region: "southeast-asia", lat: 21.9, lng: 95.96, aliases: ["myanmar", "burma"] },
  { name: "Nepal", region: "south-asia", lat: 28.4, lng: 84.1, aliases: ["nepal"] },
  { name: "Netherlands", region: "europe", lat: 52.1, lng: 5.3, aliases: ["netherlands", "dutch", "amsterdam"] },
  { name: "New Zealand", region: "oceania", lat: -40.9, lng: 174.9, aliases: ["new zealand"] },
  { name: "Nigeria", region: "africa", lat: 9.1, lng: 8.7, aliases: ["nigeria", "nigerian", "abuja"] },
  { name: "North Korea", region: "east-asia", lat: 40.3, lng: 127.5, aliases: ["north korea", "dprk", "pyongyang"] },
  { name: "North Macedonia", region: "europe", lat: 41.6, lng: 21.7, aliases: ["north macedonia", "macedonia"] },
  { name: "Norway", region: "europe", lat: 60.5, lng: 8.5, aliases: ["norway", "norwegian"] },
  { name: "Oman", region: "middle-east", lat: 21.5, lng: 55.9, aliases: ["oman"] },
  { name: "Pakistan", region: "south-asia", lat: 30.4, lng: 69.3, aliases: ["pakistan", "pakistani", "islamabad"] },
  { name: "Palestine", region: "middle-east", lat: 31.95, lng: 35.23, aliases: ["palestine", "palestinian", "gaza", "west bank"] },
  { name: "Panama", region: "north-america", lat: 8.5, lng: -80.8, aliases: ["panama"] },
  { name: "Peru", region: "south-america", lat: -9.2, lng: -75.0, aliases: ["peru", "peruvian"] },
  { name: "Philippines", region: "southeast-asia", lat: 12.9, lng: 121.8, aliases: ["philippines", "philippine", "manila"] },
  { name: "Poland", region: "europe", lat: 51.9, lng: 19.1, aliases: ["poland", "polish", "warsaw"] },
  { name: "Portugal", region: "europe", lat: 39.4, lng: -8.2, aliases: ["portugal", "portuguese"] },
  { name: "Qatar", region: "middle-east", lat: 25.4, lng: 51.2, aliases: ["qatar", "doha"] },
  { name: "Romania", region: "europe", lat: 45.9, lng: 24.97, aliases: ["romania", "romanian"] },
  { name: "Russia", region: "europe", lat: 61.5, lng: 105.3, aliases: ["russia", "russian", "moscow", "kremlin"] },
  { name: "Saudi Arabia", region: "middle-east", lat: 23.9, lng: 45.1, aliases: ["saudi arabia", "saudi", "riyadh"] },
  { name: "Serbia", region: "europe", lat: 44.0, lng: 21.0, aliases: ["serbia", "serbian"] },
  { name: "Singapore", region: "southeast-asia", lat: 1.35, lng: 103.82, aliases: ["singapore"] },
  { name: "Slovakia", region: "europe", lat: 48.7, lng: 19.7, aliases: ["slovakia"] },
  { name: "Slovenia", region: "europe", lat: 46.2, lng: 15.0, aliases: ["slovenia"] },
  { name: "Somalia", region: "africa", lat: 5.2, lng: 46.2, aliases: ["somalia", "somali", "mogadishu"] },
  { name: "South Africa", region: "africa", lat: -30.6, lng: 22.9, aliases: ["south africa", "south african"] },
  { name: "South Korea", region: "east-asia", lat: 35.9, lng: 127.8, aliases: ["south korea", "korea", "korean", "seoul"] },
  { name: "South Sudan", region: "africa", lat: 7.9, lng: 30.0, aliases: ["south sudan"] },
  { name: "Spain", region: "europe", lat: 40.5, lng: -3.7, aliases: ["spain", "spanish", "madrid"] },
  { name: "Sri Lanka", region: "south-asia", lat: 7.9, lng: 80.8, aliases: ["sri lanka"] },
  { name: "Sudan", region: "africa", lat: 12.9, lng: 30.2, aliases: ["sudan", "sudanese", "khartoum"] },
  { name: "Sweden", region: "europe", lat: 60.1, lng: 18.6, aliases: ["sweden", "swedish", "stockholm"] },
  { name: "Switzerland", region: "europe", lat: 46.8, lng: 8.2, aliases: ["switzerland", "swiss"] },
  { name: "Syria", region: "middle-east", lat: 34.8, lng: 39.0, aliases: ["syria", "syrian", "damascus"] },
  { name: "Taiwan", region: "east-asia", lat: 23.7, lng: 120.96, aliases: ["taiwan", "taiwanese"] },
  { name: "Tajikistan", region: "central-asia", lat: 38.9, lng: 71.3, aliases: ["tajikistan"] },
  { name: "Thailand", region: "southeast-asia", lat: 15.0, lng: 101.0, aliases: ["thailand", "thai", "bangkok"] },
  { name: "Tunisia", region: "africa", lat: 33.9, lng: 9.6, aliases: ["tunisia"] },
  { name: "Turkey", region: "middle-east", lat: 38.96, lng: 35.24, aliases: ["turkey", "turkish", "ankara", "turkiye"] },
  { name: "Turkmenistan", region: "central-asia", lat: 38.97, lng: 59.6, aliases: ["turkmenistan"] },
  { name: "Uganda", region: "africa", lat: 1.4, lng: 32.3, aliases: ["uganda"] },
  { name: "Ukraine", region: "europe", lat: 48.4, lng: 31.2, aliases: ["ukraine", "ukrainian", "kyiv", "kharkiv"] },
  { name: "United Arab Emirates", region: "middle-east", lat: 23.4, lng: 53.85, aliases: ["uae", "emirates", "dubai", "abu dhabi"] },
  { name: "United Kingdom", region: "europe", lat: 55.4, lng: -3.4, aliases: ["uk", "united kingdom", "britain", "british", "london", "england"] },
  { name: "United States", region: "north-america", lat: 37.1, lng: -95.7, aliases: ["us", "u.s.", "usa", "united states", "america", "american", "washington"] },
  { name: "Uruguay", region: "south-america", lat: -32.5, lng: -55.8, aliases: ["uruguay"] },
  { name: "Uzbekistan", region: "central-asia", lat: 41.4, lng: 64.6, aliases: ["uzbekistan"] },
  { name: "Venezuela", region: "south-america", lat: 6.4, lng: -66.6, aliases: ["venezuela", "venezuelan"] },
  { name: "Vietnam", region: "southeast-asia", lat: 14.1, lng: 108.3, aliases: ["vietnam", "vietnamese"] },
  { name: "Yemen", region: "middle-east", lat: 15.6, lng: 48.5, aliases: ["yemen", "yemeni", "sanaa"] },
  { name: "Zambia", region: "africa", lat: -13.1, lng: 27.8, aliases: ["zambia"] },
  { name: "Zimbabwe", region: "africa", lat: -19.0, lng: 29.2, aliases: ["zimbabwe"] },
];

export const CITIES: CityInfo[] = [
  { name: "Baghdad", country: "Iraq", lat: 33.31, lng: 44.36 },
  { name: "Bamako", country: "Mali", lat: 12.64, lng: -8.0 },
  { name: "Bangkok", country: "Thailand", lat: 13.76, lng: 100.5 },
  { name: "Beijing", country: "China", lat: 39.9, lng: 116.4 },
  { name: "Beirut", country: "Lebanon", lat: 33.89, lng: 35.5 },
  { name: "Berlin", country: "Germany", lat: 52.52, lng: 13.4 },
  { name: "Brasilia", country: "Brazil", lat: -15.79, lng: -47.88 },
  { name: "Brussels", country: "Belgium", lat: 50.85, lng: 4.35 },
  { name: "Buenos Aires", country: "Argentina", lat: -34.6, lng: -58.38 },
  { name: "Cairo", country: "Egypt", lat: 30.04, lng: 31.24 },
  { name: "Caracas", country: "Venezuela", lat: 10.48, lng: -66.9 },
  { name: "Damascus", country: "Syria", lat: 33.51, lng: 36.29 },
  { name: "Delhi", country: "India", lat: 28.61, lng: 77.21 },
  { name: "Doha", country: "Qatar", lat: 25.29, lng: 51.53 },
  { name: "Dubai", country: "United Arab Emirates", lat: 25.2, lng: 55.27 },
  { name: "Dublin", country: "Ireland", lat: 53.35, lng: -6.26 },
  { name: "Geneva", country: "Switzerland", lat: 46.2, lng: 6.14 },
  { name: "Hanoi", country: "Vietnam", lat: 21.03, lng: 105.85 },
  { name: "Havana", country: "Cuba", lat: 23.11, lng: -82.37 },
  { name: "Hong Kong", country: "China", lat: 22.32, lng: 114.17 },
  { name: "Islamabad", country: "Pakistan", lat: 33.69, lng: 73.06 },
  { name: "Istanbul", country: "Turkey", lat: 41.01, lng: 28.98 },
  { name: "Jakarta", country: "Indonesia", lat: -6.21, lng: 106.85 },
  { name: "Jerusalem", country: "Israel", lat: 31.77, lng: 35.21 },
  { name: "Johannesburg", country: "South Africa", lat: -26.2, lng: 28.05 },
  { name: "Kabul", country: "Afghanistan", lat: 34.53, lng: 69.17 },
  { name: "Khartoum", country: "Sudan", lat: 15.5, lng: 32.56 },
  { name: "Kinshasa", country: "DR Congo", lat: -4.44, lng: 15.27 },
  { name: "Kyiv", country: "Ukraine", lat: 50.45, lng: 30.52 },
  { name: "Lagos", country: "Nigeria", lat: 6.52, lng: 3.38 },
  { name: "Lima", country: "Peru", lat: -12.05, lng: -77.04 },
  { name: "London", country: "United Kingdom", lat: 51.51, lng: -0.13 },
  { name: "Los Angeles", country: "United States", lat: 34.05, lng: -118.24 },
  { name: "Madrid", country: "Spain", lat: 40.42, lng: -3.7 },
  { name: "Manila", country: "Philippines", lat: 14.6, lng: 120.98 },
  { name: "Mexico City", country: "Mexico", lat: 19.43, lng: -99.13 },
  { name: "Mogadishu", country: "Somalia", lat: 2.05, lng: 45.32 },
  { name: "Moscow", country: "Russia", lat: 55.76, lng: 37.62 },
  { name: "Nairobi", country: "Kenya", lat: -1.29, lng: 36.82 },
  { name: "New York City", country: "United States", lat: 40.71, lng: -74.01 },
  { name: "Ottawa", country: "Canada", lat: 45.42, lng: -75.7 },
  { name: "Paris", country: "France", lat: 48.86, lng: 2.35 },
  { name: "Pyongyang", country: "North Korea", lat: 39.02, lng: 125.75 },
  { name: "Quito", country: "Ecuador", lat: -0.18, lng: -78.47 },
  { name: "Riyadh", country: "Saudi Arabia", lat: 24.71, lng: 46.68 },
  { name: "Rome", country: "Italy", lat: 41.9, lng: 12.5 },
  { name: "San Francisco", country: "United States", lat: 37.77, lng: -122.42 },
  { name: "Santiago", country: "Chile", lat: -33.45, lng: -70.67 },
  { name: "Seoul", country: "South Korea", lat: 37.57, lng: 126.98 },
  { name: "Singapore", country: "Singapore", lat: 1.35, lng: 103.82 },
  { name: "Stockholm", country: "Sweden", lat: 59.33, lng: 18.07 },
  { name: "Sydney", country: "Australia", lat: -33.87, lng: 151.21 },
  { name: "Taipei", country: "Taiwan", lat: 25.03, lng: 121.57 },
  { name: "Tehran", country: "Iran", lat: 35.69, lng: 51.39 },
  { name: "Tokyo", country: "Japan", lat: 35.68, lng: 139.69 },
  { name: "Toronto", country: "Canada", lat: 43.65, lng: -79.38 },
  { name: "UN HQ New York", country: "United States", lat: 40.75, lng: -73.97 },
  { name: "Vienna", country: "Austria", lat: 48.21, lng: 16.37 },
  { name: "Warsaw", country: "Poland", lat: 52.23, lng: 21.01 },
  { name: "Washington, D.C.", country: "United States", lat: 38.91, lng: -77.04, aliases: ["washington dc", "washington d.c."] },
  { name: "Yerevan", country: "Armenia", lat: 40.18, lng: 44.51 },
  { name: "Zagreb", country: "Croatia", lat: 45.81, lng: 15.98 },
];

const COUNTRY_RADIUS_KM = 350;
const CITY_RADIUS_KM = 60;

interface PlaceIndexEntry {
  key: string; // lowercase alias
  type: "country" | "city";
  country: CountryInfo | undefined;
  city?: CityInfo;
}

let placeIndex: Map<string, PlaceIndexEntry[]> | null = null;

function buildIndex(): Map<string, PlaceIndexEntry[]> {
  const idx = new Map<string, PlaceIndexEntry[]>();
  const add = (key: string, entry: PlaceIndexEntry) => {
    const k = key.toLowerCase().trim();
    if (k.length < 2) return; // ignore single-character aliases (very false-positive prone)
    const list = idx.get(k);
    if (list) list.push(entry);
    else idx.set(k, [entry]);
  };
  for (const c of COUNTRIES) {
    const country = c;
    for (const alias of [c.name, ...c.aliases]) {
      add(alias, { key: alias.toLowerCase(), type: "country", country });
    }
  }
  for (const city of CITIES) {
    const country = COUNTRIES.find((c) => c.name === city.country);
    const entry: PlaceIndexEntry = {
      key: city.name.toLowerCase(),
      type: "city",
      country,
      city,
    };
    add(city.name, entry);
    for (const alias of city.aliases ?? []) add(alias, entry);
  }
  return idx;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resolve place names mentioned in arbitrary text to GeoRefs.
 * Longest aliases win; each alias matches at most once.
 */
export function resolveGeoFromText(text: string): GeoRef[] {
  if (!placeIndex) placeIndex = buildIndex();
  const lower = text.toLowerCase();
  const aliases = [...placeIndex.keys()].sort((a, b) => b.length - a.length);
  const used = new Set<string>();
  const results: GeoRef[] = [];

  for (const alias of aliases) {
    const re = new RegExp(`(?<![a-z0-9])${escapeRegExp(alias)}(?![a-z0-9])`, "i");
    if (!re.test(lower)) continue;
    if (results.some((r) => r.name.toLowerCase() === alias)) continue;
    const entries = placeIndex.get(alias)!;
    // Prefer city entries over countries when the alias maps to both.
    const entry = entries.find((e) => e.type === "city") ?? entries[0];
    if (entry.type === "city" && entry.city) {
      const cityName = entry.city.name;
      if (used.has(cityName)) continue;
      used.add(cityName);
      results.push({
        name: cityName,
        kind: "city",
        country: entry.city.country,
        region: entry.country?.region,
        lat: entry.city.lat,
        lng: entry.city.lng,
        precisionRadiusKm: CITY_RADIUS_KM,
      });
    } else if (entry.country) {
      const countryName = entry.country.name;
      if (used.has(countryName)) continue;
      // If a city in this country already matched, keep the city but still
      // allow the country to appear as broader context.
      used.add(countryName);
      results.push({
        name: countryName,
        kind: "country",
        country: countryName,
        region: entry.country.region,
        lat: entry.country.lat,
        lng: entry.country.lng,
        precisionRadiusKm: COUNTRY_RADIUS_KM,
      });
    }
    if (results.length >= 4) break; // bound work; most items mention ≤ 4 places
  }
  return results;
}

export function countryToRegion(country: string): Region | undefined {
  return COUNTRIES.find((c) => c.name === country)?.region;
}

/** Haversine distance in km. */
export function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Reverse-lookup a browser-provided coordinate to the nearest gazetteer place.
 * Used so we can store city-level location instead of raw GPS (privacy).
 */
export function nearestPlace(
  lat: number,
  lng: number,
): { name: string; country: string; region: Region; lat: number; lng: number } | null {
  let best: { dist: number; city: CityInfo } | null = null;
  for (const city of CITIES) {
    const d = distanceKm(lat, lng, city.lat, city.lng);
    if (!best || d < best.dist) best = { dist: d, city };
  }
  if (best && best.dist <= 150) {
    const region = countryToRegion(best.city.country);
    if (region) {
      return {
        name: best.city.name,
        country: best.city.country,
        region,
        lat: best.city.lat,
        lng: best.city.lng,
      };
    }
  }
  // Fall back to nearest country centroid (still coarse, never precise GPS).
  let bestCountry: { dist: number; country: CountryInfo } | null = null;
  for (const c of COUNTRIES) {
    const d = distanceKm(lat, lng, c.lat, c.lng);
    if (!bestCountry || d < bestCountry.dist) bestCountry = { dist: d, country: c };
  }
  if (bestCountry && bestCountry.dist <= 600) {
    const c = bestCountry.country;
    return { name: c.name, country: c.name, region: c.region, lat: c.lat, lng: c.lng };
  }
  return null;
}
