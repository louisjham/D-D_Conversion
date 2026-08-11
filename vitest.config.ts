import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["packages/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@grimoire3d/ir": path.resolve(__dirname, "./packages/ir/src/index.ts"),
      "@grimoire3d/validator": path.resolve(__dirname, "./packages/validator/src/index.ts"),
      "@grimoire3d/rules-core": path.resolve(__dirname, "./packages/rules-core/src/index.ts"),
      "@grimoire3d/simulator": path.resolve(__dirname, "./packages/simulator/src/index.ts"),
      "@grimoire3d/fixtures": path.resolve(__dirname, "./packages/fixtures/src/index.ts"),
      "@grimoire3d/importers": path.resolve(__dirname, "./packages/importers/src/index.ts"),
      "@grimoire3d/save-format": path.resolve(__dirname, "./packages/save-format/src/index.ts"),
      "@grimoire3d/world-compiler": path.resolve(__dirname, "./packages/world-compiler/src/index.ts"),
      "@grimoire3d/ui-editor": path.resolve(__dirname, "./packages/ui-editor/src/index.ts"),
      "@grimoire3d/runtime-babylon": path.resolve(__dirname, "./packages/runtime-babylon/src/index.ts"),
      "@grimoire3d/campaign-ir": path.resolve(__dirname, "./packages/campaign-ir/src/index.ts"),
      "@grimoire3d/economy-core": path.resolve(__dirname, "./packages/economy-core/src/index.ts"),
      "@grimoire3d/faction-director": path.resolve(__dirname, "./packages/faction-director/src/index.ts"),
      "@grimoire3d/campaign-simulator": path.resolve(__dirname, "./packages/campaign-simulator/src/index.ts"),
      "@grimoire3d/fixtures-campaign": path.resolve(__dirname, "./packages/fixtures-campaign/src/index.ts"),
      "@grimoire3d/ui-campaign": path.resolve(__dirname, "./packages/ui-campaign/src/index.ts"),
      "@grimoire3d/visual-logic": path.resolve(__dirname, "./packages/visual-logic/src/index.ts"),
      "@grimoire3d/spell-core": path.resolve(__dirname, "./packages/spell-core/src/index.ts"),
      "@grimoire3d/dialogue-engine": path.resolve(__dirname, "./packages/dialogue-engine/src/index.ts"),
      "@grimoire3d/procedural-generator": path.resolve(__dirname, "./packages/procedural-generator/src/index.ts"),
    },
  },
});
