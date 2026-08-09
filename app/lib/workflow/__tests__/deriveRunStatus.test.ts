import { describe, it, expect } from "vitest";
import { deriveRunStatus } from "../deriveRunStatus";

describe("deriveRunStatus", () => {
  it("빈 배열 → pending", () => {
    expect(deriveRunStatus([])).toBe("pending");
  });
  it("모두 completed → completed", () => {
    expect(deriveRunStatus([{ status: "completed" }, { status: "completed" }])).toBe("completed");
  });
  it("하나라도 failed → failed", () => {
    expect(deriveRunStatus([{ status: "completed" }, { status: "failed" }])).toBe("failed");
  });
  it("failed가 completed보다 우선", () => {
    expect(deriveRunStatus([{ status: "processing" }, { status: "failed" }])).toBe("failed");
  });
  it("진행중(하나라도 non-pending) → running", () => {
    expect(deriveRunStatus([{ status: "processing" }, { status: "pending" }])).toBe("running");
  });
  it("전부 pending → pending", () => {
    expect(deriveRunStatus([{ status: "pending" }, { status: "pending" }])).toBe("pending");
  });

  // 전제: 호출자는 실행 대상 노드 **전부**의 행을 넘긴다.
  // run 생성 시 planExecutableNodes로 행을 미리 만들기 때문에 성립한다.
  // (행이 제출 시점에 생기던 시절엔 아래가 completed로 오판됐다)
  it("실행 예정 노드가 섞이면 completed가 아니다", () => {
    expect(deriveRunStatus([{ status: "completed" }, { status: "pending" }])).toBe("running");
  });

  it("미실행(skipped)이 섞이면 completed가 아니다", () => {
    expect(deriveRunStatus([{ status: "completed" }, { status: "skipped" }])).toBe("running");
  });
});
