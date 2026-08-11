import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@grimoire3d/ir": path.resolve(__dirname, "../../packages/ir/src/index.ts"),
      "@grimoire3d/validator": path.resolve(__dirname, "../../packages/validator/src/index.ts"),
      "@grimoire3d/rules-core": path.resolve(__dirname, "../../packages/rules-core/src/index.ts"),
      "@grimoire3d/simulator": path.resolve(__dirname, "../../packages/simulator/src/index.ts"),
      "@grimoire3d/fixtures": path.resolve(__dirname, "../../packages/fixtures/src/index.ts"),
      "@grimoire3d/importers": path.resolve(__dirname, "../../packages/importers/src/index.ts"),
      "@grimoire3d/ui-editor": path.resolve(__dirname, "../../packages/ui-editor/src/index.ts"),
      "@grimoire3d/runtime-babylon": path.resolve(__dirname, "../../packages/runtime-babylon/src/index.ts"),
      "@grimoire3d/campaign-ir": path.resolve(__dirname, "../../packages/campaign-ir/src/index.ts"),
      "@grimoire3d/economy-core": path.resolve(__dirname, "../../packages/economy-core/src/index.ts"),
      "@grimoire3d/faction-director": path.resolve(__dirname, "../../packages/faction-director/src/index.ts"),
      "@grimoire3d/campaign-simulator": path.resolve(__dirname, "../../packages/campaign-simulator/src/index.ts"),
      "@grimoire3d/fixtures-campaign": path.resolve(__dirname, "../../packages/fixtures-campaign/src/index.ts"),
      "@grimoire3d/ui-campaign": path.resolve(__dirname, "../../packages/ui-campaign/src/index.ts"),
      "@grimoire3d/visual-logic": path.resolve(__dirname, "../../packages/visual-logic/src/index.ts"),
      "@grimoire3d/spell-core": path.resolve(__dirname, "../../packages/spell-core/src/index.ts"),
      "@grimoire3d/dialogue-engine": path.resolve(__dirname, "../../packages/dialogue-engine/src/index.ts"),
      "@grimoire3d/procedural-generator": path.resolve(__dirname, "../../packages/procedural-generator/src/index.ts"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("@babylonjs")) {
            return "vendor-babylon-3d";
          }
          if (id.includes("node_modules/lucide-react") || id.includes("node_modules/zod")) {
            return "vendor-core-utils";
          }
        },
      },
    },
  },
});
