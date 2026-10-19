import { getEnv, isAisConfigured } from "@/lib/env";
import { MapView } from "@/components/map/MapView";

export const dynamic = "force-dynamic";

/** Server wrapper: tile provider configuration comes from the environment. */
export default function MapPage() {
  const env = getEnv();
  return (
    <MapView
      tileUrl={env.ORBIS_TILE_URL}
      tileAttribution={env.ORBIS_TILE_ATTRIBUTION}
      aisConfigured={isAisConfigured(env)}
    />
  );
}
