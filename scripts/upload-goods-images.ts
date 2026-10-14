/**
 * IP 굿즈 제품 사진을 Storage에 올린다 — "굿즈 PPL" 템플릿의 제품 레퍼런스 입력용.
 * 외부 브랜드 상세컷은 실제 모델·인물 얼굴이 함께 찍혀 있어 레퍼런스로 쓰면 초상권 문제가 생긴다.
 * 그래서 권리가 깨끗한 자사 굿즈(공연 굿즈 슬라임볼·XO 펜던트)로 실증한다.
 *
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/upload-goods-images.ts
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
const BUCKET = "motion-videos";
const FILES = ["goods-slime-ball.jpg", "goods-xo-pendant.jpg"];

for (const name of FILES) {
  const body = fs.readFileSync(path.join("data/goods", name));
  const storagePath = `concept-images/${name}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, body, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  console.log(supabase.storage.from(BUCKET).getPublicUrl(storagePath).data.publicUrl);
}
