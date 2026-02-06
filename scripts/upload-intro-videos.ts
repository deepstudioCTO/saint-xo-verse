import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function uploadVideo(filePath: string, storagePath: string) {
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  console.log(`Uploading ${fileName} to ${storagePath}...`);

  const { data, error } = await supabase.storage
    .from("motion-videos")
    .upload(storagePath, fileBuffer, {
      contentType: "video/mp4",
      upsert: true,
    });

  if (error) {
    console.error(`Failed to upload ${fileName}:`, error);
    return null;
  }

  const { data: publicUrlData } = supabase.storage
    .from("motion-videos")
    .getPublicUrl(storagePath);

  console.log(`Uploaded ${fileName}: ${publicUrlData.publicUrl}`);
  return publicUrlData.publicUrl;
}

async function main() {
  // Upload bot.mp4 from temp folder
  const botPath = path.join(process.cwd(), "temp_videos", "bot.mp4");

  if (fs.existsSync(botPath)) {
    const url = await uploadVideo(botPath, "intro-videos/bot.mp4");
    if (url) {
      console.log("\nBot video URL:");
      console.log(url);
    }
  } else {
    console.log("bot.mp4 not found in temp_videos/");
  }

  // Upload verse.mp4 from temp folder too
  const versePath = path.join(process.cwd(), "temp_videos", "verse.mp4");
  if (fs.existsSync(versePath)) {
    const url = await uploadVideo(versePath, "intro-videos/verse.mp4");
    if (url) {
      console.log("\nVerse video URL:");
      console.log(url);
    }
  } else {
    console.log("verse.mp4 not found in temp_videos/");
  }
}

main().catch(console.error);
