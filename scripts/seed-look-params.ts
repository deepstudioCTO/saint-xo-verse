/**
 * Look 스타일 파라미터 시드 (P3-2 검증용).
 *
 * looks 행에 정규 스펙 스타일 파라미터를 채운다. 실행 시 api.workflow-execute가
 * personaId/lookId로 이 값을 해소해 generate-image 노드.data에 오버레이한다.
 *
 * 실행:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/seed-look-params.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { looks } from "../drizzle/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

// soul-styles "Spotlight" (seed-soul-demo-template.ts와 동일 style_id)
const SPOTLIGHT_STYLE_ID = "40ff999c-f576-443c-b5b3-c7d1391a666e";

// Look 00_02에 "Spotlight" 미학을 인코딩. Soul 데모 템플릿을 이 look으로 실행하면
// 노드 값(styleStrength 0.8, aspect 2:3)을 look 값(0.45, 3:4)이 덮어쓴다 = 주입 검증.
const LOOK_ID = "00_02";
const PARAMS = {
  stylePreset: SPOTLIGHT_STYLE_ID,
  styleStrength: 0.45,
  seed: 12345,
  aspectRatio: "3:4",
  resolution: "1080p",
  batchSize: 1,
  enhancePrompt: true,
};

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

async function seed() {
  const res = await db.update(looks).set(PARAMS).where(eq(looks.id, LOOK_ID)).returning({ id: looks.id });
  if (res.length === 0) {
    console.error(`Look "${LOOK_ID}" not found — seed looks first.`);
  } else {
    console.log(`Set style params on look ${LOOK_ID}:`, PARAMS);
  }
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
