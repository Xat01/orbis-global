export const dynamic = "force-dynamic";

/** GET /api/health — liveness check. */
export async function GET() {
  return Response.json({ ok: true, service: "orbis", time: new Date().toISOString() });
}
