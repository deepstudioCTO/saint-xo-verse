/**
 * "멤버 무빙 화보" 워크플로우 템플릿 시드 (템플릿 9종째) — 이미지→영상(i2v)
 *
 * 그래프(기본 — 실사 시작):
 *   Look(멤버, 메타데이터 전용·미연결)
 *   Source(헤메스·컨셉 촬영 실사 화보 사진) → 영상생성(kling-v3 i2v 5초)
 *              → [업스케일 OFF] → 음악합성 → 자막 → Preview
 *
 * 그래프(--ai-still — AI 콘셉트 스틸):
 *   Look(멤버) → 이미지생성(nano-banana, 콘셉트 화보 스틸) → 영상생성(kling-v3 i2v 5초) → …(이하 동일)
 *
 * 왜 실사 시작이 기본인가(2026-10-13 비교):
 *   AI 스틸은 원본 대비 얼굴 유사도 0.58~0.79에 머리색이 한 톤 진해지는 경향이 있었다.
 *   헤어·메이크업·스타일링까지 끝난 촬영 사진(photo/ 헤메스·컨셉포토)은 그 자체가 IP의 공식
 *   비주얼이므로, 스틸 생성 단계를 빼고 첫 프레임으로 바로 쓰면 아이덴티티 손실이 영상 단계 하나로 준다.
 *   Look 노드는 그래프에 연결하지 않는다 — 연결하면 resolveUpstreamInputs가 Look 이미지까지 후보로
 *   올려 첫 프레임이 뒤바뀔 수 있다. 라이브러리 멤버 표기(deriveRunInputs)용으로만 둔다.
 *
 * 왜 필요한가(큐레이션 기준 ③IP 아이덴티티 유지):
 *   2026-10-13 아이덴티티 감사(공식 실사 포스터 ↔ 영상 프레임 얼굴 유사도, insightface)에서
 *   모션 컨트롤 9월분 평균 0.51(6편 중 3편 불합격), 시작 프레임 고정형 i2v(굿즈 PPL v2)는 0.83이었다.
 *   모션 컨트롤은 남의 댄스 영상 동작을 덮어씌우는 구조라 동작이 클수록 얼굴·표정이 댄서 쪽으로
 *   끌려간다. 춤 대신 화보·티저 컷 같은 잔잔한 움직임으로 멤버 숏폼을 만드는 경로를 따로 둔다.
 *
 * ①실수요: 컴백 티저·무드 필름·SNS 화보 릴스 — 공식 SNS 게시 빈도가 가장 높은 포맷.
 * ②단일 입력 재현 가능: 입력 슬롯은 멤버 룩 하나. 콘셉트(배경·조명·포즈)는 프롬프트 꼬리만 바꾼다.
 *
 * 스틸 프롬프트 설계(2026-10-13 시안 13장 테스트):
 *   - 레퍼런스는 Look 1장만 — 두 번째 사진(댄서 프레임 등)을 넣으면 머리색·조명이 섞인다.
 *   - "허리 위 미디엄 클로즈업"을 강제 — 전신으로 나오면 얼굴이 작아져 영상 단계에서 이탈한다.
 *   - 야간·역광 콘셉트에서 머리색이 어두워지는 경향이 있어 "조명이 머리색을 바꾸지 않게"를 명시.
 *
 * 자막 노드는 비워 둔다 — AI 생성 고지 자막은 쓰지 않기로 했다(2026-10-13).
 *
 * 실행(멱등 — 같은 이름이 있으면 갱신):
 *   export $(grep -v '^#' .env | xargs) && npx tsx scripts/seed-moving-photo-template.ts [--ai-still]
 * 배치: combos[].sourceImage에 실사 사진 URL(Storage concept-images/photo-*.jpg)을 넣는다.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { workflowTemplates } from "../drizzle/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const NAME = "멤버 무빙 화보";
const AI_STILL = process.argv.includes("--ai-still");
const DESCRIPTION =
  "멤버 룩 × 콘셉트 교체로 화보·티저 무드 숏폼을 만드는 파이프라인 (이미지→영상)";

// 시안 테스트 스크립트(보고서_9월_증빙/무빙화보/_scripts/gen_stills.py)의 IDENTITY와 같은 문장
const IDENTITY_PROMPT =
  "Reference 1 is the SUBJECT, a real person. Keep her exact facial identity " +
  "(face shape, eyes, eyebrows, nose, lips, skin tone, makeup), her exact natural hair color and hairstyle, " +
  "and her exact outfit and accessories from reference 1. Do not beautify or restyle her face, " +
  "do not change her age, hair color or clothing. " +
  "Change ONLY the background, lighting and pose to the concept below. " +
  "Framing: vertical medium close-up from the waist up (NOT a full-body shot), her head and shoulders fill the upper half of the frame, " +
  "she faces the camera at a slight angle, " +
  "face clearly visible and evenly lit even in night or backlit scenes, her hair color unchanged by the scene lighting, " +
  "relaxed natural pose, hands natural with five fingers or out of frame. " +
  "Realistic photo, K-pop comeback teaser photoshoot, shallow depth of field. Concept: ";

// 기본 콘셉트 — 시안에서 유사도가 가장 높았던 꽃 스튜디오. 다른 콘셉트는 노드 프롬프트 꼬리만 바꾼다.
const DEFAULT_CONCEPT =
  "pastel photo studio filled with fresh white and pink flowers, soft diffused beauty lighting, dreamy spring editorial.";

const VIDEO_PROMPT =
  "She slowly turns her head toward the camera, gives a soft natural smile and blinks naturally, " +
  "a gentle breeze moves a few strands of her hair. Same face, same hair color, same outfit. " +
  "Static camera with a very slow push-in, no cuts.";

const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

async function seed() {
  const nodes = JSON.stringify([
    {
      id: "look-member",
      type: "look",
      position: { x: 40, y: 40 },
      data: { label: "멤버", lookId: null, characterId: null, media: null },
    },
    ...(AI_STILL
      ? [
          {
            id: "gen-image",
            type: "generate-image",
            position: { x: 640, y: 40 },
            data: {
              label: "화보 스틸",
              generateType: "generate-image",
              model: "nano-banana",
              prompt: IDENTITY_PROMPT + DEFAULT_CONCEPT,
              resolution: "2K",
              aspectRatio: "2:3",
            },
          },
        ]
      : [
          {
            // 실사 시작 슬롯 — 배치 combo.sourceImage가 media를 채운다
            id: "source-photo",
            type: "source",
            position: { x: 640, y: 40 },
            data: {
              label: "화보 사진(실사)",
              media: null,
              sourceType: "concept-image",
            },
          },
        ]),
    {
      id: "gen-video",
      type: "generate",
      position: { x: 980, y: 340 },
      data: {
        label: "영상 생성",
        generateType: "generate",
        // 시작 프레임 고정 i2v — 굿즈 PPL v2와 같은 노드 설정
        videoModel: "kling-v3-i2v",
        duration: 5,
        mode: "standard",
        prompt: VIDEO_PROMPT,
      },
    },
    {
      id: "upscale",
      type: "upscale",
      position: { x: 1300, y: 340 },
      data: {
        label: "업스케일",
        model: "topaz",
        resolution: "2K",
        disabled: true,
      },
    },
    {
      id: "music",
      type: "music",
      position: { x: 1620, y: 340 },
      data: { label: "음악 합성", trackId: null },
    },
    {
      id: "subtitle",
      type: "subtitle",
      position: { x: 1940, y: 320 },
      data: { label: "자막", entries: [] },
    },
    {
      id: "preview",
      type: "preview",
      position: { x: 2260, y: 320 },
      data: { label: "Preview" },
    },
  ]);

  const style = { stroke: "#444", strokeWidth: 1.5 };
  const edges = JSON.stringify([
    ...(AI_STILL
      ? [
          {
            id: "e-look-genimage",
            source: "look-member",
            target: "gen-image",
            type: "default",
            style,
          },
          {
            id: "e-genimage-genvideo",
            source: "gen-image",
            target: "gen-video",
            type: "default",
            style,
          },
        ]
      : [
          {
            id: "e-photo-genvideo",
            source: "source-photo",
            target: "gen-video",
            type: "default",
            style,
          },
        ]),
    {
      id: "e-genvideo-upscale",
      source: "gen-video",
      target: "upscale",
      type: "default",
      style,
    },
    {
      id: "e-upscale-music",
      source: "upscale",
      target: "music",
      type: "default",
      style,
    },
    {
      id: "e-music-subtitle",
      source: "music",
      target: "subtitle",
      type: "default",
      style,
    },
    {
      id: "e-subtitle-preview",
      source: "subtitle",
      target: "preview",
      type: "default",
      style,
    },
  ]);

  const [existing] = await db
    .select()
    .from(workflowTemplates)
    .where(eq(workflowTemplates.name, NAME))
    .limit(1);

  if (existing) {
    await db
      .update(workflowTemplates)
      .set({
        nodes,
        edges,
        category: "video",
        description: DESCRIPTION,
        isPublished: true,
        currentVersion: existing.currentVersion + 1,
      })
      .where(eq(workflowTemplates.id, existing.id));
    console.log(
      `✓ 갱신: ${NAME} (${existing.id}, v${existing.currentVersion + 1})`,
    );
  } else {
    const [created] = await db
      .insert(workflowTemplates)
      .values({
        name: NAME,
        description: DESCRIPTION,
        category: "video",
        nodes,
        edges,
        viewport: '{"x":0,"y":0,"zoom":0.6}',
        isPublished: true,
      })
      .returning();
    console.log(`✓ 생성: ${NAME} (${created.id})`);
  }
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
