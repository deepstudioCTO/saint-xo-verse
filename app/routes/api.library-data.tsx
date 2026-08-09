import { desc, asc, inArray } from "drizzle-orm";
import type { Route } from "./+types/api.library-data";
import { withDb, workflowRuns, nodeRuns, workflowTemplates, characters, personas } from "~/lib/db.server";
import { requireAuthApi } from "~/lib/auth.server";
import { toLibraryRun, type TemplateMeta } from "~/lib/workflow/libraryRun";

/**
 * GET /api/library-data — Library 패널(run 결과물 뷰) 데이터.
 *
 * 직렬화·최종 산출물 파생은 순수함수 toLibraryRun에 위임 — 라우트는 쿼리와 조합만.
 * Library가 미완료 run 존재 시 6초 간격으로 재호출하는 폴링 엔드포인트이므로 withDb 필수.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = (context.cloudflare as { env: Record<string, string> }).env;
  const { headers: authHeaders } = await requireAuthApi(request, env);

  const data = await withDb(context.cloudflare as { env: Record<string, string> }, async (db) => {
    const [allRuns, allCharacters, allPersonas, allTemplates] = await Promise.all([
      db.select().from(workflowRuns).orderBy(desc(workflowRuns.startedAt)),
      db.select().from(characters).orderBy(asc(characters.displayOrder)),
      db
        .select({ lookId: personas.lookId, characterId: personas.characterId, name: personas.name })
        .from(personas),
      db
        .select({ id: workflowTemplates.id, name: workflowTemplates.name, category: workflowTemplates.category })
        .from(workflowTemplates),
    ]);

    const runIds = allRuns.map((r) => r.id);
    const allNodeRuns =
      runIds.length > 0
        ? await db
            .select({
              runId: nodeRuns.runId,
              nodeId: nodeRuns.nodeId,
              nodeType: nodeRuns.nodeType,
              status: nodeRuns.status,
              outputs: nodeRuns.outputs,
            })
            .from(nodeRuns)
            .where(inArray(nodeRuns.runId, runIds))
        : [];

    return { allRuns, allCharacters, allPersonas, allTemplates, allNodeRuns };
  });

  const nodeRunsByRunId = new Map<string, typeof data.allNodeRuns>();
  for (const n of data.allNodeRuns) {
    const list = nodeRunsByRunId.get(n.runId) ?? [];
    list.push(n);
    nodeRunsByRunId.set(n.runId, list);
  }

  const templateMetaById = new Map<string, TemplateMeta>(
    data.allTemplates.map((t) => [t.id, { name: t.name, category: t.category }])
  );

  const runs = data.allRuns.map((run) =>
    toLibraryRun(
      run,
      nodeRunsByRunId.get(run.id) ?? [],
      run.templateId ? templateMetaById.get(run.templateId) : undefined
    )
  );

  const characterList = data.allCharacters.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    video: c.video,
    poster: c.poster,
    displayOrder: c.displayOrder,
  }));

  const personaMap: Record<string, Record<string, { name: string }>> = {};
  for (const p of data.allPersonas) {
    (personaMap[p.lookId] ??= {})[p.characterId] = { name: p.name };
  }

  return Response.json({ runs, characters: characterList, personaMap }, { headers: authHeaders });
}
