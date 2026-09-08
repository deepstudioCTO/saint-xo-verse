/**
 * 하은(Haeun) 플랫폼 온보딩 — 실증 IP 4인 중 유일하게 HitOS 데이터에 없던 멤버.
 *
 * 8/10 제출 숏폼 16편에 하은이 0편인 이유는 조합 선택이 아니라 **데이터 부재**였다
 * (characters 테이블에 sumin/rumi/geumbi/jiyoon/lei/siori/yui만 존재).
 * 보고서 본문의 "4인 소재 활용"과 산출물을 정합시키려면 먼저 이 온보딩이 필요하다.
 *
 * 소스: 2026-08-27 뷰티/메이크업 촬영 원본 (contents/260827_MAKEUP)
 *   HAEUN_F / HAEUN_L / HAEUN_R / HAEUN_L_45 / HAEUN_R_45 (2160x3840)
 *   같은 촬영일에 RUMI·SUMIN도 동일 세팅으로 찍혀 있어 **룩 단위 비교 조합**이 성립한다
 *   → lookbook "02 Beauty" / look "02_01"로 등록하고 3인 페르소나를 함께 넣는다.
 *
 * 영상 자산: 이 촬영은 스틸만 있다. characters.video / personas.video가 NOT NULL이라
 * 정면 컷으로 3초 스틸 클립(mp4)을 만들어 올린다 — 홈 캐러셀이 깨지지 않게 하는 최소 자산이며,
 * 하은 룩북 촬영이 들어오면 그대로 교체하면 된다. (에디터 Look 노드는 poster/defaultInput만 쓴다)
 *
 * 실행:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/onboard-haeun.ts
 *
 * 멱등: 같은 id로 upsert. 기존 캐릭터·페르소나는 건드리지 않는다.
 */

import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq } from "drizzle-orm";
import { characters, lookbooks, looks, personas } from "../drizzle/schema";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const BUCKET = "characters";
const SRC_DIR = "/Users/jobam/Documents/deepstudio/contents/260827_MAKEUP";

const LOOKBOOK_ID = "02";
const LOOK_ID = "02_01";

/** 8/27 촬영 3인 — 파일 접두사 → 캐릭터 */
const SHOT = [
  { characterId: "haeun", name: "Haeun", prefix: "HAEUN", isNew: true },
  { characterId: "rumi", name: "Rumi", prefix: "RUMI", isNew: false },
  { characterId: "sumin", name: "Sumin", prefix: "SUMIN", isNew: false },
] as const;

const DESCRIPTION = "2026.08.27 뷰티 촬영 룩";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

/** 원본 2160x3840은 레퍼런스로 과하다 — 1080폭으로 줄여 올린다 */
function resizedJpeg(src: string, outPath: string) {
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-i", src,
    "-vf", "scale=1080:-2",
    "-q:v", "2",
    outPath,
  ]);
}

/** 스틸 1장 → 3초 mp4 (영상 자산 없는 룩의 플레이스홀더) */
function stillClip(src: string, outPath: string) {
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-loop", "1", "-t", "3", "-i", src,
    "-vf", "scale=1080:-2,format=yuv420p",
    "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
    "-movflags", "+faststart",
    outPath,
  ]);
}

async function main() {
  const supabase = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_KEY"));
  const client = postgres(requireEnv("DATABASE_URL"), { prepare: false });
  const db = drizzle(client);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "haeun-onboard-"));

  // ── lookbook 02 "Beauty" / look 02_01 ─────────────────────
  await db
    .insert(lookbooks)
    .values({
      id: LOOKBOOK_ID,
      name: "beauty",
      displayName: "Beauty",
      description: "2026.08.27 뷰티/메이크업 촬영",
      displayOrder: 2,
    })
    .onConflictDoUpdate({
      target: lookbooks.id,
      set: { name: "beauty", displayName: "Beauty", displayOrder: 2 },
    });

  await db
    .insert(looks)
    .values({ id: LOOK_ID, lookbookId: LOOKBOOK_ID, displayOrder: 0 })
    .onConflictDoUpdate({ target: looks.id, set: { lookbookId: LOOKBOOK_ID, displayOrder: 0 } });

  console.log(`✓ lookbook ${LOOKBOOK_ID} / look ${LOOK_ID}`);

  // ── 인물별 자산 업로드 + 페르소나 ─────────────────────────
  for (let i = 0; i < SHOT.length; i++) {
    const s = SHOT[i];
    const front = path.join(SRC_DIR, `${s.prefix}_F.jpg`);
    if (!fs.existsSync(front)) {
      console.error(`✗ 소스 없음: ${front} — 건너뜀`);
      continue;
    }

    const posterLocal = path.join(tmp, `${s.characterId}_${LOOK_ID}.jpg`);
    const videoLocal = path.join(tmp, `${s.characterId}_${LOOK_ID}.mp4`);
    resizedJpeg(front, posterLocal);
    stillClip(posterLocal, videoLocal);

    const posterPath = `posters/${s.characterId}_${LOOK_ID}.jpg`;
    const videoPath = `videos/${s.characterId}_${LOOK_ID}.mp4`;

    for (const [p, local, type] of [
      [posterPath, posterLocal, "image/jpeg"],
      [videoPath, videoLocal, "video/mp4"],
    ] as const) {
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(p, fs.readFileSync(local), { contentType: type, upsert: true });
      if (error) throw new Error(`업로드 실패 ${p}: ${error.message}`);
    }

    const posterUrl = supabase.storage.from(BUCKET).getPublicUrl(posterPath).data.publicUrl;
    const videoUrl = supabase.storage.from(BUCKET).getPublicUrl(videoPath).data.publicUrl;

    // 새 멤버만 characters에 추가 — 기존 멤버의 대표 자산은 덮어쓰지 않는다
    if (s.isNew) {
      const existing = await db.select().from(characters).where(eq(characters.id, s.characterId));
      if (existing.length === 0) {
        const maxOrder = (await db.select().from(characters)).reduce(
          (m, c) => Math.max(m, c.displayOrder),
          -1
        );
        await db.insert(characters).values({
          id: s.characterId,
          name: s.name,
          description: DESCRIPTION,
          video: videoUrl,
          poster: posterUrl,
          displayOrder: maxOrder + 1,
        });
        console.log(`✓ character 신규: ${s.characterId}`);
      } else {
        console.log(`· character 이미 존재: ${s.characterId} (변경 없음)`);
      }
    }

    const already = await db
      .select()
      .from(personas)
      .where(and(eq(personas.lookId, LOOK_ID), eq(personas.characterId, s.characterId)));

    if (already.length === 0) {
      await db.insert(personas).values({
        lookId: LOOK_ID,
        characterId: s.characterId,
        name: s.name,
        description: DESCRIPTION,
        video: videoUrl,
        poster: posterUrl,
        displayOrder: i,
      });
      console.log(`✓ persona 신규: ${LOOK_ID}/${s.characterId}`);
    } else {
      await db
        .update(personas)
        .set({ video: videoUrl, poster: posterUrl })
        .where(and(eq(personas.lookId, LOOK_ID), eq(personas.characterId, s.characterId)));
      console.log(`· persona 갱신: ${LOOK_ID}/${s.characterId}`);
    }

    console.log(`   poster ${posterUrl}`);
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("\n완료 — 에디터 Look 노드 카탈로그(/api/personas)에 Beauty 02_01이 노출됩니다");
  await client.end();
}

main().catch((err) => {
  console.error("온보딩 실패:", err);
  process.exit(1);
});
