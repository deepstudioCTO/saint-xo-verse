import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUCKET = "characters";

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL, SUPABASE_SERVICE_KEY are required");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

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
  }

  console.log("Done!");
}

main().catch(console.error);
