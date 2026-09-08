import { eq } from "drizzle-orm";
import type { Route } from "./+types/api.adopt-run";
import { withDb, workflowRuns } from "~/lib/db.server";
import { requireAuthApi } from "~/lib/auth.server";

/**
 * POST /api/adopt-run — 생성물 채택(품질 검수 통과) 플래그 토글.
 *
 * Body: { id: string, adopted: boolean }
 *
 * "완성 숏폼 편수"는 실행 성공 편수가 아니라 **검수 통과 편수**다(구현계획서 P2-1b ㉡).
 * 이 플래그가 없으면 편수 카운트가 수기가 되고 metrics 채택률이 영구 null로 남는다.
 * 완료되지 않은 run은 검수 대상이 아니므로 채택할 수 없다.
 */
export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  try {
    const { id, adopted } = (await request.json()) as { id?: string; adopted?: boolean };
    if (!id || typeof adopted !== "boolean") {
      return Response.json(
        { error: "id(string) / adopted(boolean) 필요" },
        { status: 400, headers: authHeaders }
      );
    }

    const result = await withDb(
      context.cloudflare as { env: Record<string, string> },
      async (db) => {
        const [run] = await db
          .select({ id: workflowRuns.id, status: workflowRuns.status })
          .from(workflowRuns)
          .where(eq(workflowRuns.id, id))
          .limit(1);
        if (!run) return { error: "run not found" as const };
        if (adopted && run.status !== "completed") {
          return { error: "완료되지 않은 run은 채택할 수 없습니다" as const };
        }

        const [updated] = await db
          .update(workflowRuns)
          .set({ adopted, adoptedAt: adopted ? new Date() : null })
          .where(eq(workflowRuns.id, id))
          .returning({ id: workflowRuns.id, adopted: workflowRuns.adopted });
        return { updated };
      }
    );

    if ("error" in result && result.error) {
      const status = result.error === "run not found" ? 404 : 409;
      return Response.json({ error: result.error }, { status, headers: authHeaders });
    }

    return Response.json({ success: true, adopted }, { headers: authHeaders });
  } catch (err) {
    console.error("adopt-run error:", err);
    return Response.json({ error: String(err) }, { status: 500, headers: authHeaders });
  }
}
