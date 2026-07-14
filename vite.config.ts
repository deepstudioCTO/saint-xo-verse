import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    tailwindcss(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    reactRouter(),
    tsconfigPaths(),
  ],
  // React를 단일 인스턴스로 강제 (미설정 시 @xyflow/react가 별도 React 사본을
  // pre-bundle하여 노드 에디터에서 "Invalid hook call / useState null" 크래시 발생)
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@xyflow/react"],
  },
});
