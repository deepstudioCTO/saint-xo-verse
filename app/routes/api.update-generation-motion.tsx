import type { Route } from "./+types/api.update-generation-motion";
import { getDb, generations } from "~/lib/db.server";
import { eq } from "drizzle-orm";
import { requireAuthApi } from "~/lib/auth.server";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  try {
    const { generationId, motionVideoId } = await request.json();

    if (!generationId) {
      return Response.json({ error: "generationId is required" }, { status: 400, headers: authHeaders });
    }

    const db = getDb(context.cloudflare as { env: Record<string, string> });

    // Update motionVideoId (null means no motion video mapping)
    await db
      .update(generations)
      .set({ motionVideoId: motionVideoId || null })
      .where(eq(generations.id, generationId));

    return Response.json({ success: true }, { headers: authHeaders });
  } catch (error) {
    console.error("Failed to update generation motion:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500, headers: authHeaders }
    );
  }
}
