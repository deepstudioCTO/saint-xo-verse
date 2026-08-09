import { describe, it, expect } from "vitest";
import { injectTemplateInputs } from "../injectTemplateInputs";
import type { GraphNodeLike } from "../types";

const characterSlot: GraphNodeLike = {
  id: "source-1",
  type: "source",
  data: { label: "Character", media: null },
};

const motionRef: GraphNodeLike = {
  id: "motion-ref-1",
  type: "source",
  data: {
    label: "Motion Reference",
    media: { type: "video", url: "https://cdn/motion.mp4", name: "Dance" },
  },
};

const generate: GraphNodeLike = {
  id: "generate-1",
  type: "generate",
  data: { label: "Generate Video", generateType: "generate" },
};

describe("injectTemplateInputs", () => {
  it("media가 null인 source에만 캐릭터 이미지를 주입하고, 채워진 레퍼런스는 건드리지 않음", () => {
    const result = injectTemplateInputs([characterSlot, motionRef, generate], {
      characterImage: { url: "https://cdn/sumin.png", name: "SUMIN" },
    });

    expect(result[0].data?.media).toEqual({
      type: "image",
      url: "https://cdn/sumin.png",
      name: "SUMIN",
    });
    expect(result[1].data?.media).toEqual(motionRef.data?.media);
  });

  it("prompt는 generate/generate-image 노드에만 덮어쓰고 upscale·source는 제외", () => {
    const generateImage: GraphNodeLike = {
      id: "gi-1",
      type: "generate-image",
      data: { prompt: "old" },
    };
    const upscale: GraphNodeLike = { id: "up-1", type: "upscale", data: { model: "topaz" } };

    const result = injectTemplateInputs([characterSlot, generateImage, upscale], {
      prompt: "new prompt",
    });

    expect(result[0].data?.prompt).toBeUndefined();
    expect(result[1].data?.prompt).toBe("new prompt");
    expect(result[2].data?.prompt).toBeUndefined();
  });

  it("입력 배열·노드를 변이하지 않음 (불변)", () => {
    const nodes = [characterSlot, generate];
    const before = JSON.stringify(nodes);
    injectTemplateInputs(nodes, {
      characterImage: { url: "https://cdn/x.png" },
      prompt: "p",
    });
    expect(JSON.stringify(nodes)).toBe(before);
  });

  it("주입값이 없으면 노드가 그대로", () => {
    const result = injectTemplateInputs([characterSlot, motionRef], {});
    expect(result[0].data?.media).toBeNull();
    expect(result[1]).toBe(motionRef);
  });

  it("name 미지정 시 Character 기본 이름", () => {
    const result = injectTemplateInputs([characterSlot], {
      characterImage: { url: "https://cdn/x.png" },
    });
    expect((result[0].data?.media as { name: string }).name).toBe("Character");
  });
});
