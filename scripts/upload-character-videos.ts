import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { personas } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUCKET = "characters";

/**
 * Parse filename into lookId + characterId.
 * Handles two naming conventions:
 *   "00_02_sumin.mp4"     → lookId: "00_02", characterId: "sumin"
 *   "00_03_sumin_01.mp4"  → lookId: "00_03", characterId: "sumin_01"
 *   "00_sumin.mp4"        → lookId: "00_01", characterId: "sumin"  (legacy)
 *   "01_lei.mp4"          → lookId: "01_01", characterId: "lei"    (legacy)
 */
function parseFilename(file: string): { lookId: string; characterId: string } | null {
  const name = file.replace(/\.(mp4|png)$/, "");

  // Try new format: {lookId}_{characterId} where lookId is XX_XX
  const newMatch = name.match(/^(\d{2}_\d{2})_(.+)$/);
  if (newMatch) {
    return { lookId: newMatch[1], characterId: newMatch[2] };
  }

  // Legacy format: {lookbookId}_{characterId} → lookId = {lookbookId}_01
  const legacyMatch = name.match(/^(\d{2})_(.+)$/);
  if (legacyMatch) {
    return { lookId: `${legacyMatch[1]}_01`, characterId: legacyMatch[2] };
  }

  return null;
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  if (!supabaseUrl || !supabaseKey || !databaseUrl) {
    throw new Error("SUPABASE_URL, SUPABASE_SERVICE_KEY, DATABASE_URL are required");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const client = postgres(databaseUrl, { prepare: false });
  const db = drizzle(client);

  // Create bucket if not exists
  const { error: bucketError } = await supabase.storage.createBucket(BUCKET, {
    public: true,
  });
  if (bucketError && !bucketError.message.includes("already exists")) {
    throw new Error(`Failed to create bucket: ${bucketError.message}`);
  }
  console.log(`Bucket "${BUCKET}" ready`);

  const characterDir = path.join(__dirname, "../public/character");
  const files = fs.readdirSync(characterDir).filter((f) => f.endsWith(".mp4"));

  console.log(`Found ${files.length} video files to upload`);

  for (const file of files) {
    const filePath = path.join(characterDir, file);
    const fileBuffer = fs.readFileSync(filePath);
    const storagePath = `videos/${file}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: "video/mp4",
        upsert: true,
      });

    if (error) {
      console.error(`Failed to upload ${file}:`, error.message);
      continue;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    console.log(`Uploaded ${file} → ${data.publicUrl}`);

    // Update DB persona.video
    const parsed = parseFilename(file);
    if (parsed) {
      await db
        .update(personas)
        .set({ video: data.publicUrl })
        .where(
          and(
            eq(personas.lookId, parsed.lookId),
            eq(personas.characterId, parsed.characterId)
          )
        );
      console.log(`  → DB updated: look ${parsed.lookId} / ${parsed.characterId}`);
    }
  }

  console.log("Done!");
  await client.end();
}

main().catch(console.error);
