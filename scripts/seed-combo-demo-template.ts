/**
 * "룩×음악 조합 데모" 워크플로우 템플릿 시드 (8월 중간점검 P1-2)
 *
 * 그래프: Look(멤버) + Source(모션영상) → 이미지생성 → 영상생성 → 업스케일 → Music → 자막 → Preview
 *
 * 조합 UX의 실물: 이 템플릿을 열고 **Look 노드의 멤버**와 **Music 노드의 트랙**만 바꿔
 * Run 하면 동일 그래프가 다른 변주를 만든다. 발표 라이브 데모 시나리오가 이 템플릿 하나로 끝난다.
 *
 * Look 노드의 media는 시드 시점에 DB 페르소나에서 해소해 넣는다 — 서버 파이프라인은
 * 그래프 스냅샷만 보고 DB를 조회하지 않으므로 URL이 node.data에 있어야 한다.
 *
 * 실행:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/seed-combo-demo-template.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import postgres from "postgres";
import { workflowTemplates, personas, motionVideos } from "../drizzle/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const BASE = "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public";

const NAME = "룩×음악 조합 데모";
/** 기본 선택 — 데모 시 Look/Music 노드에서 바꾸는 대상 */
const DEFAULT_LOOK_ID = "00_01";
const DEFAULT_CHARACTER_ID = "rumi";
const DEFAULT_TRACK_ID = "2"; // POP IT

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

async function seed() {
  const [persona] = await db
    .select()
    .from(personas)
    .where(and(eq(personas.lookId, DEFAULT_LOOK_ID), eq(personas.characterId, DEFAULT_CHARACTER_ID)))
    .limit(1);
  if (!persona) {
    throw new Error(`기본 페르소나 없음: ${DEFAULT_LOOK_ID}/${DEFAULT_CHARACTER_ID}`);
  }

  const [motion] = await db.select().from(motionVideos).limit(1);
  if (!motion) throw new Error("모션 영상이 없어 템플릿을 만들 수 없음");

  const style = { stroke: "#444", strokeWidth: 1.5 };

  const nodes = JSON.stringify([
    {
      id: "look",
      type: "look",
      position: { x: 40, y: 60 },
      data: {
        label: "멤버(룩)",
        lookId: persona.lookId,
        characterId: persona.characterId,
        media: {
          type: "image",
          url: persona.defaultInput ?? persona.poster,
          name: persona.name,
        },
      },
    },
    {
      id: "source-motion",
      // Look 노드는 포스터(1:2)를 200px 폭으로 그려 세로 ~490px가 된다 — 그 아래로 충분히 내린다
      type: "source",
      position: { x: 40, y: 620 },
      data: {
        label: "모션 영상",
        media: { type: "video", url: `${BASE}/motion-videos/${motion.storagePath}`, name: motion.name },
        sourceType: "motion-video",
      },
    },
    {
      id: "gen-image",
      type: "generate-image",
      position: { x: 320, y: 40 },
      data: {
        label: "이미지 생성",
        generateType: "generate-image",
        model: "nano-banana",
        prompt:
          "editorial concept photo, cinematic studio lighting, appearance must remain 100% identical to the reference image (including makeup, expression, and details)",
        resolution: "2K",
        aspectRatio: "2:3",
      },
    },
    {
      id: "gen-video",
      type: "generate",
      position: { x: 620, y: 200 },
      data: {
        label: "영상 생성",
        generateType: "generate",
        prompt:
          "soft indoor lighting, pastel background, fixed camera, smooth motion, no zoom, no camera shake",
      },
    },
    {
      id: "upscale",
      type: "upscale",
      position: { x: 900, y: 200 },
      data: { label: "업스케일", model: "topaz", resolution: "2K" },
    },
    {
      id: "music",
      type: "music",
      position: { x: 1180, y: 200 },
      data: { label: "음악 합성", trackId: DEFAULT_TRACK_ID },
    },
    {
      id: "subtitle",
      type: "subtitle",
      position: { x: 1480, y: 180 },
      data: { label: "자막", entries: [] },
    },
    {
      id: "preview",
      type: "preview",
      position: { x: 1760, y: 180 },
      data: { label: "Preview" },
    },
  ]);

  const edges = JSON.stringify([
    { id: "e1", source: "look", target: "gen-image", type: "default", style },
    { id: "e2", source: "gen-image", target: "gen-video", type: "default", style },
    { id: "e3", source: "source-motion", target: "gen-video", type: "default", style },
    { id: "e4", source: "gen-video", target: "upscale", type: "default", style },
    { id: "e5", source: "upscale", target: "music", type: "default", style },
    { id: "e6", source: "music", target: "subtitle", type: "default", style },
    { id: "e7", source: "subtitle", target: "preview", type: "default", style },
  ]);

  const description = "Look(멤버)·Music(트랙)만 교체해 동일 그래프로 변주를 생성하는 조합 데모";

  const [existing] = await db
    .select()
    .from(workflowTemplates)
    .where(eq(workflowTemplates.name, NAME))
    .limit(1);

  if (existing) {
    await db
      .update(workflowTemplates)
      .set({ nodes, edges, description, category: "video", isPublished: true })
      .where(eq(workflowTemplates.id, existing.id));
    console.log(`Updated template: ${NAME} (id: ${existing.id})`);
  } else {
    const [t] = await db
      .insert(workflowTemplates)
      .values({ name: NAME, category: "video", description, nodes, edges, isPublished: true })
      .returning();
    console.log(`Created template: ${t.name} (id: ${t.id})`);
  }

  console.log(`  기본 멤버: ${persona.name} (${persona.lookId}/${persona.characterId})`);
  console.log(`  기본 모션: ${motion.name}`);
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
