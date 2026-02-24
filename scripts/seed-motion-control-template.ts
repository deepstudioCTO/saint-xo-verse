/**
 * "모션 컨트롤" 제네릭 워크플로우 템플릿 시드
 *
 * 실행:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/seed-motion-control-template.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { workflowTemplates } from "../drizzle/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

async function seed() {
  const nodes = JSON.stringify([
    {
      id: "source-1",
      type: "source",
      position: { x: 50, y: 80 },
      data: {
        label: "Character Image",
        media: null,
        sourceType: "character-image",
      },
    },
    {
      id: "motion-ref-1",
      type: "source",
      position: { x: 50, y: 320 },
      data: {
        label: "Motion Reference",
        media: null,
        sourceType: "motion-video",
      },
    },
    {
      id: "generate-1",
      type: "generate",
      position: { x: 400, y: 170 },
      data: {
        label: "Generate Video",
        generateType: "generate",
        status: "idle",
      },
    },
  ]);

  const edges = JSON.stringify([
    {
      id: "e-src-gen",
      source: "source-1",
      target: "generate-1",
      type: "default",
      style: { stroke: "#444", strokeWidth: 1.5 },
    },
    {
      id: "e-motion-gen",
      source: "motion-ref-1",
      target: "generate-1",
      type: "default",
      style: { stroke: "#444", strokeWidth: 1.5 },
    },
  ]);

  const [template] = await db
    .insert(workflowTemplates)
    .values({
      name: "모션 컨트롤",
      category: "video",
      nodes,
      edges,
      isPublished: true,
    })
    .returning();

  console.log(`Created template: ${template.name} (id: ${template.id})`);
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
