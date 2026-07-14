/**
 * "케데헌 Rumi 코스프레" 워크플로우 템플릿 시드 (프로토타입 5종 中 코스프레, 재셋팅)
 *
 * 그래프: Source[멤버] → 이미지생성(nano-banana, image_input=[멤버]) → Preview
 *
 * 배경: 기존 "캐릭터 코스프레"는 2번 입력을 실제 캐릭터가 아니라 다른 멤버 포스터(수민)로
 * 잡아 "멤버끼리 옷 바꿔입기"라는 무의미한 결과가 나왔음(데모 부적합). K-pop 실제 코스프레
 * 사례 리서치 결과 2025 최대 화제작 'KPop Demon Hunters'(넷플릭스) 캐릭터 코스프레(제니가
 * 할로윈에 Rumi 코스프레)를 채택. 주인공 이름이 우리 멤버 '루미'와 동일해 메타 임팩트.
 *
 * 저작권 처리: 넷플릭스 공식 캐릭터 에셋을 다운로드·호스팅하지 않는다(원저작물 복제·배포 회피).
 * 다른 이미지 4종과 동일하게 단일 멤버 입력 + Rumi의 실제 디자인을 근거로 한 프롬프트 오마주로 구성.
 * (Rumi 디자인 근거: KPop Demon Hunters Wiki — 긴 보라색 땋은머리, 팔의 보라 데몬 패턴,
 *  핫핑크 재킷+골드 플로럴 다크블루 크롭탑+데님 숏팬츠+블루 레깅스+블랙 부츠)
 *
 * 실행:
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/seed-kdh-rumi-cosplay-template.ts
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { workflowTemplates } from "../drizzle/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const BASE = "https://dloarazwucxtwykqzfow.supabase.co/storage/v1/object/public";
const MEMBER_IMAGE = `${BASE}/characters/posters/00_rumi.png`; // 우리 루미가 케데헌 루미를 코스프레

const NAME = "케데헌 Rumi 코스프레";
const OLD_NAME = "캐릭터 코스프레"; // 기존 데모 템플릿(무의미 결과) — 정리 대상
const PROMPT =
  "Transform this K-pop idol into a cosplay of Rumi, the demon-hunter idol leader of HUNTR/X: " +
  "long bright purple hair styled in a single dragon braid, subtle glowing purple demon-pattern " +
  "stripes tracing along her arms, a hot-pink cropped jacket over a dark blue crop top with gold " +
  "floral detailing, dark denim shorts with golden accents, blue leggings and tall black boots. " +
  "Keep her own face, features and identity 100% intact — this is a cosplay, not a face swap. " +
  "Sharp cinematic K-pop concept-photo lighting.";

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

async function seed() {
  const nodes = JSON.stringify([
    {
      id: "source-member",
      type: "source",
      position: { x: 40, y: 180 },
      data: { label: "멤버", media: { type: "image", url: MEMBER_IMAGE, name: "rumi" }, sourceType: "character-image" },
    },
    {
      id: "gen-image",
      type: "generate-image",
      position: { x: 360, y: 180 },
      data: { label: "케데헌 Rumi 코스프레", generateType: "generate-image", prompt: PROMPT, resolution: "2K", aspectRatio: "2:3" },
    },
    {
      id: "preview",
      type: "preview",
      position: { x: 660, y: 180 },
      data: { label: "Preview" },
    },
  ]);

  const style = { stroke: "#444", strokeWidth: 1.5 };
  const edges = JSON.stringify([
    { id: "e1", source: "source-member", target: "gen-image", type: "default", style },
    { id: "e2", source: "gen-image", target: "preview", type: "default", style },
  ]);

  // 기존 "캐릭터 코스프레" 데모 템플릿 정리(있으면 삭제)
  const [old] = await db.select().from(workflowTemplates).where(eq(workflowTemplates.name, OLD_NAME)).limit(1);
  if (old) {
    await db.delete(workflowTemplates).where(eq(workflowTemplates.id, old.id));
    console.log(`Deleted legacy template: ${OLD_NAME} (id: ${old.id})`);
  }

  const [existing] = await db.select().from(workflowTemplates).where(eq(workflowTemplates.name, NAME)).limit(1);
  if (existing) {
    await db.update(workflowTemplates).set({ nodes, edges, category: "image", isPublished: true }).where(eq(workflowTemplates.id, existing.id));
    console.log(`Updated template: ${NAME} (id: ${existing.id})`);
  } else {
    const [t] = await db
      .insert(workflowTemplates)
      .values({ name: NAME, category: "image", description: "멤버 → KPop Demon Hunters HUNTR/X 루미 룩 코스프레(오마주)", nodes, edges, isPublished: true })
      .returning();
    console.log(`Created template: ${t.name} (id: ${t.id})`);
  }
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
