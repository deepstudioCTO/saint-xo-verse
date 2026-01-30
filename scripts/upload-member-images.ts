import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BUCKET_NAME = "member-images";
const MEMBERS_DIR = path.join(process.cwd(), "public/members");

async function main() {
  // 버킷 생성 (이미 존재하면 무시)
  const { error: bucketError } = await supabase.storage.createBucket(BUCKET_NAME, {
    public: true,
  });

  if (bucketError && !bucketError.message.includes("already exists")) {
    console.error("Failed to create bucket:", bucketError);
    return;
  }
  console.log(`Bucket '${BUCKET_NAME}' ready`);

  // PNG 파일만 업로드
  const files = fs.readdirSync(MEMBERS_DIR).filter(f => f.endsWith(".png"));

  const results: Record<string, string> = {};

  for (const file of files) {
    const filePath = path.join(MEMBERS_DIR, file);
    const fileBuffer = fs.readFileSync(filePath);

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(file, fileBuffer, {
        contentType: "image/png",
        upsert: true,
      });

    if (error) {
      console.error(`Failed to upload ${file}:`, error);
      continue;
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(file);

    const memberId = file.replace(".png", "");
    results[memberId] = urlData.publicUrl;
    console.log(`Uploaded ${file} -> ${urlData.publicUrl}`);
  }

  console.log("\n=== MEMBERS 데이터 업데이트용 ===\n");
  console.log("const MEMBERS: Record<string, { name: string; imageUrl: string }> = {");

  const memberNames: Record<string, string> = {
    geumbi: "금비",
    rumi: "루미",
    lei: "레이",
    jiyoon: "지윤",
    sumin: "수민",
  };

  for (const [id, url] of Object.entries(results)) {
    console.log(`  "${id}": { name: "${memberNames[id] || id}", imageUrl: "${url}" },`);
  }
  console.log("};");
}

main().catch(console.error);
