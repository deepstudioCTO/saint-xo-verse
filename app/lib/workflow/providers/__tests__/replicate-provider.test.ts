import { describe, it, expect } from "vitest";
import {
  replicateImageRequest,
  normalizeReplicateStatus,
  REPLICATE_MODEL_VERSIONS,
} from "../replicate";

describe("replicateImageRequest (spec → tagged replicate 요청)", () => {
  it("provider=replicate, version=image, image_input 반영", () => {
    const r = replicateImageRequest({ prompt: "p", referenceImages: ["a", "b"] });
    expect(r.provider).toBe("replicate");
    if (r.provider === "replicate") {
      expect(r.version).toBe(REPLICATE_MODEL_VERSIONS.image);
      expect(r.input.image_input).toEqual(["a", "b"]);
    }
  });
});

describe("normalizeReplicateStatus", () => {
  it("succeeded + 배열 output → url=output[0]", () => {
    expect(normalizeReplicateStatus({ status: "succeeded", output: ["u0", "u1"] })).toEqual({
      status: "succeeded",
      url: "u0",
    });
  });
  it("succeeded + 문자열 output → url", () => {
    expect(normalizeReplicateStatus({ status: "succeeded", output: "u" }).url).toBe("u");
  });
  it("failed / canceled → failed", () => {
    expect(normalizeReplicateStatus({ status: "failed", output: null, error: "e" })).toEqual({
      status: "failed",
      error: "e",
    });
    expect(normalizeReplicateStatus({ status: "canceled", output: null }).status).toBe("failed");
  });
  it("processing/starting → processing", () => {
    expect(normalizeReplicateStatus({ status: "processing", output: null }).status).toBe("processing");
    expect(normalizeReplicateStatus({ status: "starting", output: null }).status).toBe("processing");
  });
});
