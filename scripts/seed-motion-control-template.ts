/**
 * "모션 컨트롤" 워크플로우 템플릿 시드
 *
 * 그래프:
 *   Look(멤버) ─────────────────┐
 *                              ├→ 이미지생성 → 영상생성
 *   Source(모션영상) → 첫프레임 ┘         ↑
 *          └────────────────────────────┘
 *
 * kling motion-control은 입력 이미지에서 출발해 모션 영상의 동작을 따라간다. 그래서 생성
 * 이미지의 포즈가 모션 첫 프레임과 어긋나면 영상 초반이 튄다. 이 결합을 이미지 생성 노드
 * 안에 숨기지 않고 frame("첫 프레임") 노드와 엣지로 그래프에 드러낸다 — 모션 영상이 포즈
 * 참조와 모션 소스 두 역할로 쓰인다는 사실이 그래프만 봐도 보인다.
 *
 * 이전 버전은 이미지 생성 단계 없이 Source 2개 → 영상생성 이었고, 두 Source가 모두
 * media:null 이라 injectTemplateInputs가 모션 슬롯까지 캐릭터 이미지로 덮었다.
 * 이제 모션 소스는 실제 영상을 들고 있고, 멤버 슬롯은 Look 노드가 담당한다.
 *
 * 실행(멱등 — 같은 이름이 있으면 갱신):
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/seed-motion-control-template.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { workflowTemplates } from "../drizzle/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const BASE = "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public";
// 모션 영상 "Dance" — thumbnail_path가 곧 첫 프레임 JPG다(업로드 시 생성). frame 노드가 이걸 읽는다.
const MOTION_VIDEO = `${BASE}/motion-videos/videos/1769773533936-08.mp4`;
const MOTION_THUMBNAIL = `${BASE}/motion-videos/thumbnails/1769773534398-08.jpg`;

const NAME = "모션 컨트롤";

/**
 * 포즈 정합 문구는 코드가 자동 주입하지 않는다 — 템플릿 프롬프트에 직접 써 둔다.
 * "last reference image" = frame 노드가 넣는 모션 첫 프레임. 이 순서는 캔버스 배치가 아니라
 * resolveUpstreamInputs의 rank 규칙(frame은 항상 마지막)이 보장한다.
 */
const POSE_PROMPT =
  "You are given 2 reference images with different roles. " +
  "Reference 1 is the SUBJECT: reproduce her face, hairstyle, makeup and her exact outfit. " +
  "The LAST reference is a POSE AND FRAMING GUIDE ONLY: copy only its camera shot size, crop, head angle and body pose. " +
  "Do NOT take the last reference's person, face, hairstyle, clothing, hat, accessories, background, text, captions or stickers. " +
  "Output: the subject of reference 1, in reference 1's outfit, posed and framed exactly like the last reference. Cinematic editorial photo.";

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

async function seed() {
  // 세로 크기 주의: Look 노드는 포스터(1:2)를 200px 폭으로 그려 ~490px이다.
  // 아래로 이어지는 노드는 y를 넉넉히 띄운다(짧은 노드 기준 y+400으로 잡으면 겹친다).
  const nodes = JSON.stringify([
    {
      id: "look-member",
      type: "look",
      position: { x: 40, y: 40 },
      data: { label: "멤버", lookId: null, characterId: null, media: null },
    },
    {
      id: "source-motion",
      type: "source",
      position: { x: 40, y: 620 },
      data: {
        label: "모션 영상",
        media: { type: "video", url: MOTION_VIDEO, thumbnailUrl: MOTION_THUMBNAIL, name: "Dance" },
        sourceType: "motion-video",
      },
    },
    {
      // 비실행 노드 — 업스트림 영상의 첫 프레임을 이미지로 흘려보낸다(포즈 참조).
      // 배치는 가독성용일 뿐 순서와 무관하다: images 순서는 rank로 고정된다.
      id: "frame-pose",
      type: "frame",
      position: { x: 330, y: 660 },
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
      position: { x: 980, y: 340 },
      data: {
        label: "영상 생성",
        generateType: "generate",
        prompt: "smooth natural motion, fixed camera, no zoom, no camera shake",
      },
    },
    {
      id: "preview",
      type: "preview",
      position: { x: 1300, y: 340 },
      data: { label: "Preview" },
    },
  ]);

  const style = { stroke: "#444", strokeWidth: 1.5 };
  const edges = JSON.stringify([
    { id: "e-look-genimage", source: "look-member", target: "gen-image", type: "default", style },
    // 포즈 참조 경로: 모션영상 → 첫프레임 → 이미지생성
    { id: "e-motion-frame", source: "source-motion", target: "frame-pose", type: "default", style },
    { id: "e-frame-genimage", source: "frame-pose", target: "gen-image", type: "default", style },
    { id: "e-genimage-genvideo", source: "gen-image", target: "gen-video", type: "default", style },
    // 모션 소스 경로: 모션영상 → 영상생성 (직결)
    { id: "e-motion-genvideo", source: "source-motion", target: "gen-video", type: "default", style },
    { id: "e-genvideo-preview", source: "gen-video", target: "preview", type: "default", style },
  ]);

  // 동일 이름 존재 시 갱신 (멱등 — 재실행해도 템플릿이 중복 생성되지 않는다)
  const [existing] = await db
    .select()
    .from(workflowTemplates)
    .where(eq(workflowTemplates.name, NAME))
    .limit(1);

  if (existing) {
    await db
      .update(workflowTemplates)
      .set({ nodes, edges, category: "video", isPublished: true })
      .where(eq(workflowTemplates.id, existing.id));
    console.log(`Updated template: ${NAME} (id: ${existing.id})`);
  } else {
    const [t] = await db
      .insert(workflowTemplates)
      .values({
        name: NAME,
        category: "video",
        description: "모션 영상의 첫 프레임을 포즈 참조로 써서 초반 튐을 줄이는 모션 컨트롤 파이프라인",
        nodes,
        edges,
        isPublished: true,
      })
      .returning();
    console.log(`Created template: ${t.name} (id: ${t.id})`);
  }
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
