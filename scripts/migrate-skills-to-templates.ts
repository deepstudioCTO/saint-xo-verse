/**
 * motionVideos → workflow_templates 마이그레이션 (멱등)
 *
 * 그래프 모양·insert는 공용 헬퍼(buildSkillGraph/createSkillTemplate)가 담당.
 * 이미 sourceSkillId가 매핑된 모션영상은 skip.
 *
 * 실행:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/migrate-skills-to-templates.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { isNotNull } from "drizzle-orm";
import { motionVideos, workflowTemplates } from "../drizzle/schema";
import { createSkillTemplate } from "../app/lib/skill-template.server";

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!supabaseUrl || !supabaseKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required");

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);
const supabase = createClient(supabaseUrl, supabaseKey);

function getPublicUrl(storagePath: string): string {
  const { data: { publicUrl } } = supabase.storage
    .from("motion-videos")
    .getPublicUrl(storagePath);
  return publicUrl;
}

async function migrate() {
  console.log("Fetching motionVideos...");
  const videos = await db.select().from(motionVideos);
  console.log(`Found ${videos.length} motionVideos`);

  const mapped = await db
    .select({ sourceSkillId: workflowTemplates.sourceSkillId })
    .from(workflowTemplates)
    .where(isNotNull(workflowTemplates.sourceSkillId));
  const mappedIds = new Set(mapped.map((t) => t.sourceSkillId));

  let created = 0;
  let skipped = 0;

  for (const video of videos) {
    if (mappedIds.has(video.id)) {
      skipped++;
      console.log(`  Skip (exists): ${video.name}`);
      continue;
    }
    try {
      await createSkillTemplate(db, {
        kind: "motion",
        motionVideoId: video.id,
        name: video.name,
        videoUrl: getPublicUrl(video.storagePath),
        thumbnailUrl: video.thumbnailPath ? getPublicUrl(video.thumbnailPath) : null,
      });
      created++;
      console.log(`  Created template: ${video.name}`);
    } catch (err) {
      skipped++;
      console.error(`  Failed for ${video.name}:`, err);
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
  await client.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
