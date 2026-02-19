import type { Route } from "./+types/api.update-lookbook";
import { getDb, lookbooks } from "~/lib/db.server";
import { eq } from "drizzle-orm";
import { requireAuthApi } from "~/lib/auth.server";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  try {
    const body = await request.json();
    const { lookbookId, name, description } = body;

    if (!lookbookId) {
      return Response.json({ error: "lookbookId is required" }, { status: 400, headers: authHeaders });
    }

    const hasDescription = "description" in body;
    if (!name && !hasDescription) {
      return Response.json(
        { error: "name or description is required" },
        { status: 400, headers: authHeaders }
      );
    }

    const db = getDb(context.cloudflare as { env: Record<string, string> });

    const updateData: { name?: string; displayName?: string; description?: string | null } = {};
    if (name && typeof name === "string" && name.trim().length > 0) {
      updateData.name = name.trim().toLowerCase();
      updateData.displayName = name.trim();
    }
    if (hasDescription) {
      updateData.description = body.description === null ? null : String(body.description).trim();
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json(
        { error: "No valid fields to update" },
        { status: 400, headers: authHeaders }
      );
    }

    await db
      .update(lookbooks)
      .set(updateData)
      .where(eq(lookbooks.id, lookbookId));

    return Response.json({ success: true }, { headers: authHeaders });
  } catch (error) {
    console.error("Failed to update lookbook:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500, headers: authHeaders }
    );
  }
}
