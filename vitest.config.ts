import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // 순수 로직 단위 테스트만 (노드 UI·네트워크·Chrome은 제외)
    include: ["app/**/__tests__/**/*.test.ts"],
    environment: "node",
  },
});
