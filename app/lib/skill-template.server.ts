import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { workflowTemplates } from "../../drizzle/schema";
import { buildSkillGraph, type SkillGraphSource } from "./workflow/buildSkillGraph";

/**
 * 스킬(모션영상/컨셉이미지) → 실행용 워크플로우 템플릿 생성의 유일한 서버 진입점.
 * 그래프 모양은 buildSkillGraph(순수함수)가 결정 — 여기서는 insert만 한다.
 * 마이그레이션 스크립트·업로드 라우트가 공유.
 */

export function skillSourceId(skill: SkillGraphSource): string {
  return skill.kind === "motion" ? skill.motionVideoId : skill.conceptImageId;
}

export async function createSkillTemplate(
  db: PostgresJsDatabase,
  skill: SkillGraphSource,
  opts?: { thumbnailUrl?: string | null }
) {
  const { nodes, edges } = buildSkillGraph(skill);
  const thumbnailUrl =
    opts?.thumbnailUrl ?? (skill.kind === "concept" ? skill.imageUrl : skill.thumbnailUrl ?? null);

  const [created] = await db
    .insert(workflowTemplates)
    .values({
      name: skill.name,
      category: skill.kind === "motion" ? "video" : "image",
      nodes: JSON.stringify(nodes),
      edges: JSON.stringify(edges),
      thumbnailUrl,
      isPublished: true,
      sourceSkillId: skillSourceId(skill),
    })
    .returning();
  return created;
}
