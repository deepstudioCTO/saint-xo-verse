import type { Route } from "./+types/api.update-character";
import { getDb, characters } from "~/lib/db.server";
import { eq } from "drizzle-orm";
import { requireAuthApi } from "~/lib/auth.server";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  try {
    const { id, name, description } = await request.json();

    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400, headers: authHeaders });
    }

    // At least one of name or description must be provided
    if (!name && !description) {
      return Response.json(
        { error: "name or description is required" },
        { status: 400, headers: authHeaders }
      );
    }

    const db = getDb(context.cloudflare as { env: Record<string, string> });

    // Build update object with only provided fields
    const updateData: { name?: string; description?: string } = {};
    if (name && typeof name === "string" && name.trim().length > 0) {
      updateData.name = name.trim();
    }
    if (description && typeof description === "string") {
      updateData.description = description.trim();
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json(
        { error: "No valid fields to update" },
        { status: 400, headers: authHeaders }
      );
    }

    // Update character
    await db
      .update(characters)
      .set(updateData)
      .where(eq(characters.id, id));

    return Response.json({ success: true }, { headers: authHeaders });
  } catch (error) {
    console.error("Failed to update character:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500, headers: authHeaders }
    );
  }
}
