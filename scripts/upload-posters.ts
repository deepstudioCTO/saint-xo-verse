import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { verseCharacters } from "../drizzle/schema";
import { and, eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BUCKET = "characters";

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
  const files = fs.readdirSync(characterDir).filter((f) => f.endsWith(".png"));

  console.log(`Found ${files.length} poster files to upload`);

  for (const file of files) {
    const filePath = path.join(characterDir, file);
    const fileBuffer = fs.readFileSync(filePath);
    const storagePath = `posters/${file}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (error) {
      console.error(`Failed to upload ${file}:`, error.message);
      continue;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    console.log(`Uploaded ${file} → ${data.publicUrl}`);

    // Update DB: parse verseId and characterId from filename (e.g. "00_sumin.png")
    const match = file.match(/^(\d+)_(.+)\.png$/);
    if (match) {
      const [, verseId, characterId] = match;
      await db
        .update(verseCharacters)
        .set({ poster: data.publicUrl })
        .where(
          and(
            eq(verseCharacters.verseId, verseId),
            eq(verseCharacters.characterId, characterId)
          )
        );
      console.log(`  → DB updated: verse ${verseId} / ${characterId}`);
    }
  }

  console.log("Done!");
  await client.end();
}

main().catch(console.error);
