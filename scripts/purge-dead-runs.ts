/**
 * 산출물 파일이 실제로 존재하지 않는 workflow_run을 정리한다.
 *
 * 배경: 레거시 generations purge가 node_runs와 스토리지를 공유하던 파일까지 지워서,
 * DB에는 completed로 남아 있지만 URL이 404인 실행 기록이 생겼다. 이 상태면
 * LIBRARY에 깨진 카드가 뜨고, 지표의 "숏폼 편수"가 실제 재생 가능 편수보다 부풀려진다.
 *
 * 판정: 완료 node_run의 outputs.url을 HEAD로 확인해 하나라도 살아있으면 보존,
 * 살아있는 산출물이 하나도 없는 run만 삭제한다(node_runs → workflow_runs 순).
 *
 * 실행:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/purge-dead-runs.ts        # 확인만
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/purge-dead-runs.ts --apply # 실제 삭제
 */
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const APPLY = process.argv.includes("--apply");
const sql = postgres(databaseUrl, { prepare: false });

async function alive(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const runs = await sql<{ id: string; status: string; started_at: Date }[]>`
    select id, status, started_at from workflow_runs order by started_at`;

  const dead: string[] = [];

  for (const run of runs) {
    const nodes = await sql<{ outputs: string | null; status: string }[]>`
      select outputs, status from node_runs where run_id = ${run.id}`;

    const urls = nodes
      .filter((n) => n.status === "completed" && n.outputs)
      .map((n) => {
        try {
          return (JSON.parse(n.outputs!) as { url?: string }).url;
        } catch {
          return undefined;
        }
      })
      .filter((u): u is string => !!u);

    // 산출물이 애초에 없는 run(전부 실패/미완)은 판단 대상에서 제외 — 이력으로 남긴다
    if (urls.length === 0) continue;

    const checks = await Promise.all(urls.map(alive));
    const liveCount = checks.filter(Boolean).length;

    if (liveCount === 0) {
      dead.push(run.id);
      console.log(`✗ ${run.started_at.toISOString().slice(0, 10)} ${run.id} — 산출물 ${urls.length}건 전부 없음`);
    } else {
      console.log(`✓ ${run.started_at.toISOString().slice(0, 10)} ${run.id} — 생존 ${liveCount}/${urls.length}`);
    }
  }

  console.log(`\n삭제 대상: ${dead.length}건 / 전체 ${runs.length}건`);

  if (!APPLY) {
    console.log("확인 모드입니다. 실제로 지우려면 --apply 를 붙여 실행하세요.");
  } else if (dead.length > 0) {
    await sql`delete from node_runs where run_id in ${sql(dead)}`;
    await sql`delete from workflow_runs where id in ${sql(dead)}`;
    console.log(`삭제 완료: ${dead.length}건`);
  }

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
