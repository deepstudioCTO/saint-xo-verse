/**
 * 다중 생성 모드 — 동일 그래프 + 모듈 교체 배치 실행 CLI.
 *
 * 조합 UX(Look·Music·Skill 노드)는 8/7에 화면으로 완성됐지만, 변주를 **한 번에 여러 건**
 * 돌리는 진입점이 없어서 실사용이 화면 클릭 1건씩으로 남아 있었다.
 * 이 스크립트는 템플릿 하나를 고정하고 (멤버 룩 × 모션 스킬 × 음악 트랙) 조합만 교체해
 * 배치로 던진다 — 재사용률·소요시간 지표가 성립하는 유일한 실행 형태다.
 *
 * 실행 경로는 화면과 완전히 같다: POST /api/workflow-execute → Cloudflare Workflow.
 * (DB에 직접 run을 꽂지 않는다 — 그러면 파이프라인을 안 거친 가짜 실적이 된다)
 *
 * 사용:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/batch-variation-run.ts --plan combos.json
 *   ... --plan combos.json --dry-run     # 조합·비용만 출력, 제출 안 함
 *   ... --watch                          # 제출 후 완료까지 폴링
 *
 * combos.json:
 *   {
 *     "template": "모션 컨트롤",
 *     "combos": [
 *       { "label": "17", "characterId": "haeun", "lookId": "02_01", "motion": "Dance", "trackId": "2" }
 *     ]
 *   }
 *
 * 환경변수: BASE_URL(기본 http://localhost:5173), HITOS_EMAIL, HITOS_PASSWORD
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import fs from "fs";
import { workflowRuns } from "../drizzle/schema";
import type { GraphEdgeLike, GraphNodeLike } from "../app/lib/workflow/types";

interface Combo {
  label?: string;
  characterId: string;
  lookId: string;
  /** /api/editor-media?type=motion-videos 의 name — 모션(스킬) 소스. 영상 트랙 템플릿용 */
  motion?: string;
  /**
   * 이미지 소스 노드(sourceType != motion-video)에 넣을 레퍼런스.
   * 절대 URL 또는 `persona:<lookId>/<characterId>` 단축형.
   */
  sourceImage?: string;
  /** 영상 소스 노드에 넣을 완성 컷 URL (릴리스 마스터처럼 생성 없이 후처리하는 템플릿용) */
  sourceVideo?: string;
  /** app/data/tracks.ts의 TRACKS id. Music 노드는 클라 합성이라 여기선 메타데이터로만 기록 */
  trackId?: string;
  /** 이미지 생성 프롬프트 덮어쓰기(선택) */
  prompt?: string;
}

/** 1회 실행 비용 추정 — Replicate 실측 단가 기준. 실행 전 반드시 눈으로 확인하라고 찍는다 */
const COST_USD = {
  imageNanoBanana2K: 0.14,
  videoKlingProPerSec: 0.098,
  upscaleTopaz: 0.3,
};

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const value = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";
const EMAIL = process.env.HITOS_EMAIL ?? "cto@deepstudio.io";
const PASSWORD = process.env.HITOS_PASSWORD ?? "test1234";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

/** 화면과 같은 로그인 경로로 세션 쿠키를 얻는다 (API 라우트는 전부 requireAuthApi) */
async function login(): Promise<string> {
  const res = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email: EMAIL, password: PASSWORD, redirectTo: "/" }),
    redirect: "manual",
  });
  const raw = res.headers.getSetCookie?.() ?? [];
  const cookie = raw.map((c) => c.split(";")[0]).join("; ");
  if (!cookie) throw new Error(`로그인 실패 (status ${res.status}) — BASE_URL/계정을 확인하세요`);
  return cookie;
}

/**
 * 템플릿 그래프에 조합을 주입한다. 순수 — 원본 노드를 변형하지 않는다.
 * look 노드 = 멤버 교체 지점, source 노드(sourceType=motion-video) = 스킬 교체 지점.
 */
