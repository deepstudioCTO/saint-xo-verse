/**
 * 기존 스킬 템플릿의 source_skill_id 백필 (1회용).
 *
 * 컬럼 도입 전에 만들어진 템플릿은 nodes JSON에만 motionVideoId/conceptImageId가
 * 임베딩돼 있다 — 파싱해서 컬럼에 복사한다. 이미 값이 있으면 skip.
 *
 * 실행:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/backfill-template-skill-ids.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, isNull } from "drizzle-orm";
import { workflowTemplates } from "../drizzle/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

function extractSkillId(nodesJson: string): string | null {
  const m = nodesJson.match(/"(?:motionVideoId|conceptImageId)":"([^"]+)"/);
  return m ? m[1] : null;
}

async function backfill() {
  const templates = await db
    .select({ id: workflowTemplates.id, name: workflowTemplates.name, nodes: workflowTemplates.nodes })
    .from(workflowTemplates)
    .where(isNull(workflowTemplates.sourceSkillId));

  let updated = 0;
  let skipped = 0;

  for (const t of templates) {
    const skillId = extractSkillId(t.nodes);
    if (!skillId) {
      skipped++;
      console.log(`  Skip (일반 템플릿): ${t.name}`);
      continue;
    }
    await db
      .update(workflowTemplates)
      .set({ sourceSkillId: skillId })
      .where(eq(workflowTemplates.id, t.id));
    updated++;
    console.log(`  Backfilled: ${t.name} → ${skillId}`);
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
  await client.end();
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
