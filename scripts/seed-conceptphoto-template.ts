/**
 * "컨셉포토" 워크플로우 템플릿 시드 (프로토타입 5종 中 컨셉포토·정체성 유지)
 *
 * 그래프: Source[멤버] → 이미지생성(nano-banana, image_input=[멤버]) → Preview
 * 검증된 패턴(imagine.art "Nano Banana Pro Prompting Guide" 정체성 유지 절)
 * + 컨셉부는 리포에 이미 쓰인 검증 문구(멀티스텝 시드) 재사용.
 *
 * 실행:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/seed-conceptphoto-template.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { workflowTemplates } from "../drizzle/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const BASE = "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public";
const MEMBER_IMAGE = `${BASE}/characters/posters/00_lei.png`;

const NAME = "컨셉포토";
const PROMPT =
  "editorial concept photo, cinematic studio lighting, appearance must remain 100% identical to the reference image (including makeup, expression, and details)";

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

async function seed() {
  const nodes = JSON.stringify([
    {
      id: "source-member",
      type: "source",
      position: { x: 40, y: 180 },
      data: { label: "멤버", media: { type: "image", url: MEMBER_IMAGE, name: "lei" }, sourceType: "character-image" },
    },
    {
      id: "gen-image",
      type: "generate-image",
      position: { x: 360, y: 180 },
      data: { label: "컨셉포토 생성", generateType: "generate-image", prompt: PROMPT, resolution: "2K", aspectRatio: "2:3" },
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
      .values({ name: NAME, category: "image", description: "멤버 1장+컨셉 → 정체성 유지 컨셉 포토카드", nodes, edges, isPublished: true })
      .returning();
    console.log(`Created template: ${t.name} (id: ${t.id})`);
  }
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
