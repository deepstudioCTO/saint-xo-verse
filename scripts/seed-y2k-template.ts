/**
 * "Y2K 파파라치" 워크플로우 템플릿 시드 (프로토타입 5종 中 Y2K)
 *
 * 그래프: Source[멤버] → 이미지생성(nano-banana, image_input=[멤버]) → Preview
 * 검증된 프롬프트(retroimageprompt / banana-prompts.net 요소).
 *
 * 실행:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/seed-y2k-template.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { workflowTemplates } from "../drizzle/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const BASE = "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public";
const MEMBER_IMAGE = `${BASE}/characters/posters/00_rumi.png`;

const NAME = "Y2K 파파라치";
const PROMPT =
  "Y2K paparazzi flash photo, harsh on-camera flash, early-2000s digital camera, heavy 35mm film grain, slight magenta color shift.";

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
      data: { label: "Y2K 스냅 생성", generateType: "generate-image", prompt: PROMPT, resolution: "2K", aspectRatio: "2:3" },
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
      .values({ name: NAME, category: "image", description: "멤버 1장 → 2000s 플래시 스냅", nodes, edges, isPublished: true })
      .returning();
    console.log(`Created template: ${t.name} (id: ${t.id})`);
  }
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
