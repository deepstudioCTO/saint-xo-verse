/**
 * "멀티스텝 생성 파이프라인" 워크플로우 템플릿 시드 (표8 노드에디터 캡처용)
 *
 * 그래프: Source(멤버이미지)+Source(모션영상) → 이미지생성 → 영상생성 → 업스케일 → 자막 → Preview
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
const MOTION_VIDEO = `${BASE}/motion-videos/videos/1769731717953-04.mp4`;

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
      position: { x: 40, y: 340 },
      data: {
        label: "모션 영상",
        media: { type: "video", url: MOTION_VIDEO, name: "motion" },
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
        prompt:
          "editorial concept photo, cinematic studio lighting, appearance must remain 100% identical to the reference image (including makeup, expression, and details)",
        resolution: "2K",
        aspectRatio: "2:3",
      },
    },
    {
      id: "gen-video",
      type: "generate",
      position: { x: 620, y: 180 },
      data: {
        label: "영상 생성",
        generateType: "generate",
        prompt: "soft indoor lighting, pastel background, fixed camera, smooth motion, no zoom, no camera shake",
      },
    },
    {
      id: "upscale",
      type: "upscale",
      position: { x: 900, y: 180 },
      data: { label: "업스케일", model: "real-esrgan", resolution: "2K" },
    },
    {
      id: "subtitle",
      type: "subtitle",
      position: { x: 1180, y: 160 },
      data: { label: "자막", entries: [] },
    },
    {
      id: "preview",
      type: "preview",
      position: { x: 1460, y: 160 },
      data: { label: "Preview" },
    },
  ]);

  const style = { stroke: "#444", strokeWidth: 1.5 };
  const edges = JSON.stringify([
    { id: "e1", source: "source-member", target: "gen-image", type: "default", style },
    { id: "e2", source: "gen-image", target: "gen-video", type: "default", style },
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
