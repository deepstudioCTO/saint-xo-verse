/**
 * "굿즈 PPL" 워크플로우 템플릿 시드 (템플릿 8종째) — v2: 이미지→영상(i2v)
 *
 * 그래프:
 *   Look(멤버) ──────┐
 *   Source(제품 사진) ┴→ 이미지생성(nano-banana) → 영상생성(kling-v3 i2v 5초) → [업스케일 OFF]
 *                                                 → 음악합성 → 자막 → Preview
 *
 * 왜 필요한가(큐레이션 기준 ①실수요):
 *   브랜드 광고(Quest 2) 확정 72건의 실제 제작물은 전부 실사 촬영이었다. 제품을 멤버가 들고/착용한
 *   숏폼은 반복 수요가 가장 큰 포맷인데, 기존 7종에는 "제품"이라는 입력 슬롯이 없었다.
 *
 * v1 → v2 (2026-10-13):
 *   v1은 모션 컨트롤(스틸 + 남의 댄스 영상 동작 전이)이었다. 스틸까지는 멀쩡했지만 영상 단계에서
 *   원본 댄서의 몸 동작을 덮어씌우느라 얼굴이 바뀌고, 손이 추가로 솟아나고, 제품이 사라졌다
 *   (검수에서 전량 불합격). 영상 모델 6종 비교 테스트 결과 시작 프레임 고정형 i2v(kling-v3)만
 *   얼굴·손·제품 문양을 끝까지 유지했다. 그래서 모션 영상·첫 프레임 노드를 걷어내고
 *   스틸을 첫 프레임으로 5초간 "제품을 보여주는" 동작만 생성한다.
 *   부수 효과: 원본 영상 오디오 혼입 제거, 생성 시간 ~5분 → ~2분.
 *
 * ②단일 입력 재현 가능: 입력 슬롯은 (멤버 룩, 제품 사진) 두 개뿐.
 * ③IP 아이덴티티 유지: 레퍼런스 역할을 위치로 못박는다(1=인물, 2=제품).
 *
 * 제품 사진은 자사 IP 굿즈로 실증한다. 외부 브랜드 상세컷은 실제 모델 얼굴이 함께 찍혀 있어
 * 레퍼런스로 넣으면 초상권 문제가 생긴다(KOCCA 협약종료 전 유의사항 4-②).
 *
 * 자막 노드는 비워 둔다 — AI 생성 고지 자막은 쓰지 않기로 했다(2026-10-13).
 *
 * 순서 계약: Look(y=40)·제품 Source(y=330) 모두 rank 0이라 y순 → images = [멤버, 제품].
 *
 * 실행(멱등 — 같은 이름이 있으면 갱신):
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/seed-goods-ppl-template.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { workflowTemplates } from "../drizzle/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const BASE = "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public";
const PRODUCT_IMAGE = `${BASE}/motion-videos/concept-images/goods-slime-ball.jpg`;

const NAME = "굿즈 PPL";
const DESCRIPTION = "멤버 × 제품 교체로 제품 노출 숏폼(PPL)을 만드는 파이프라인 (이미지→영상)";

const PPL_PROMPT =
  "You are given 2 reference images with different roles. " +
  "Reference 1 is the SUBJECT: reproduce her face, hairstyle, makeup and her exact outfit. " +
  "Reference 2 is the PRODUCT: she is holding it naturally in one hand at chest height, clearly visible to the camera, " +
  "keeping the product's exact shape, colors, materials and any logo or printed text unchanged and undistorted. " +
  "Do NOT take any person, face or background from reference 2. " +
  "Output: a vertical upper-body shot of the subject of reference 1, in reference 1's outfit, facing the camera, " +
  "holding the product of reference 2 with one hand, both hands natural with five fingers. " +
  "Clean bright studio background. Bright commercial product shot, sharp focus on the product.";

// 리서치 테스트 A(kling-v3 std, 수민 × 슬라임볼)에서 쓴 동작 프롬프트를 제품 일반형으로 옮긴 것.
// 제품별로 묘사를 바꾸고 싶으면 배치 플랜의 videoPrompt로 덮어쓴다.
const VIDEO_PROMPT =
  "She slowly turns the product in her hand toward the camera to show it off, " +
  "then gives a small natural smile and a slight head tilt, blinking naturally. " +
  "The product stays in the same hand the entire time with the same shape, colors and printed details. " +
  "Same face, same outfit. Static camera, very slow push-in, clean bright studio background.";

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

async function seed() {
  const nodes = JSON.stringify([
    {
      id: "look-member",
      type: "look",
      position: { x: 40, y: 40 },
      data: { label: "멤버", lookId: null, characterId: null, media: null },
    },
    {
      // 제품 슬롯 — media를 채워 둔다. media:null이면 injectTemplateInputs가 캐릭터 이미지로 덮는다
      id: "source-product",
      type: "source",
      position: { x: 40, y: 330 },
      data: {
        label: "제품 사진",
        media: { type: "image", url: PRODUCT_IMAGE, name: "goods-slime-ball" },
        sourceType: "concept-image",
      },
    },
    {
      id: "gen-image",
      type: "generate-image",
      position: { x: 640, y: 40 },
      data: {
        label: "이미지 생성",
        generateType: "generate-image",
        // 모션 컨트롤과 같은 이유로 nano-banana — 다중 레퍼런스 + 실존 인물 재현 시 필터 실패가 적다
        model: "nano-banana",
        prompt: PPL_PROMPT,
        resolution: "2K",
        aspectRatio: "2:3",
      },
    },
    {
      id: "gen-video",
      type: "generate",
      position: { x: 980, y: 340 },
      data: {
        label: "영상 생성",
        generateType: "generate",
        // 모션 컨트롤 대신 시작 프레임 고정 i2v — 모션 영상 입력이 필요 없다
        videoModel: "kling-v3-i2v",
        duration: 5,
        mode: "standard",
        prompt: VIDEO_PROMPT,
      },
    },
    {
      id: "upscale",
      type: "upscale",
      position: { x: 1300, y: 340 },
      data: { label: "업스케일", model: "topaz", resolution: "2K", disabled: true },
    },
    {
      id: "music",
      type: "music",
      position: { x: 1620, y: 340 },
      data: { label: "음악 합성", trackId: null },
    },
    {
      id: "subtitle",
      type: "subtitle",
      position: { x: 1940, y: 320 },
      data: { label: "자막", entries: [] },
    },
    {
      id: "preview",
      type: "preview",
      position: { x: 2260, y: 320 },
      data: { label: "Preview" },
    },
  ]);

  const style = { stroke: "#444", strokeWidth: 1.5 };
  const edges = JSON.stringify([
    { id: "e-look-genimage", source: "look-member", target: "gen-image", type: "default", style },
    { id: "e-product-genimage", source: "source-product", target: "gen-image", type: "default", style },
    { id: "e-genimage-genvideo", source: "gen-image", target: "gen-video", type: "default", style },
    { id: "e-genvideo-upscale", source: "gen-video", target: "upscale", type: "default", style },
    { id: "e-upscale-music", source: "upscale", target: "music", type: "default", style },
    { id: "e-music-subtitle", source: "music", target: "subtitle", type: "default", style },
    { id: "e-subtitle-preview", source: "subtitle", target: "preview", type: "default", style },
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
        category: "video",
        description: DESCRIPTION,
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
        description: DESCRIPTION,
        category: "video",
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
  console.error("Seed failed:", err);
  process.exit(1);
});
