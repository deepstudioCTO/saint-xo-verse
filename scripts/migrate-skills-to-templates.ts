/**
 * motionVideos → workflow_templates 마이그레이션
 *
 * 각 motionVideo에 대해 최소 노드 그래프 template을 생성.
 * - SourceNode (캐릭터 이미지 입력)
 * - MotionRefNode (모션 비디오 참조)
 * - GenerateNode (생성 실행)
 *
 * 실행:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/migrate-skills-to-templates.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { motionVideos, workflowTemplates } from "../drizzle/schema";

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

  let created = 0;
  let skipped = 0;

  for (const video of videos) {
    const videoUrl = getPublicUrl(video.storagePath);
    const thumbnailUrl = video.thumbnailPath ? getPublicUrl(video.thumbnailPath) : null;

    // 최소 워크플로우 그래프: Source → Generate (motionRef 데이터는 Generate 노드에 임베딩)
    const nodes = JSON.stringify([
      {
        id: "source-1",
        type: "source",
        position: { x: 50, y: 100 },
        data: {
          label: "Character",
          media: null, // 실행 시 페르소나 이미지로 채워짐
        },
      },
      {
        id: "motion-ref-1",
        type: "source",
        position: { x: 50, y: 320 },
        data: {
          label: "Motion Reference",
          media: {
            type: "video" as const,
            url: videoUrl,
            thumbnailUrl,
            name: video.name,
          },
          motionVideoId: video.id,
        },
      },
      {
        id: "generate-1",
        type: "generate",
        position: { x: 400, y: 180 },
        data: { label: "Generate Video" },
      },
    ]);

    const edges = JSON.stringify([
      { id: "e-source-generate", source: "source-1", target: "generate-1", type: "default", style: { stroke: "#444", strokeWidth: 1.5 } },
      { id: "e-motion-generate", source: "motion-ref-1", target: "generate-1", type: "default", style: { stroke: "#444", strokeWidth: 1.5 } },
    ]);

    try {
      await db.insert(workflowTemplates).values({
        name: video.name,
        category: "video",
        nodes,
        edges,
        thumbnailUrl,
        isPublished: true,
      });
      created++;
      console.log(`  Created template: ${video.name}`);
    } catch (err) {
      skipped++;
      console.error(`  Failed for ${video.name}:`, err);
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped/Failed: ${skipped}`);
  await client.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
