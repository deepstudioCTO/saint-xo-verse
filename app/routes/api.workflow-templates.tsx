import { eq, desc } from "drizzle-orm";
import type { Route } from "./+types/api.workflow-templates";
import { getDb, workflowTemplates } from "~/lib/db.server";
import { requireAuthApi } from "~/lib/auth.server";

// GET /api/workflow-templates — 템플릿 목록 조회
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  const db = getDb(context.cloudflare as { env: Record<string, string> });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    // 단일 템플릿 조회
    const [template] = await db
      .select()
      .from(workflowTemplates)
      .where(eq(workflowTemplates.id, id))
      .limit(1);

    if (!template) {
      return Response.json({ error: "Template not found" }, { status: 404, headers: authHeaders });
    }
    return Response.json({ template }, { headers: authHeaders });
  }

  // 전체 목록 (published만 or 전체)
  const publishedOnly = url.searchParams.get("published") === "true";
  let query = db
    .select({
      id: workflowTemplates.id,
      name: workflowTemplates.name,
      description: workflowTemplates.description,
      category: workflowTemplates.category,
      thumbnailUrl: workflowTemplates.thumbnailUrl,
      currentVersion: workflowTemplates.currentVersion,
      isPublished: workflowTemplates.isPublished,
      createdAt: workflowTemplates.createdAt,
      updatedAt: workflowTemplates.updatedAt,
    })
    .from(workflowTemplates)
    .orderBy(desc(workflowTemplates.updatedAt));

  if (publishedOnly) {
    query = query.where(eq(workflowTemplates.isPublished, true)) as typeof query;
  }

  const templates = await query;
  return Response.json({ templates }, { headers: authHeaders });
}

// POST /api/workflow-templates — 템플릿 생성/업데이트
export async function action({ request, context }: Route.ActionArgs) {
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  const db = getDb(context.cloudflare as { env: Record<string, string> });

  if (request.method === "POST") {
    // Create or Update
    try {
      const body = await request.json();
      const { id, name, description, category, nodes, edges, viewport, isPublished } = body;

      if (!name || typeof nodes !== "string" || typeof edges !== "string") {
        return Response.json(
          { error: "name, nodes, edges are required" },
          { status: 400, headers: authHeaders }
        );
      }

      if (id) {
        // Update existing template
        const [existing] = await db
          .select()
          .from(workflowTemplates)
          .where(eq(workflowTemplates.id, id))
          .limit(1);

        if (!existing) {
          return Response.json({ error: "Template not found" }, { status: 404, headers: authHeaders });
        }

        const [updated] = await db
          .update(workflowTemplates)
          .set({
            name,
            description: description || null,
            category: category || null,
            nodes,
            edges,
            viewport: viewport || '{"x":0,"y":0,"zoom":1}',
            isPublished: isPublished ?? existing.isPublished,
            currentVersion: existing.currentVersion + 1,
          })
          .where(eq(workflowTemplates.id, id))
          .returning();

        return Response.json({ success: true, template: updated }, { headers: authHeaders });
      } else {
        // Create new template
        const [created] = await db
          .insert(workflowTemplates)
          .values({
            name,
            description: description || null,
            category: category || null,
            nodes,
            edges,
            viewport: viewport || '{"x":0,"y":0,"zoom":1}',
            isPublished: isPublished ?? false,
          })
          .returning();

        return Response.json({ success: true, template: created }, { headers: authHeaders });
      }
    } catch (error) {
      console.error("Failed to save workflow template:", error);
      return Response.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500, headers: authHeaders }
      );
    }
  }

  if (request.method === "DELETE") {
    try {
      const body = await request.json();
      const { id } = body;

      if (!id) {
        return Response.json({ error: "id is required" }, { status: 400, headers: authHeaders });
      }

      await db.delete(workflowTemplates).where(eq(workflowTemplates.id, id));
      return Response.json({ success: true }, { headers: authHeaders });
    } catch (error) {
      console.error("Failed to delete workflow template:", error);
      return Response.json(
        { error: error instanceof Error ? error.message : "Unknown error" },
        { status: 500, headers: authHeaders }
      );
    }
  }

  return Response.json({ error: "Method not allowed" }, { status: 405, headers: authHeaders });
}
