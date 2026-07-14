/**
 * "Soul 데모 (Spotlight)" 워크플로우 템플릿 시드 — P3-1 Soul provider 검증용.
 *
 * 그래프: Source[멤버] → 이미지생성(model:"soul-reference", style_id:Spotlight) → Preview
 * Higgsfield Soul Reference로 실제 생성되는지 E2E 검증.
 * (기존 nano 템플릿 4종은 미변경 — model 필드 없으면 nano-banana로 back-compat)
 *
 * 실행:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/seed-soul-demo-template.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { workflowTemplates } from "../drizzle/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const BASE = "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public";
const MEMBER_IMAGE = `${BASE}/characters/posters/00_rumi.png`;

const NAME = "Soul 데모 (Spotlight)";
// soul-styles: "Spotlight" — Direct light, high-contrast drama, paparazzi flash
const SPOTLIGHT_STYLE_ID = "40ff999c-f576-443c-b5b3-c7d1391a666e";
const PROMPT =
  "editorial portrait, high-contrast studio lighting, cinematic mood, appearance stays identical to the reference";

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

async function seed() {
  const nodes = JSON.stringify([
    {
      id: "source-member",
      type: "source",
      position: { x: 40, y: 180 },
      data: { label: "멤버", media: { type: "image", url: MEMBER_IMAGE, name: "rumi" }, sourceType: "character-image" },
    },
    {
      id: "gen-image",
      type: "generate-image",
      position: { x: 360, y: 180 },
      data: {
        label: "Soul 생성",
        generateType: "generate-image",
        model: "soul-reference",
        prompt: PROMPT,
        stylePreset: SPOTLIGHT_STYLE_ID,
        styleStrength: 0.8,
        aspectRatio: "2:3",
        resolution: "1080p",
        batchSize: 1,
        enhancePrompt: true,
      },
    },
    {
      id: "preview",
      type: "preview",
      position: { x: 660, y: 180 },
      data: { label: "Preview" },
    },
  ]);

  const style = { stroke: "#444", strokeWidth: 1.5 };
  const edges = JSON.stringify([
    { id: "e1", source: "source-member", target: "gen-image", type: "default", style },
    { id: "e2", source: "gen-image", target: "preview", type: "default", style },
  ]);

  const [existing] = await db.select().from(workflowTemplates).where(eq(workflowTemplates.name, NAME)).limit(1);
  if (existing) {
    await db.update(workflowTemplates).set({ nodes, edges, category: "image", isPublished: true }).where(eq(workflowTemplates.id, existing.id));
    console.log(`Updated template: ${NAME} (id: ${existing.id})`);
  } else {
    const [t] = await db
      .insert(workflowTemplates)
      .values({ name: NAME, category: "image", description: "멤버 1장 → Soul Reference(Spotlight) 생성", nodes, edges, isPublished: true })
      .returning();
    console.log(`Created template: ${t.name} (id: ${t.id})`);
  }
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
