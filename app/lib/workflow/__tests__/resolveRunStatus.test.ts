import { describe, it, expect } from "vitest";
import { resolveRunStatus } from "../resolveRunStatus";

describe("resolveRunStatus", () => {
  // ── 회귀: 폴링 조기 종료 버그 ────────────────────────────────
  // 노드1이 끝나고 노드2가 아직 제출되기 전인 창에서 run이 completed로 오판되면
  // 클라이언트가 폴링을 끊고, 뒤이어 끝난 노드의 산출물이 영영 화면에 붙지 않는다.
  describe("종료 판정 권한은 run.status에만 있다", () => {
    it("이미지만 완료되고 나머지는 실행 예정 → completed가 아니다", () => {
      expect(
        resolveRunStatus("running", [
          { status: "completed" },
          { status: "pending" },
          { status: "pending" },
        ])
      ).toBe("running");
    });

    it("노드 행이 전부 completed여도 run이 아직 running이면 running", () => {
      // finalize step 직전 구간 — 권위가 종료를 선언하지 않았으므로 앞서가지 않는다
      expect(
        resolveRunStatus("running", [{ status: "completed" }, { status: "completed" }])
      ).toBe("running");
    });

    it("run이 completed면 completed", () => {
      expect(
        resolveRunStatus("completed", [{ status: "completed" }, { status: "completed" }])
      ).toBe("completed");
    });
  });

  describe("실패", () => {
    it("run이 failed면 노드 상태와 무관하게 failed", () => {
      expect(resolveRunStatus("failed", [{ status: "completed" }])).toBe("failed");
    });

    it("run이 아직 running이어도 노드 실패는 즉시 드러낸다", () => {
      expect(
        resolveRunStatus("running", [{ status: "completed" }, { status: "failed" }])
      ).toBe("failed");
    });

    it("미실행(skipped)이 섞여도 completed로 새지 않는다", () => {
      expect(
        resolveRunStatus("running", [
          { status: "completed" },
          { status: "failed" },
          { status: "skipped" },
        ])
      ).toBe("failed");
    });
  });

  describe("진행 표시", () => {
    it("노드 행이 없으면 run.status를 그대로", () => {
      expect(resolveRunStatus("pending", [])).toBe("pending");
      expect(resolveRunStatus("running", [])).toBe("running");
    });

    it("전부 실행 예정이면 pending", () => {
      expect(resolveRunStatus("pending", [{ status: "pending" }, { status: "pending" }])).toBe(
        "pending"
      );
    });

    it("하나라도 제출됐으면 running", () => {
      expect(resolveRunStatus("running", [{ status: "processing" }, { status: "pending" }])).toBe(
        "running"
      );
    });

    it("알 수 없는 run.status는 pending으로 방어", () => {
      expect(resolveRunStatus("weird", [])).toBe("pending");
    });
  });
});
