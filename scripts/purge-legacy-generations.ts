/**
 * 레거시 generations 데이터 + Storage 파일 전량 삭제.
 *
 * 반드시 generations 테이블 drop 마이그레이션 **전에** 실행 — 테이블이 있어야
 * storage 경로를 읽을 수 있다. 스키마에서 generations 정의가 이미 제거됐으므로
 * raw SQL로 접근한다.
 *
 * 실행:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/purge-legacy-generations.ts
 */

import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const databaseUrl = process.env.DATABASE_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!supabaseUrl || !supabaseKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required");

const sql = postgres(databaseUrl, { prepare: false });
const supabase = createClient(supabaseUrl, supabaseKey);

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function purge() {
  const rows = await sql<
    { storage_path: string | null; output_storage_path: string | null; upscaled_storage_path: string | null }[]
  >`select storage_path, output_storage_path, upscaled_storage_path from generations`;
  console.log(`generations rows: ${rows.length}`);

  const paths = rows
    .flatMap((r) => [r.storage_path, r.output_storage_path, r.upscaled_storage_path])
    .filter((p): p is string => !!p);
  console.log(`storage paths to delete: ${paths.length}`);

  let removed = 0;
  let failed = 0;
  for (const chunk of chunks(paths, 100)) {
    const { data, error } = await supabase.storage.from("motion-videos").remove(chunk);
    if (error) {
      failed += chunk.length;
      console.error(`  chunk failed (${chunk.length}):`, error.message);
    } else {
      removed += data?.length ?? chunk.length;
    }
  }
  console.log(`storage removed: ${removed}, failed: ${failed}`);

  const deleted = await sql`delete from generations`;
  console.log(`DB rows deleted: ${deleted.count}`);

  await sql.end();
}

purge().catch((err) => {
  console.error("Purge failed:", err);
  process.exit(1);
});
