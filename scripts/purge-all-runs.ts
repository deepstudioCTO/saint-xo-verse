/**
 * 실행 이력 전량 삭제 — workflow_runs · node_runs + 산출물 Storage 파일.
 *
 * 배경: 버그 있던 코드로 쌓인 실행 기록은 지표 근거로 쓸 수 없다.
 * (templateId 미기록 → 재사용률 집계 불가, deriveRunStatus 조기 completed → 소요시간 불신,
 *  node_runs 사전 실체화 이전이라 노드 기록 반쪽, 코드 버그로 인한 실패가 품질 실패로 집계됨)
 * 정상 코드로 재생성하는 편이 지표가 유효하다.
 *
 * 실행:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/purge-all-runs.ts         # 확인만
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/purge-all-runs.ts --apply # 실제 삭제
 */
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!supabaseUrl || !supabaseKey) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_KEY required");

const APPLY = process.argv.includes("--apply");
const sql = postgres(databaseUrl, { prepare: false });
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET = "motion-videos";
/** public URL → 버킷 내부 경로. 다른 버킷/외부 URL이면 null */
function toStoragePath(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

async function main() {
  const runs = await sql<{ id: string }[]>`select id from workflow_runs`;
  const nodes = await sql<{ outputs: string | null }[]>`select outputs from node_runs`;

  const paths: string[] = [];
  for (const n of nodes) {
    if (!n.outputs) continue;
    try {
      const url = (JSON.parse(n.outputs) as { url?: string }).url;
      if (!url) continue;
      const p = toStoragePath(url);
      // 템플릿 썸네일은 실행 산출물이 아니므로 보존한다
      if (p && !p.startsWith("generated-images/template-thumbs/")) paths.push(p);
    } catch {
      /* 파싱 불가 행은 건너뛴다 */
    }
  }

  console.log(`실행 ${runs.length}건, 삭제 대상 Storage 파일 ${paths.length}개`);

  if (!APPLY) {
    console.log("확인 모드입니다. 실제로 지우려면 --apply 를 붙여 실행하세요.");
    await sql.end();
    return;
  }

  if (paths.length > 0) {
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { error } = await supabase.storage.from(BUCKET).remove(chunk);
      if (error) console.warn(`  Storage 삭제 일부 실패: ${error.message}`);
    }
    console.log(`Storage 파일 ${paths.length}개 삭제 요청 완료`);
  }

  await sql`delete from node_runs`;
  await sql`delete from workflow_runs`;
  console.log(`DB 실행 기록 전량 삭제 완료 (${runs.length}건)`);

  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