function injectCombo(
  nodes: GraphNodeLike[],
  combo: Combo,
  personaImageUrl: string,
  motion: { name: string; url: string; thumbnailUrl: string | null } | null,
  sourceImageUrl: string | null
): GraphNodeLike[] {
  return nodes.map((n) => {
    if (n.type === "look") {
      return {
        ...n,
        data: {
          ...n.data,
          characterId: combo.characterId,
          lookId: combo.lookId,
          media: { type: "image", url: personaImageUrl, name: combo.characterId },
        },
      };
    }
    if (n.type === "source" && n.data?.sourceType === "motion-video") {
      // 모션 소스 슬롯: 스킬(모션 영상) 또는 후처리할 완성 컷
      if (motion) {
        return {
          ...n,
          data: {
            ...n.data,
            media: {
              type: "video",
              url: motion.url,
              thumbnailUrl: motion.thumbnailUrl,
              name: motion.name,
            },
          },
        };
      }
      if (combo.sourceVideo) {
        return {
          ...n,
          data: { ...n.data, media: { type: "video", url: combo.sourceVideo, name: "cut" } },
        };
      }
      return n;
    }
    if (n.type === "source" && sourceImageUrl) {
      // 이미지 레퍼런스 슬롯(컨셉 컷 등)
      return {
        ...n,
        data: { ...n.data, media: { type: "image", url: sourceImageUrl, name: "reference" } },
      };
    }
    if (n.type === "music" && combo.trackId) {
      return { ...n, data: { ...n.data, trackId: combo.trackId } };
    }
    if (n.type === "generate-image" && combo.prompt) {
      return { ...n, data: { ...n.data, prompt: combo.prompt } };
    }
    return n;
  });
}

/** 미디어 URL 해소는 전부 화면과 같은 API를 통한다 — storage_path는 상대경로라 직접 쓰면 422 */
async function getJson<T>(path: string, cookie: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { Cookie: cookie } });
  if (!res.ok) throw new Error(`GET ${path} 실패 (${res.status})`);
  return (await res.json()) as T;
}

function estimateCost(nodes: GraphNodeLike[], motionDurationSec: number): number {
  let usd = 0;
  for (const n of nodes) {
    if (n.data?.disabled === true) continue;
    if (n.type === "generate-image") usd += COST_USD.imageNanoBanana2K;
    // kling character_orientation:"image"는 영상 10초 상한 — 모션 길이로 클램프
    if (n.type === "generate") usd += COST_USD.videoKlingProPerSec * Math.min(motionDurationSec, 10);
    if (n.type === "upscale") usd += COST_USD.upscaleTopaz;
  }
  return usd;
}

