import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUCKET = "motion-videos";

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL, SUPABASE_SERVICE_KEY are required");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const musicDir = path.join(__dirname, "../public/music");
  const files = fs
    .readdirSync(musicDir)
    .filter((f) => f.endsWith(".png") || f.endsWith(".jpeg") || f.endsWith(".jpg"));

  console.log(`Found ${files.length} cover files to upload`);

  for (const file of files) {
    const filePath = path.join(musicDir, file);
    const fileBuffer = fs.readFileSync(filePath);
    const storagePath = `music-covers/${file}`;
    const ext = path.extname(file).toLowerCase();
    const contentType = ext === ".png" ? "image/png" : "image/jpeg";

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType,
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
