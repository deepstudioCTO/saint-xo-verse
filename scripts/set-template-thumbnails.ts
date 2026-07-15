/**
 * 워크플로우 템플릿 썸네일(thumbnail_url) 세팅 + 데모 템플릿 숨김.
 *
 * 배경: W패널(WorkflowPanel)은 thumbnailUrl을 <img>로 렌더하고, 이름 라벨은
 * 흰색이라 썸네일이 없으면 빈 회색 카드 + 이름이 안 보임. 썸네일만 채우면 둘 다 해결.
 *
 * - 이미지 프로토타입 4종: 실제 생성 결과물(gov/ai/docs/추가구현/프로토타입_결과물/)을
 *   Supabase Storage(motion-videos/generated-images/template-thumbs/)에 업로드 후 URL 세팅.
 * - 영상 템플릿 2종: 멤버 입력 이미지(호스팅 URL)를 썸네일로 세팅.
 * - demo / Soul 데모: 패널에서 숨김(is_published=false).
 *
 * 실행: export $(grep -v '^#' .env | xargs) && npx tsx scripts/set-template-thumbnails.ts
 */
import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { workflowTemplates } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

const BUCKET = "motion-videos";
const THUMB_DIR = "generated-images/template-thumbs";

// 로컬 결과물 폴더(리포 밖 gov 문서). 4종 = 실제 프로토타입 Run 결과물.
const RESULT_DIR =
  "/Users/jobam/Documents/deepstudio/gov/ai/docs/추가구현/프로토타입_결과물";

// 이미지 프로토타입: 템플릿명 → { 결과물 파일명, ASCII storage 슬러그 }
// (Supabase Storage 키는 ASCII만 허용 → 한글 슬러그 불가)
const IMAGE_THUMBS: Record<string, { file: string; slug: string }> = {
  "케데헌 Rumi 코스프레": { file: "케데헌Rumi코스프레_rumi.jpg", slug: "kdh-rumi-cosplay" },
  "3D 피규어 굿즈": { file: "3D피규어굿즈_sumin.jpg", slug: "figurine-sumin" },
  "Y2K 파파라치": { file: "Y2K파파라치_rumi.jpg", slug: "y2k-rumi" },
  컨셉포토: { file: "컨셉포토_lei.jpg", slug: "conceptphoto-lei" },
};

// 영상 템플릿: 템플릿명 → 멤버 입력 이미지(이미 호스팅된 public URL)
const BASE = "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public";
const VIDEO_THUMBS: Record<string, string> = {
  "멀티스텝 생성 파이프라인": `${BASE}/characters/posters/00_rumi.png`,
  "모션 컨트롤": `${BASE}/member-images/sumin.png`,
};

// 패널에서 숨길 데모/플레이스홀더 템플릿
const HIDE = ["demo", "Soul 데모 (Spotlight)"];

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  if (!supabaseUrl || !supabaseKey || !databaseUrl) {
    throw new Error("SUPABASE_URL, SUPABASE_SERVICE_KEY, DATABASE_URL 필요");
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const client = postgres(databaseUrl, { prepare: false });
  const db = drizzle(client);

  // 1) 이미지 결과물 4종 업로드 → public URL
  const uploaded: Record<string, string> = {};
  for (const [name, { file, slug }] of Object.entries(IMAGE_THUMBS)) {
    const abs = path.join(RESULT_DIR, file);
    if (!fs.existsSync(abs)) {
      console.warn(`⚠️  결과물 없음, 건너뜀: ${abs}`);
      continue;
    }
    const buf = fs.readFileSync(abs);
    const key = `${THUMB_DIR}/${slug}.jpg`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(key, buf, { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(`업로드 실패(${file}): ${error.message}`);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(key);
    uploaded[name] = data.publicUrl;
    console.log(`⬆️  ${name} → ${data.publicUrl}`);
  }

  // 2) 썸네일 URL 세팅(이미지 업로드분 + 영상 멤버이미지)
  const mapping: Record<string, string> = { ...uploaded, ...VIDEO_THUMBS };
  for (const [name, url] of Object.entries(mapping)) {
    const res = await db
      .update(workflowTemplates)
      .set({ thumbnailUrl: url })
      .where(eq(workflowTemplates.name, name))
      .returning({ id: workflowTemplates.id });
    console.log(
      res.length ? `✅ 썸네일 세팅: ${name}` : `❓ 템플릿 못 찾음: ${name}`
    );
  }

  // 3) 데모/플레이스홀더 숨김
  for (const name of HIDE) {
    const res = await db
      .update(workflowTemplates)
      .set({ isPublished: false })
      .where(eq(workflowTemplates.name, name))
      .returning({ id: workflowTemplates.id });
    console.log(res.length ? `🙈 숨김: ${name}` : `❓ 못 찾음: ${name}`);
  }

  await client.end();
  console.log("완료.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
