import type { Route } from "./+types/api.update-motion";
import { getDb, motionVideos } from "~/lib/db.server";
import { eq } from "drizzle-orm";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { id, name } = await request.json();

    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return Response.json({ error: "name is required" }, { status: 400 });
    }

    const db = getDb(context.cloudflare as { env: Record<string, string> });

    // Update motion video name
    await db
      .update(motionVideos)
      .set({ name: name.trim() })
      .where(eq(motionVideos.id, id));

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to update motion:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
