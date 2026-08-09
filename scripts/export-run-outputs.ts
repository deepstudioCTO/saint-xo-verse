/**
 * 완료된 실행의 산출물(영상·이미지)을 조합 정보가 담긴 파일명으로 내려받는다.
 *
 * 보고서 증빙·운영비 중간결과물 폴더 구성을 위해, 실행 기록만이 아니라 실물 파일을
 * 사람이 알아볼 수 있는 이름으로 손에 쥐어야 한다. 파일명에 멤버·룩·모션·트랙을 넣어
 * "어떤 조합의 결과인지"가 파일 이름만으로 드러나게 한다.
 *
 * 실행:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/export-run-outputs.ts <출력디렉토리>
 */
import postgres from "postgres";
import fs from "fs";
import path from "path";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const OUT = process.argv[2];
if (!OUT) throw new Error("출력 디렉토리를 인자로 주세요");

/** 트랙 id → 제목 (app/data/tracks.ts와 동일) */
const TRACKS: Record<string, string> = {
  "1": "Yum", "2": "POP IT", "3": "Im lovin it", "4": "ALL EYES ON ME",
  "5": "BRING IT UP", "6": "BURIED ALIVE", "7": "DONT LIE TO ME", "8": "EXTRA",
  "9": "F4U", "10": "LOVE INVASION", "11": "PRETTY POSER", "12": "SEOUL NODE",
  "13": "BLACK", "14": "MOON RUNNER",
};

const sql = postgres(databaseUrl, { prepare: false });

/** 파일명에 못 쓰는 문자를 정리 */
const safe = (s: string) => s.replace(/[^\w가-힣.-]+/g, "_").replace(/^_+|_+$/g, "");

interface GraphNode {
  type?: string;
  data?: Record<string, any>;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  // run 상태로 거르지 않는다 — 실패한 run도 앞 단계 노드는 성공했을 수 있고,
  // 그 산출물은 실제로 존재하는 파일이다. 판단 기준은 run이 아니라 node_run의 완료 여부다.
  const runs = await sql<{ id: string; snapshot: string; started_at: Date }[]>`
    select id, template_snapshot as snapshot, started_at
    from workflow_runs order by started_at`;

  console.log(`완료된 실행 ${runs.length}건`);
  let idx = 0;

  for (const run of runs) {
    idx++;
    let member = "unknown", look = "unknown", motion = "unknown", track = "notrack";
    try {
      const nodes = (JSON.parse(run.snapshot).nodes ?? []) as GraphNode[];
      const lookNode = nodes.find((n) => n.type === "look");
      if (lookNode?.data) {
        member = lookNode.data.media?.name ?? lookNode.data.characterId ?? "unknown";
        look = lookNode.data.lookId ?? "unknown";
      }
      const motionNode = nodes.find(
        (n) => n.type === "source" && n.data?.media?.type === "video"
      );
      if (motionNode?.data?.media?.name) motion = motionNode.data.media.name;
      const musicNode = nodes.find((n) => n.type === "music");
      const tid = musicNode?.data?.trackId;
      if (tid) track = TRACKS[String(tid)] ?? String(tid);
    } catch {
      /* 스냅샷 파싱 실패는 파일명만 unknown으로 두고 계속 */
    }

    const stem = `${String(idx).padStart(2, "0")}_${safe(member)}_${safe(look)}_${safe(motion)}_${safe(track)}`;

    const outs = await sql<{ node_type: string; outputs: string }[]>`
      select node_type, outputs from node_runs
      where run_id = ${run.id} and status = 'completed' and outputs is not null
      order by started_at`;

    for (const o of outs) {
      const { url, type } = JSON.parse(o.outputs) as { url: string; type: string };
      const ext = type === "video" ? "mp4" : "jpg";
      // 같은 run에 이미지·영상이 함께 나오므로 종류를 파일명에 남긴다
      const suffix = o.node_type === "upscale" ? "_upscaled" : type === "image" ? "_frame" : "";
      const file = path.join(OUT, `${stem}${suffix}.${ext}`);

      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`  ✗ ${path.basename(file)} — HTTP ${res.status}`);
        continue;
      }
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      console.log(`  ✓ ${path.basename(file)}`);
    }
  }

  await sql.end();
  console.log(`\n저장 위치: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
