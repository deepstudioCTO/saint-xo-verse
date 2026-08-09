/**
 * "멀티스텝 생성 파이프라인" 워크플로우 템플릿 시드 (표8 노드에디터 캡처용)
 *
 * 그래프:
 *   Source(멤버이미지) ─────────────┐
 *                                  ├→ 이미지생성 → 영상생성 → 업스케일 → 자막 → Preview
 *   Source(모션영상) → 첫프레임 ────┘         ↑
 *          └────────────────────────────────┘
 *
 * 모션 영상이 두 경로로 쓰이는 것이 그래프에 그대로 드러난다:
 * 포즈 참조(첫프레임 경유, 이미지생성으로)와 모션 소스(직결, 영상생성으로).
 * kling motion-control은 입력 이미지에서 출발해 모션을 따라가므로, 생성 이미지의 포즈가
 * 모션 첫 프레임과 어긋나면 영상 초반이 튄다.
 *
 * 실행:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/seed-multistep-pipeline-template.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { workflowTemplates } from "../drizzle/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const BASE = "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public";
const MEMBER_IMAGE = `${BASE}/characters/posters/00_rumi.png`;
// 모션 영상 "700k" — thumbnail_path가 곧 첫 프레임 JPG다(업로드 시 생성). frame 노드가 이걸 읽는다.
const MOTION_VIDEO = `${BASE}/motion-videos/videos/1769731717953-04.mp4`;
const MOTION_THUMBNAIL = `${BASE}/motion-videos/thumbnails/1769731718385-04.jpg`;

/**
 * 포즈 정합 문구는 코드가 자동 주입하지 않는다 — 템플릿 프롬프트에 직접 써 둔다.
 * 코드는 "이미지를 하나 더 흘려보낸다"까지만 하고, 의미 부여는 그래프와 프롬프트가 한다.
 * "last reference image" = frame 노드가 넣는 모션 첫 프레임. 이 순서는 캔버스 배치가 아니라
 * resolveUpstreamInputs의 rank 규칙(frame은 항상 마지막)이 보장한다.
 */
const POSE_PROMPT =
  "You are given 2 reference images with different roles. " +
  "Reference 1 is the SUBJECT: reproduce her face, hairstyle, makeup and her exact outfit. " +
  "The LAST reference is a POSE AND FRAMING GUIDE ONLY: copy only its camera shot size, crop, head angle and body pose. " +
  "Do NOT take the last reference's person, face, hairstyle, clothing, hat, accessories, background, text, captions or stickers. " +
  "Output: the subject of reference 1, in reference 1's outfit, posed and framed exactly like the last reference. Cinematic editorial photo.";

const NAME = "멀티스텝 생성 파이프라인";

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

async function seed() {
  const nodes = JSON.stringify([
    {
      id: "source-member",
      type: "source",
      position: { x: 40, y: 60 },
      data: {
        label: "멤버 이미지",
        media: { type: "image", url: MEMBER_IMAGE, name: "rumi" },
        sourceType: "character-image",
      },
    },
    {
      id: "source-motion",
      type: "source",
      position: { x: 40, y: 380 },
      data: {
        label: "모션 영상",
        media: { type: "video", url: MOTION_VIDEO, thumbnailUrl: MOTION_THUMBNAIL, name: "motion" },
        sourceType: "motion-video",
      },
    },
    {
      // 비실행 노드 — 업스트림 영상의 첫 프레임을 이미지로 흘려보낸다(포즈 참조).
      // 배치는 가독성용일 뿐 순서와 무관하다: images 순서는 rank로 고정된다.
      id: "frame-pose",
      type: "frame",
      position: { x: 330, y: 420 },
      data: { label: "첫 프레임" },
    },
    {
      id: "gen-image",
      type: "generate-image",
      position: { x: 640, y: 40 },
      data: {
        label: "이미지 생성",
        generateType: "generate-image",
        // 모델 명시 필수: 팔레트 기본값(soul-reference)은 레퍼런스 1장만 받아 포즈 참조가 버려진다
        model: "gpt-image-2",
        prompt: POSE_PROMPT,
        resolution: "high",
        aspectRatio: "2:3",
      },
    },
    {
      id: "gen-video",
      type: "generate",
      position: { x: 980, y: 220 },
      data: {
        label: "영상 생성",
        generateType: "generate",
        prompt: "soft indoor lighting, pastel background, fixed camera, smooth motion, no zoom, no camera shake",
      },
    },
    {
      id: "upscale",
      type: "upscale",
      position: { x: 1280, y: 220 },
      data: { label: "업스케일", model: "topaz", resolution: "2K" },
    },
    {
      id: "subtitle",
      type: "subtitle",
      position: { x: 1560, y: 200 },
      data: { label: "자막", entries: [] },
    },
    {
      id: "preview",
      type: "preview",
      position: { x: 1920, y: 200 },
      data: { label: "Preview" },
    },
  ]);

  const style = { stroke: "#444", strokeWidth: 1.5 };
  const edges = JSON.stringify([
    { id: "e1", source: "source-member", target: "gen-image", type: "default", style },
    // 포즈 참조 경로: 모션영상 → 첫프레임 → 이미지생성
    { id: "e-motion-frame", source: "source-motion", target: "frame-pose", type: "default", style },
    { id: "e-frame-genimage", source: "frame-pose", target: "gen-image", type: "default", style },
    { id: "e2", source: "gen-image", target: "gen-video", type: "default", style },
    // 모션 소스 경로: 모션영상 → 영상생성 (직결)
    { id: "e3", source: "source-motion", target: "gen-video", type: "default", style },
    { id: "e4", source: "gen-video", target: "upscale", type: "default", style },
    { id: "e5", source: "upscale", target: "subtitle", type: "default", style },
    { id: "e6", source: "subtitle", target: "preview", type: "default", style },
  ]);

  // 동일 이름 존재 시 갱신
  const [existing] = await db.select().from(workflowTemplates).where(eq(workflowTemplates.name, NAME)).limit(1);
  if (existing) {
    await db.update(workflowTemplates).set({ nodes, edges, category: "video", isPublished: true }).where(eq(workflowTemplates.id, existing.id));
    console.log(`Updated template: ${NAME} (id: ${existing.id})`);
  } else {
    const [t] = await db
      .insert(workflowTemplates)
      .values({ name: NAME, category: "video", description: "이미지→영상→업스케일→자막 멀티스텝 파이프라인", nodes, edges, isPublished: true })
      .returning();
    console.log(`Created template: ${t.name} (id: ${t.id})`);
  }
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
