/**
 * "룩 스왑" 워크플로우 템플릿 시드 (템플릿 6종째)
 *
 * 그래프:
 *   Look(멤버)  ─┐
 *                ├→ 이미지생성(gpt-image-2, 레퍼런스 2장) → Preview
 *   Source(컨셉) ┘
 *
 * 왜 필요한가(큐레이션 기준 ①실수요):
 *   확정된 컨셉 컷 한 장을 멤버 전원 버전으로 다시 뽑는 작업이 콘텐츠팀의 실제 반복 업무다.
 *   지금까지는 컨셉포토/Y2K/피규어처럼 **단일 입력 + 프롬프트**뿐이라, 스타일링을 유지한 채
 *   인물만 바꾸는 요청을 그래프로 표현할 수 없었다. "모션 컨트롤"이 영상 트랙에서 하는
 *   멤버 교체를 이미지 트랙으로 옮긴 것이 이 템플릿이다.
 *
 * ②단일 입력 재현 가능: 입력은 (멤버 룩, 컨셉 레퍼런스) 두 슬롯뿐 — 같은 쌍을 넣으면 같은 결과 계열.
 * ③IP 아이덴티티 유지: 프롬프트가 레퍼런스별 역할을 위치로 못박는다(1=인물, 마지막=스타일/프레이밍).
 *
 * 모델은 gpt-image-2를 **명시**한다. 팔레트 기본값 soul-reference는 refImages.max=1이라
 * 두 번째 레퍼런스가 조용히 버려진다(시드는 노드 UI 경고를 거치지 않는다).
 *
 * 순서 계약: 두 소스 모두 rank 0이므로 images 순서는 y좌표가 정한다.
 * Look(y=40)이 위, 컨셉 Source(y=620)가 아래 → images[0]=멤버, 마지막=컨셉. 프롬프트 문구와 일치.
 *
 * 실행(멱등 — 같은 이름이 있으면 갱신):
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/seed-look-swap-template.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { workflowTemplates } from "../drizzle/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const NAME = "룩 스왑";

const SWAP_PROMPT =
  "You are given 2 reference images with different roles. " +
  "Reference 1 is the SUBJECT: reproduce her face, hairstyle and makeup exactly — this is the only person in the output. " +
  "The LAST reference is a STYLING AND FRAMING GUIDE ONLY: copy its outfit, hair styling direction, lighting, background, color grade, camera shot size and crop. " +
  "Do NOT take the last reference's face or facial identity. " +
  "Output: the subject of reference 1 wearing and lit like the last reference. Editorial photo, sharp focus, natural skin texture.";

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

async function seed() {
  const nodes = JSON.stringify([
    {
      // 멤버 교체 지점. media:null = 실행 시 채우는 주입 슬롯
      id: "look-member",
      type: "look",
      position: { x: 40, y: 40 },
      data: { label: "멤버", lookId: null, characterId: null, media: null },
    },
    {
      // 컨셉 레퍼런스 슬롯 — Look 노드(~490px)와 겹치지 않게 y를 넉넉히 띄운다
      id: "source-concept",
      type: "source",
      position: { x: 40, y: 620 },
      data: { label: "컨셉 레퍼런스", media: null, sourceType: "concept-image" },
    },
    {
      id: "gen-image",
      type: "generate-image",
      position: { x: 420, y: 300 },
      data: {
        label: "이미지 생성",
        generateType: "generate-image",
        model: "gpt-image-2", // 다중 레퍼런스 + 지시 준수. 기본값(soul)은 2장째를 버린다
        prompt: SWAP_PROMPT,
        resolution: "high",
        aspectRatio: "2:3",
      },
    },
    {
      id: "preview",
      type: "preview",
      position: { x: 800, y: 300 },
      data: { label: "Preview" },
    },
  ]);

  const edges = JSON.stringify([
    { id: "e-look-gen", source: "look-member", target: "gen-image" },
    { id: "e-concept-gen", source: "source-concept", target: "gen-image" },
    { id: "e-gen-preview", source: "gen-image", target: "preview" },
  ]);

  const [existing] = await db
    .select()
    .from(workflowTemplates)
    .where(eq(workflowTemplates.name, NAME))
    .limit(1);

  if (existing) {
    await db
      .update(workflowTemplates)
      .set({
        nodes,
        edges,
        category: "image",
        description: "확정 컨셉 컷의 스타일링을 유지한 채 멤버만 교체",
        isPublished: true,
        currentVersion: existing.currentVersion + 1,
      })
      .where(eq(workflowTemplates.id, existing.id));
    console.log(`✓ 갱신: ${NAME} (${existing.id}, v${existing.currentVersion + 1})`);
  } else {
    const [created] = await db
      .insert(workflowTemplates)
      .values({
        name: NAME,
        description: "확정 컨셉 컷의 스타일링을 유지한 채 멤버만 교체",
        category: "image",
        nodes,
        edges,
        viewport: '{"x":0,"y":0,"zoom":0.7}',
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
