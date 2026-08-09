import { describe, it, expect } from "vitest";
import { toLibraryRun } from "../libraryRun";
import type { NodeRunOutputRow, WorkflowRunRowLike } from "../types";

const snapshot = JSON.stringify({
  nodes: [
    { id: "source-1", type: "source", position: { x: 0, y: 0 } },
    { id: "gen-1", type: "generate", position: { x: 200, y: 0 } },
  ],
  edges: [{ source: "source-1", target: "gen-1" }],
});

const baseRun: WorkflowRunRowLike = {
  id: "run-1",
  status: "completed",
  templateId: "t-1",
  templateSnapshot: snapshot,
  inputs: JSON.stringify({
    characterId: "sumin",
    lookId: "00_01",
    lookbookId: "00",
    musicId: "track-1",
    thumbnailUrl: "https://i/sumin.png",
    source: "home",
  }),
  error: null,
  startedAt: new Date("2026-08-08T01:00:00Z"),
  completedAt: new Date("2026-08-08T01:02:00Z"),
};

const genOutput: NodeRunOutputRow = {
  nodeId: "gen-1",
  nodeType: "generate",
  status: "completed",
  outputs: '{"url":"https://v/out.mp4","type":"video"}',
};

describe("toLibraryRun", () => {
  it("완료 run — 출력·메타데이터·템플릿 정보를 직렬화", () => {
    const item = toLibraryRun(baseRun, [genOutput], { name: "Dance A", category: "video" });
    expect(item).toEqual({
      id: "run-1",
      status: "completed",
      outputUrl: "https://v/out.mp4",
      outputType: "video",
      thumbnailUrl: "https://i/sumin.png",
      characterId: "sumin",
      lookId: "00_01",
      lookbookId: "00",
      musicId: "track-1",
      prompt: null,
      source: "home",
      templateId: "t-1",
      templateName: "Dance A",
      templateCategory: "video",
      error: null,
      startedAt: "2026-08-08T01:00:00.000Z",
      completedAt: "2026-08-08T01:02:00.000Z",
    });
  });

  it("pending run — 출력 없음, thumbnailUrl은 inputs에서", () => {
    const item = toLibraryRun(
      { ...baseRun, status: "running", completedAt: null },
      [{ nodeId: "gen-1", nodeType: "generate", status: "running", outputs: null }]
    );
    expect(item.outputUrl).toBeNull();
    expect(item.outputType).toBeNull();
    expect(item.thumbnailUrl).toBe("https://i/sumin.png");
    expect(item.completedAt).toBeNull();
    expect(item.templateName).toBeNull();
  });

  it("malformed snapshot·inputs에도 안전 폴백", () => {
    const item = toLibraryRun(
      { ...baseRun, templateSnapshot: "not-json", inputs: "also-not-json" },
      [genOutput]
    );
    expect(item.outputUrl).toBeNull();
    expect(item.characterId).toBeNull();
    expect(item.id).toBe("run-1");
  });
});
