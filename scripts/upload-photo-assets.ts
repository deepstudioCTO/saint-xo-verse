/**
 * 실사 화보 사진(헤메스·컨셉 촬영 크롭본)을 Storage에 올린다 — "멤버 무빙 화보" 실사 시작 입력용.
 * 원본(~/Documents/deepstudio/photo)은 손대지 않고, 2:3 크롭본 디렉토리만 받는다.
 * 경로는 `concept-images/photo-<파일명>` — 배치 plan의 combos[].sourceImage에 출력 URL을 넣는다.
 *
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/upload-photo-assets.ts <크롭본 디렉토리>
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const dir = process.argv[2];
if (!dir) throw new Error("크롭본 디렉토리를 지정하세요");

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const BUCKET = "motion-videos";

for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".jpg")).sort()) {
  const storagePath = `concept-images/photo-${name}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fs.readFileSync(path.join(dir, name)), {
      contentType: "image/jpeg",
      upsert: true,
    });
  if (error) throw error;
  console.log(`${name}\t${supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl}`);
}
