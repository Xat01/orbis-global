import { getSnapshot } from "@/lib/store/cache";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { BriefingModeSchema } from "@/lib/types";
import { generateBriefing } from "@/lib/intelligence/ai/provider";

export const dynamic = "force-dynamic";

/**
 * GET /api/events/[id]?mode=quick|standard|detailed
 * Returns the event, its articles, recorded updates and a structured
 * briefing (AI-generated when a provider is configured, deterministic
 * fallback otherwise — honestly labelled via generator/aiStatus).
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  const { id } = await ctx.params;
  const snapshot = await getSnapshot();
  const event = snapshot.events.find((e) => e.id === id);
  if (!event) {
    return Response.json({ error: "event-not-found" }, { status: 404 });
  }

  const articles = snapshot.articles.filter((a) => a.eventId === id);
  const updates = snapshot.updates.filter((u) => u.eventId === id);

  const modeParam = new URL(request.url).searchParams.get("mode") ?? "standard";
  const parsedMode = BriefingModeSchema.safeParse(modeParam);
  const mode = parsedMode.success ? parsedMode.data : "standard";

  const { briefing, aiStatus, aiError } = await generateBriefing({
    event,
    articles,
    updates,
    mode,
  });

  return Response.json({
    event,
    articles,
    updates,
    briefing,
    aiStatus,
    aiError,
    meta: snapshot.meta,
  });
}