async function main() {
  const planPath = value("plan");
  if (!planPath) throw new Error("--plan <combos.json> 필요");
  const plan = JSON.parse(fs.readFileSync(planPath, "utf8")) as {
    template: string;
    combos: Combo[];
  };

  const client = postgres(requireEnv("DATABASE_URL"), { prepare: false });
  const db = drizzle(client);

  const cookie = await login();

  const list = await getJson<{ templates: { id: string; name: string }[] }>(
    "/api/workflow-templates",
    cookie
  );
  const meta = list.templates.find((t) => t.name === plan.template);
  if (!meta) throw new Error(`템플릿 없음: ${plan.template}`);

  const { template } = await getJson<{
    template: { id: string; name: string; nodes: string; edges: string };
  }>(`/api/workflow-templates?id=${meta.id}`, cookie);

  const baseNodes = JSON.parse(template.nodes) as GraphNodeLike[];
  const edges = JSON.parse(template.edges) as GraphEdgeLike[];

  const { personas: allPersonas } = await getJson<{
    personas: { lookId: string; characterId: string; name: string; imageUrl: string }[];
  }>("/api/personas", cookie);

  const { items: allMotions } = await getJson<{
    items: { name: string; url: string; thumbnailUrl: string | null; duration?: number }[];
  }>("/api/editor-media?type=motion-videos", cookie);

  // ── 조합 해소 + 비용 추정 ─────────────────────────────────
  const jobs: { combo: Combo; nodes: GraphNodeLike[]; costUsd: number }[] = [];
  for (const combo of plan.combos) {
    const persona = allPersonas.find(
      (p) => p.lookId === combo.lookId && p.characterId === combo.characterId
    );
    if (!persona) throw new Error(`페르소나 없음: ${combo.lookId}/${combo.characterId}`);

    let motion: (typeof allMotions)[number] | null = null;
    if (combo.motion) {
      motion = allMotions.find((m) => m.name === combo.motion) ?? null;
      if (!motion) throw new Error(`모션 없음: ${combo.motion}`);
    }

    // persona: 단축형은 카탈로그에서 해소한다 — 스크립트가 URL을 조립하면 상대경로 사고가 재발한다
    let sourceImageUrl: string | null = null;
    if (combo.sourceImage?.startsWith("persona:")) {
      const [lookId, characterId] = combo.sourceImage.slice("persona:".length).split("/");
      const ref = allPersonas.find((p) => p.lookId === lookId && p.characterId === characterId);
      if (!ref) throw new Error(`레퍼런스 페르소나 없음: ${combo.sourceImage}`);
      sourceImageUrl = ref.imageUrl;
    } else if (combo.sourceImage) {
      sourceImageUrl = combo.sourceImage;
    }

    const nodes = injectCombo(baseNodes, combo, persona.imageUrl, motion, sourceImageUrl);
    jobs.push({ combo, nodes, costUsd: estimateCost(nodes, motion?.duration ?? 10) });
  }

  const total = jobs.reduce((s, j) => s + j.costUsd, 0);
  console.log(`템플릿: ${template.name} (${template.id})`);
  console.log(`조합 ${jobs.length}건 — 예상 비용 합계 US$${total.toFixed(2)}\n`);
  for (const j of jobs) {
    console.log(
      `  ${(j.combo.label ?? "").padStart(3)}  ${j.combo.characterId.padEnd(7)} ${j.combo.lookId}  ` +
        `${(j.combo.motion ?? j.combo.sourceImage ?? j.combo.sourceVideo ?? "-").slice(0, 40).padEnd(14)} ` +
        `track=${j.combo.trackId ?? "-"}  ≈$${j.costUsd.toFixed(2)}`
    );
  }

  if (flag("dry-run")) {
    console.log("\n--dry-run: 제출하지 않았습니다");
    await client.end();
    return;
  }

  // ── 제출 (화면과 동일한 경로) ─────────────────────────────
  const submitted: { label: string; runId: string }[] = [];

  for (const j of jobs) {
    const res = await fetch(`${BASE_URL}/api/workflow-execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        graph: { nodes: j.nodes, edges },
        templateId: template.id,
        inputs: {
          characterId: j.combo.characterId,
          lookId: j.combo.lookId,
          lookbookId: j.combo.lookId.split("_")[0],
          musicId: j.combo.trackId,
          thumbnailUrl: (j.nodes.find((n) => n.type === "look")?.data?.media as { url?: string })
            ?.url,
          source: "editor",
        },
      }),
    });
    const body = (await res.json()) as { runId?: string; error?: string };
    if (!res.ok || !body.runId) {
      console.error(`✗ ${j.combo.label ?? j.combo.characterId}: ${body.error ?? res.status}`);
      continue;
    }
    submitted.push({ label: j.combo.label ?? j.combo.characterId, runId: body.runId });
    console.log(`✓ 제출 ${j.combo.label ?? j.combo.characterId} → run ${body.runId}`);
  }

  fs.writeFileSync(
    planPath.replace(/\.json$/, "") + ".runs.json",
    JSON.stringify(submitted, null, 2)
  );

  if (flag("watch") && submitted.length > 0) {
    console.log("\n완료 대기 중...");
    const ids = submitted.map((s) => s.runId);
    for (;;) {
      await new Promise((r) => setTimeout(r, 15000));
      const rows = await db.select().from(workflowRuns);
      const mine = rows.filter((r) => ids.includes(r.id));
      const done = mine.filter((r) => r.status === "completed" || r.status === "failed");
      console.log(
        `  ${done.length}/${ids.length} 종료 — ` +
          mine.map((r) => `${r.status[0]}`).join("")
      );
      if (done.length === ids.length) {
        for (const r of mine) console.log(`  ${r.id} ${r.status} ${r.error ?? ""}`);
        break;
      }
    }
  }

  await client.end();
}

main().catch((err) => {
  console.error("배치 실행 실패:", err);
  process.exit(1);
});
