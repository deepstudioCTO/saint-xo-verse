/**
 * 기존 workflow_runs의 inputs를 templateSnapshot에서 재구성한다.
 *
 * 에디터 Run이 `{source:"editor"}`만 보내던 시절의 실행분은 멤버·룩·트랙이 비어 있어
 * LIBRARY 카드가 "Unknown"으로 뜬다. 조합 정보는 스냅샷 그래프에 그대로 남아 있으므로
 * deriveRunInputs(실행 시점과 같은 순수 함수)로 다시 뽑아 채운다.
 *
 * 실행:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/backfill-run-inputs.ts
 */
import postgres from "postgres";
import { deriveRunInputs } from "../app/lib/workflow/runInputs";
import { parseRunInputs } from "../app/lib/workflow/runInputs";
import type { GraphNodeLike } from "../app/lib/workflow/types";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const sql = postgres(databaseUrl, { prepare: false });

async function main() {
  const runs = await sql<{ id: string; snapshot: string; inputs: string | null }[]>`
    select id, template_snapshot as snapshot, inputs from workflow_runs`;

  let updated = 0;
  for (const run of runs) {
    let nodes: GraphNodeLike[] = [];
    try {
      nodes = (JSON.parse(run.snapshot).nodes ?? []) as GraphNodeLike[];
    } catch {
      continue;
    }

    const existing = parseRunInputs(run.inputs ? JSON.parse(run.inputs) : {});
    // 기존 값이 우선 — 백필은 비어 있는 칸만 채운다
    const merged = { ...deriveRunInputs(nodes), ...existing };
    if (JSON.stringify(merged) === JSON.stringify(existing)) continue;

    await sql`update workflow_runs set inputs = ${JSON.stringify(merged)} where id = ${run.id}`;
    updated++;
    console.log(`  ${run.id.slice(0, 8)} → ${merged.characterId ?? "?"} / ${merged.lookId ?? "?"} / track ${merged.musicId ?? "-"}`);
  }

  console.log(`\n${runs.length}건 중 ${updated}건 갱신`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
