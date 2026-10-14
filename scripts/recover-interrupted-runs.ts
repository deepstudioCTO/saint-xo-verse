/**
 * 중단된 run 복구 — 로컬 dev 서버(Cloudflare Workflow)가 폴링 도중 죽어서 `running`에 멈춘 run을
 * Replicate 예측 결과로 마감한다. 2026-10-13 재부팅으로 9월 배치 9건이 멈춘 일에서 나왔다.
 *
 * 하는 일은 generation-pipeline.ts의 persist/finalize 단계와 같다:
 *   processing 노드의 external_id로 Replicate를 조회 → succeeded면 Storage 영구 저장
 *   (`generated-videos/<nodeRunId>.mp4` / `generated-images/<nodeRunId>.<ext>`) → node_run 완료 →
 *   모든 노드가 끝났으면 run outputs 조립 후 completed.
 * failed/canceled면 node_run·run을 실패로 닫는다. processing이면 건드리지 않는다(재실행하면 이어서 처리).
 *
 * 완료 시각은 **Replicate의 completed_at**을 쓴다 — 복구 시점(now)을 쓰면 소요시간 지표가 부푼다.
 *
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/recover-interrupted-runs.ts [--dry-run]
 */
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const TOKEN = process.env.REPLICATE_TOKEN!;
const BUCKET = "motion-videos";

interface Prediction {
  status: string;
  output: string | string[] | null;
  error: string | null;
  completed_at: string | null;
}

async function getPrediction(id: string): Promise<Prediction> {
  const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) throw new Error(`Replicate ${id}: ${res.status}`);
  return (await res.json()) as Prediction;
}

async function persist(url: string, nodeRunId: string, nodeType: string) {
  const isImage = nodeType === "generate-image";
  const ext = isImage ? (url.match(/\.(png|jpe?g|webp)(\?|$)/i)?.[1] ?? "jpg") : "mp4";
  const path = isImage ? `generated-images/${nodeRunId}.${ext}` : `generated-videos/${nodeRunId}.mp4`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`다운로드 실패 ${res.status}`);
  const body = await res.arrayBuffer();
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: isImage ? `image/${ext === "jpg" ? "jpeg" : ext}` : "video/mp4",
    upsert: true,
  });
  if (error) throw error;
  return {
    url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
    type: isImage ? "image" : "video",
  };
}

const stuck = await sql`
  select n.id, n.run_id, n.node_id, n.node_type, n.external_id
  from node_runs n join workflow_runs r on r.id = n.run_id
  where r.status = 'running' and n.status = 'processing' and n.external_id is not null
  order by n.run_id`;

for (const n of stuck) {
  const p = await getPrediction(n.external_id);
  const tag = `${String(n.run_id).slice(0, 8)} ${n.node_id}`;
  if (p.status === "succeeded") {
    const src = Array.isArray(p.output) ? p.output[0] : p.output;
    if (!src) throw new Error(`${tag}: output 없음`);
    if (DRY) {
      console.log(`${tag} succeeded → 저장 예정`);
      continue;
    }
    const out = await persist(src, n.id, n.node_type);
    const doneAt = new Date(p.completed_at ?? Date.now());
    await sql`update node_runs set status='completed', outputs=${JSON.stringify(out)}, completed_at=${doneAt} where id=${n.id}`;
    console.log(`${tag} ✓ ${out.url}`);
  } else if (p.status === "failed" || p.status === "canceled") {
    if (DRY) {
      console.log(`${tag} ${p.status} → 실패 처리 예정`);
      continue;
    }
    const doneAt = new Date(p.completed_at ?? Date.now());
    await sql`update node_runs set status='failed', error=${p.error ?? p.status}, completed_at=${doneAt} where id=${n.id}`;
    await sql`update workflow_runs set status='failed', error=${`노드 ${n.node_id} 생성 실패: ${p.error ?? p.status}`}, completed_at=${doneAt} where id=${n.run_id}`;
    console.log(`${tag} ✗ ${p.status}`);
  } else {
    console.log(`${tag} ${p.status} — 대기`);
  }
}

// 남은 노드가 없는 running run을 마감한다
if (!DRY) {
  const runs = await sql`select id from workflow_runs where status = 'running'`;
  for (const r of runs) {
    const nodes = await sql`select node_id, status, outputs, completed_at from node_runs where run_id = ${r.id} order by completed_at`;
    if (nodes.some((x) => x.status !== "completed")) continue;
    const outputs = nodes.map((x) => ({ nodeId: x.node_id, outputs: JSON.parse(x.outputs) }));
    const last = new Date(Math.max(...nodes.map((x) => new Date(x.completed_at).getTime())));
    await sql`update workflow_runs set status='completed', outputs=${JSON.stringify(outputs)}, completed_at=${last} where id=${r.id}`;
    console.log(`run ${String(r.id).slice(0, 8)} completed`);
  }
}
await sql.end();
