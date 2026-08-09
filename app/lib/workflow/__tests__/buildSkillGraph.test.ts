import { describe, it, expect } from "vitest";
import { buildSkillGraph } from "../buildSkillGraph";
import { injectTemplateInputs } from "../injectTemplateInputs";
import { resolveUpstreamInputs } from "../resolveUpstreamInputs";
import { topoSort } from "../topoSort";
import { isExecutableType } from "../types";

const motionSkill = {
  kind: "motion" as const,
  motionVideoId: "mv-1",
  name: "Dance",
  videoUrl: "https://cdn/dance.mp4",
  thumbnailUrl: "https://cdn/dance.jpg",
};

const conceptSkill = {
  kind: "concept" as const,
  conceptImageId: "ci-1",
  name: "Y2K",
  imageUrl: "https://cdn/y2k.png",
};

describe("buildSkillGraph — 모션 스킬", () => {
  const { nodes, edges } = buildSkillGraph(motionSkill);

  it("캐릭터 슬롯은 media:null인 source (주입 관례)", () => {
    const slot = nodes.find((n) => n.id === "source-1");
    expect(slot?.type).toBe("source");
    expect(slot?.data?.media).toBeNull();
  });

  it("모션 레퍼런스는 video media + motionVideoId 임베딩", () => {
    const ref = nodes.find((n) => n.id === "motion-ref-1");
    expect(ref?.type).toBe("source");
    expect(ref?.data?.media).toEqual({
      type: "video",
      url: "https://cdn/dance.mp4",
      thumbnailUrl: "https://cdn/dance.jpg",
      name: "Dance",
    });
    expect(ref?.data?.motionVideoId).toBe("mv-1");
  });

  it("generate 노드 1개, 두 소스가 모두 연결됨", () => {
    const gen = nodes.find((n) => n.type === "generate");
    expect(gen).toBeDefined();
    expect(edges).toHaveLength(2);
    expect(edges.every((e) => e.target === gen!.id)).toBe(true);
    expect(new Set(edges.map((e) => e.source))).toEqual(new Set(["source-1", "motion-ref-1"]));
  });
});

describe("buildSkillGraph — 컨셉 스킬", () => {
  const { nodes, edges } = buildSkillGraph(conceptSkill);

  it("캐릭터 슬롯(media:null) + 컨셉 레퍼런스(image media + conceptImageId)", () => {
    expect(nodes.find((n) => n.id === "source-1")?.data?.media).toBeNull();
    const ref = nodes.find((n) => n.id === "concept-ref-1");
    expect(ref?.data?.media).toEqual({ type: "image", url: "https://cdn/y2k.png", name: "Y2K" });
    expect(ref?.data?.conceptImageId).toBe("ci-1");
  });

  it("generate-image 노드에 빈 prompt (실행 전 주입 대상)", () => {
    const gen = nodes.find((n) => n.type === "generate-image");
    expect(gen?.data?.generateType).toBe("generate-image");
    expect(gen?.data?.prompt).toBe("");
    expect(edges.every((e) => e.target === gen!.id)).toBe(true);
  });

  it("캐릭터 슬롯이 컨셉 레퍼런스보다 위(y) — images[] 순서 = [인물, 컨셉]", () => {
    const slot = nodes.find((n) => n.id === "source-1")!;
    const ref = nodes.find((n) => n.id === "concept-ref-1")!;
    expect(slot.position!.y).toBeLessThan(ref.position!.y);
  });
});

describe("조합: buildSkillGraph → injectTemplateInputs → resolveUpstreamInputs", () => {
  it("모션 스킬: generate 노드가 {image: 인물, sourceVideo: 모션}을 받는다", () => {
    const { nodes, edges } = buildSkillGraph(motionSkill);
    const injected = injectTemplateInputs(nodes, {
      characterImage: { url: "https://cdn/sumin.png", name: "SUMIN" },
    });

    const executables = topoSort(injected, edges).filter((n) => isExecutableType(n.type));
    expect(executables).toHaveLength(1);

    const inputs = resolveUpstreamInputs(injected, edges, executables[0].id);
    expect(inputs.image).toBe("https://cdn/sumin.png");
    expect(inputs.sourceVideo).toBe("https://cdn/dance.mp4");
  });

  it("컨셉 스킬: images가 [인물, 컨셉] 순서 + prompt 주입", () => {
    const { nodes, edges } = buildSkillGraph(conceptSkill);
    const injected = injectTemplateInputs(nodes, {
      characterImage: { url: "https://cdn/sumin.png", name: "SUMIN" },
      prompt: "cosplay photo",
    });

    const gen = injected.find((n) => n.type === "generate-image")!;
    expect(gen.data?.prompt).toBe("cosplay photo");

    const inputs = resolveUpstreamInputs(injected, edges, gen.id);
    expect(inputs.images).toEqual(["https://cdn/sumin.png", "https://cdn/y2k.png"]);
  });

  it("주입 없이 실행하면 인물 슬롯이 비어 image가 컨셉/null — 주입이 필수임을 문서화", () => {
    const motion = buildSkillGraph(motionSkill);
    const gen = motion.nodes.find((n) => n.type === "generate")!;
    const inputs = resolveUpstreamInputs(motion.nodes, motion.edges, gen.id);
    expect(inputs.image).toBeNull();
  });
});
