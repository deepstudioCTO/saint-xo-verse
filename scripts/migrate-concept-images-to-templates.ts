/**
 * conceptImages → workflow_templates 마이그레이션 (멱등)
 *
 * 그래프 모양·insert는 공용 헬퍼(buildSkillGraph/createSkillTemplate)가 담당.
 * 이미 sourceSkillId가 매핑된 컨셉이미지는 skip.
 *
 * 실행:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/migrate-concept-images-to-templates.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { isNotNull } from "drizzle-orm";
import { conceptImages, workflowTemplates } from "../drizzle/schema";
import { createSkillTemplate } from "../app/lib/skill-template.server";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

async function migrate() {
  console.log("Fetching conceptImages...");
  const images = await db.select().from(conceptImages);
  console.log(`Found ${images.length} conceptImages`);

  const mapped = await db
    .select({ sourceSkillId: workflowTemplates.sourceSkillId })
    .from(workflowTemplates)
    .where(isNotNull(workflowTemplates.sourceSkillId));
  const mappedIds = new Set(mapped.map((t) => t.sourceSkillId));

  let created = 0;
  let skipped = 0;

  for (const img of images) {
    const name = img.name ?? "Concept";
    if (mappedIds.has(img.id)) {
      skipped++;
      console.log(`  Skip (exists): ${name}`);
      continue;
    }
    try {
      await createSkillTemplate(db, {
        kind: "concept",
        conceptImageId: img.id,
        name,
        imageUrl: img.publicUrl,
      });
      created++;
      console.log(`  Created template: ${name}`);
    } catch (err) {
      skipped++;
      console.error(`  Failed for ${name}:`, err);
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  await client.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
