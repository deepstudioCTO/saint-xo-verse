import type { Route } from "./+types/api.update-music";
import { getDb, generations } from "~/lib/db.server";
import { eq } from "drizzle-orm";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { generationId, musicId } = await request.json();

    if (!generationId) {
      return Response.json({ error: "generationId is required" }, { status: 400 });
    }

    const db = getDb(context.cloudflare as { env: Record<string, string> });

    // Update musicId (null means no music)
    await db
      .update(generations)
      .set({ musicId: musicId || null })
      .where(eq(generations.id, generationId));

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to update music:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
