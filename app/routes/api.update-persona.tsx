import type { Route } from "./+types/api.update-persona";
import { getDb, personas } from "~/lib/db.server";
import { and, eq } from "drizzle-orm";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { lookId, characterId, name, description } = body;
    // defaultInput can be string (URL) or null (reset to poster)
    const hasDefaultInput = "defaultInput" in body;

    if (!lookId || !characterId) {
      return Response.json({ error: "lookId and characterId are required" }, { status: 400 });
    }

    // At least one field must be provided
    if (!name && !description && !hasDefaultInput) {
      return Response.json(
        { error: "name, description, or defaultInput is required" },
        { status: 400 }
      );
    }

    const db = getDb(context.cloudflare as { env: Record<string, string> });

    // Build update object with only provided fields
    const updateData: { name?: string; description?: string; defaultInput?: string | null } = {};
    if (name && typeof name === "string" && name.trim().length > 0) {
      updateData.name = name.trim();
    }
    if (description && typeof description === "string") {
      updateData.description = description.trim();
    }
    if (hasDefaultInput) {
      updateData.defaultInput = body.defaultInput === null ? null : String(body.defaultInput);
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Update persona
    await db
      .update(personas)
      .set(updateData)
      .where(
        and(
          eq(personas.lookId, lookId),
          eq(personas.characterId, characterId)
        )
      );

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to update persona:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
