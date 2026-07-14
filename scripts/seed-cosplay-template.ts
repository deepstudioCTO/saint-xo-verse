/**
 * "캐릭터 코스프레" 워크플로우 템플릿 시드 (프로토타입 5종 中 1번)
 *
 * 그래프: Source[멤버] + Source[캐릭터] → 이미지생성(nano-banana, image_input=[멤버,캐릭터])
 * 검증된 프롬프트(glbgpt Nano Banana Cosplay 튜토리얼).
 *
 * 실행:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/seed-cosplay-template.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { workflowTemplates } from "../drizzle/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const BASE = "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public";
const MEMBER_IMAGE = `${BASE}/characters/posters/00_rumi.png`;
const CHARACTER_IMAGE = `${BASE}/characters/posters/00_sumin.png`;

const NAME = "캐릭터 코스프레";

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

async function seed() {
  const nodes = JSON.stringify([
    {
      id: "source-member",
      type: "source",
      position: { x: 40, y: 60 }, // 위 → image_input[0] (멤버)
      data: { label: "멤버", media: { type: "image", url: MEMBER_IMAGE, name: "rumi" }, sourceType: "character-image" },
    },
    {
      id: "source-character",
      type: "source",
      position: { x: 40, y: 340 }, // 아래 → image_input[1] (캐릭터)
      data: { label: "캐릭터", media: { type: "image", url: CHARACTER_IMAGE, name: "reference" }, sourceType: "character-image" },
    },
    {
      id: "gen-image",
      type: "generate-image",
      position: { x: 360, y: 180 },
      data: {
        label: "코스프레 생성",
        generateType: "generate-image",
        prompt:
          "Make the person in the first image cosplay the character in the second image, matching the outfit, makeup, and props exactly.",
        resolution: "2K",
        aspectRatio: "2:3",
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
    { id: "e2", source: "source-character", target: "gen-image", type: "default", style },
    { id: "e3", source: "gen-image", target: "preview", type: "default", style },
  ]);

  const [existing] = await db.select().from(workflowTemplates).where(eq(workflowTemplates.name, NAME)).limit(1);
  if (existing) {
    await db.update(workflowTemplates).set({ nodes, edges, category: "image", isPublished: true }).where(eq(workflowTemplates.id, existing.id));
    console.log(`Updated template: ${NAME} (id: ${existing.id})`);
  } else {
    const [t] = await db
      .insert(workflowTemplates)
      .values({ name: NAME, category: "image", description: "멤버+캐릭터 2장 → 코스프레 포토카드", nodes, edges, isPublished: true })
      .returning();
    console.log(`Created template: ${t.name} (id: ${t.id})`);
  }
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
