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
});
