// ---------------------------------------------------------------------------
// Copies the MapLibre GL worker into /public.
//
// Why: MapLibre v6 loads its tile worker from a bundler-generated URL, which
// Turbopack does not rewrite correctly ("Worker failed to load. Check that the
// worker URL is correct."). Serving the worker as a static file and pointing
// MapLibre at it with setWorkerUrl() sidesteps the bundler entirely.
//
// The file is generated (not committed) so it can never drift from the
// installed maplibre-gl version. Run automatically by `predev` and `prebuild`.
// ---------------------------------------------------------------------------

import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const packageDir = path.dirname(require.resolve("maplibre-gl/package.json"));
const source = path.join(packageDir, "dist", "maplibre-gl-worker.mjs");
const destination = path.join(process.cwd(), "public", "maplibre-gl-worker.mjs");

await mkdir(path.dirname(destination), { recursive: true });
await copyFile(source, destination);
console.log(`maplibre worker -> ${path.relative(process.cwd(), destination)}`);
