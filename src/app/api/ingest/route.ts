import { timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { forceRefresh } from "@/lib/store/cache";

export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * POST /api/ingest — force a data refresh.
 * Protected by INGEST_TOKEN (Bearer token). If no token is configured the
 * endpoint is disabled (403). This exists so external schedulers
 * (e.g. Windows Task Scheduler + curl) can drive periodic ingestion; ORBIS
 * itself has no background daemon.
 */
export async function POST(request: Request) {
  const limited = enforceRateLimit(request, { limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const env = getEnv();
  if (!env.INGEST_TOKEN) {
    return Response.json(
      { error: "ingest-disabled", detail: "INGEST_TOKEN is not configured." },
      { status: 403 },
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !safeEqual(token, env.INGEST_TOKEN)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  const snapshot = await forceRefresh();
  return Response.json({
    ok: true,
    durationMs: Date.now() - started,
    articles: snapshot.articles.length,
    events: snapshot.events.length,
    errors: snapshot.meta.errors,
    generatedAt: snapshot.meta.generatedAt,
  });
}
