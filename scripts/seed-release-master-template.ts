/**
 * "릴리스 마스터" 워크플로우 템플릿 시드 (템플릿 7종째)
 *
 * 그래프:
 *   Source(완성 영상) → 업스케일(topaz 4K) → 음악합성 → 자막 → Preview
 *
 * 왜 필요한가(큐레이션 기준 ①실수요):
 *   생성이 끝난 컷을 업로드용 마스터로 만드는 **후처리**는 지금까지 그래프가 없었다.
 *   "모션 컨트롤"은 대량 생성용이라 업스케일이 기본 OFF고(느리고 비싸다), 켜면 생성부터
 *   다시 돌게 된다. 채택된 컷만 골라 마스터링하는 경로를 따로 두면
 *   재생성 없이 고해상 버전을 뽑을 수 있다 — 채택 플래그(P2-1b)와 짝이 되는 워크플로우다.
 *
 * ②단일 입력 재현 가능: 입력은 영상 1개 슬롯. 나머지는 전부 노드 파라미터라 결정적이다.
 * ③IP 아이덴티티 유지: 생성 노드가 없다 — 인물을 새로 그리지 않으므로 원본과 동일함이 보장된다.
 *
 * 실행 대상 노드는 upscale 하나다. resolveUpstreamInputs가 producedVideo(없음) → sourceVideo로
 * 폴백하므로 Source 영상이 그대로 업스케일 입력이 된다.
 * 음악합성·자막은 클라이언트(ffmpeg.wasm) 단계라 서버 파이프라인은 건너뛴다 — 에디터에서 마무리한다.
 *
 * 실행(멱등 — 같은 이름이 있으면 갱신):
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/seed-release-master-template.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { workflowTemplates } from "../drizzle/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const NAME = "릴리스 마스터";

// 검증 실행에서 마스터링한 컷(22번 Lei/Above)의 첫 프레임. 썸네일이 없으면 W패널이
// 빈 회색 카드가 되고 흰색 이름 라벨도 안 보인다.
const THUMBNAIL =
  "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public/motion-videos/generated-images/ac51170e-4f8c-4c90-b683-fbc35c1ba56d.jpg";

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

async function seed() {
  const nodes = JSON.stringify([
    {
      // 마스터링할 완성 영상 슬롯 — Library(완료 run 산출물)에서 고른다
      id: "source-cut",
      type: "source",
      position: { x: 40, y: 40 },
      data: { label: "완성 컷", media: null, sourceType: "motion-video" },
    },
    {
      // 이 템플릿의 유일한 실행 노드. 여기서는 켜져 있는 것이 정본이다
      // ("모션 컨트롤"은 반대로 기본 OFF — 두 템플릿의 존재 이유가 이 한 줄에서 갈린다)
      id: "upscale",
      type: "upscale",
      position: { x: 420, y: 40 },
      data: { label: "업스케일", model: "topaz", resolution: "4K" },
    },
    {
      id: "music",
      type: "music",
      position: { x: 800, y: 40 },
      data: { label: "음악 합성", trackId: null },
    },
    {
      id: "subtitle",
      type: "subtitle",
      position: { x: 1180, y: 40 },
      data: { label: "자막", entries: [] },
    },
    {
      id: "preview",
      type: "preview",
      position: { x: 1560, y: 40 },
      data: { label: "Preview" },
    },
  ]);

  const edges = JSON.stringify([
    { id: "e-cut-upscale", source: "source-cut", target: "upscale" },
    { id: "e-upscale-music", source: "upscale", target: "music" },
    { id: "e-music-subtitle", source: "music", target: "subtitle" },
    { id: "e-subtitle-preview", source: "subtitle", target: "preview" },
  ]);

  const [existing] = await db
    .select()
    .from(workflowTemplates)
    .where(eq(workflowTemplates.name, NAME))
    .limit(1);

  const meta = {
    description: "채택된 컷을 재생성 없이 4K 마스터로 후처리",
    category: "video" as const,
    thumbnailUrl: THUMBNAIL,
  };

  if (existing) {
    await db
      .update(workflowTemplates)
      .set({ nodes, edges, ...meta, isPublished: true, currentVersion: existing.currentVersion + 1 })
      .where(eq(workflowTemplates.id, existing.id));
    console.log(`✓ 갱신: ${NAME} (${existing.id}, v${existing.currentVersion + 1})`);
  } else {
    const [created] = await db
      .insert(workflowTemplates)
      .values({
        name: NAME,
        ...meta,
        nodes,
        edges,
        viewport: '{"x":0,"y":0,"zoom":0.6}',
        isPublished: true,
      })
      .returning();
    console.log(`✓ 생성: ${NAME} (${created.id})`);
  }

  await client.end();
}

seed().catch((err) => {
  console.error("시드 실패:", err);
  process.exit(1);
});
