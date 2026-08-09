import type { GraphNodeLike } from "./types";
import { isExecutableType } from "./types";

/**
 * 템플릿 그래프에 홈 화면 선택값(페르소나 이미지·프롬프트)을 주입한다. 순수 함수 — 불변.
 *
 * 관례: 템플릿의 `source` 노드 중 `data.media == null`인 것이 "빈 캐릭터 슬롯"이다
 * (migrate-skills-to-templates.ts의 source-1). 채워진 소스(모션/컨셉 레퍼런스)는 건드리지 않는다.
 *
 * 서버 Workflow는 그래프 스냅샷만 보고 DB를 조회하지 않으므로, 해소된 URL이
 * POST 전에 node.data에 들어가 있어야 한다 (Look 노드와 동일한 원칙).
 */
export interface TemplateInjection {
  characterImage?: { url: string; name?: string };
  prompt?: string;
}

export function injectTemplateInputs(
  nodes: GraphNodeLike[],
  injection: TemplateInjection
): GraphNodeLike[] {
  return nodes.map((node) => {
    const data = node.data ?? {};

    if (injection.characterImage && node.type === "source" && data.media == null) {
      return {
        ...node,
        data: {
          ...data,
          media: {
            type: "image",
            url: injection.characterImage.url,
            name: injection.characterImage.name ?? "Character",
          },
        },
      };
    }

    if (injection.prompt !== undefined && isExecutableType(node.type) && node.type !== "upscale") {
      return { ...node, data: { ...data, prompt: injection.prompt } };
    }

    return node;
  });
}
