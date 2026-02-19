import type { Route } from "./+types/api.editor-save";
import { getDb, editorProjects } from "~/lib/db.server";
import { requireAuthApi } from "~/lib/auth.server";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "PUT") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  try {
    const body = await request.json();
    const { id, nodes, edges, viewport, sourceGenerationId } = body;

    if (!id || typeof nodes !== "string" || typeof edges !== "string") {
      return Response.json({ error: "id, nodes, edges are required" }, { status: 400 });
    }

    const db = getDb(context.cloudflare as { env: Record<string, string> });

    await db
      .insert(editorProjects)
      .values({
        id,
        nodes,
        edges,
        viewport: viewport || '{"x":0,"y":0,"zoom":1}',
        sourceGenerationId: sourceGenerationId || null,
      })
      .onConflictDoUpdate({
        target: editorProjects.id,
        set: {
          nodes,
          edges,
          viewport: viewport || '{"x":0,"y":0,"zoom":1}',
          sourceGenerationId: sourceGenerationId || null,
        },
      });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Failed to save editor project:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
