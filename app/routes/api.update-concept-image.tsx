import type { Route } from "./+types/api.update-concept-image";
import { getDb } from "~/lib/db.server";
import { conceptImages } from "../../drizzle/schema";
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

    // Update concept image name
    await db
      .update(conceptImages)
      .set({ name: name.trim() })
      .where(eq(conceptImages.id, id));

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to update concept image:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
