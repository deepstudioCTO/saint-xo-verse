import type { GraphNodeLike } from "./types";

/**
 * 스킬(모션영상/컨셉이미지) 1개 → 실행 가능한 최소 3노드 그래프. 순수 함수.
 *
 * 그래프 모양의 **유일한 소스** — 마이그레이션 스크립트·업로드 라우트의 템플릿 생성,
 * 홈 Generate의 즉석 조립(템플릿 매핑이 없을 때 폴백)이 전부 이 함수를 쓴다.
 *
 * 관례:
 * - `source-1` = 빈 캐릭터 슬롯 (`media: null`) — 실행 전 `injectTemplateInputs`로 주입
 * - 캐릭터 슬롯이 레퍼런스보다 위(y) → `resolveUpstreamInputs`의 position 정렬로
 *   images[] 순서가 [인물, 컨셉]이 된다 (nano-banana image_input 순서 계약)
 */

export interface GraphEdgeSeed {
  id: string;
  source: string;
  target: string;
  type: string;
  style: { stroke: string; strokeWidth: number };
}

export type SkillGraphSource =
  | {
      kind: "motion";
      motionVideoId: string;
      name: string;
      videoUrl: string;
      thumbnailUrl?: string | null;
    }
  | {
      kind: "concept";
      conceptImageId: string;
      name: string;
      imageUrl: string;
    };

const EDGE_STYLE = { stroke: "#444", strokeWidth: 1.5 };

export function buildSkillGraph(skill: SkillGraphSource): {
  nodes: GraphNodeLike[];
  edges: GraphEdgeSeed[];
} {
  const characterSlot: GraphNodeLike = {
    id: "source-1",
    type: "source",
    position: { x: 50, y: 100 },
    data: { label: "Character", media: null },
  };

  if (skill.kind === "motion") {
    return {
      nodes: [
        characterSlot,
        {
          id: "motion-ref-1",
          type: "source",
          position: { x: 50, y: 320 },
          data: {
            label: "Motion Reference",
            media: {
              type: "video",
              url: skill.videoUrl,
              thumbnailUrl: skill.thumbnailUrl ?? null,
              name: skill.name,
            },
            motionVideoId: skill.motionVideoId,
          },
        },
        {
          id: "generate-1",
          type: "generate",
          position: { x: 400, y: 180 },
          data: { label: "Generate Video", generateType: "generate" },
        },
      ],
      edges: [
        { id: "e-source-generate", source: "source-1", target: "generate-1", type: "default", style: EDGE_STYLE },
        { id: "e-motion-generate", source: "motion-ref-1", target: "generate-1", type: "default", style: EDGE_STYLE },
      ],
    };
  }

  return {
    nodes: [
      characterSlot,
      {
        id: "concept-ref-1",
        type: "source",
        position: { x: 50, y: 420 },
        data: {
          label: "Concept Reference",
          media: { type: "image", url: skill.imageUrl, name: skill.name },
          conceptImageId: skill.conceptImageId,
        },
      },
      {
        id: "generate-1",
        type: "generate-image",
        position: { x: 400, y: 220 },
        data: { label: "Generate Image", generateType: "generate-image", prompt: "" },
      },
    ],
    edges: [
      { id: "e-source-generate", source: "source-1", target: "generate-1", type: "default", style: EDGE_STYLE },
      { id: "e-concept-generate", source: "concept-ref-1", target: "generate-1", type: "default", style: EDGE_STYLE },
    ],
  };
}
