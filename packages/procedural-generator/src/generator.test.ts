import { describe, it, expect } from "vitest";
import { ProceduralGenerator } from "./index";
import { validateAdventure } from "@grimoire3d/validator";
import { WorldCompiler } from "@grimoire3d/world-compiler";
import { SimulatorEngine } from "@grimoire3d/simulator";

describe("@grimoire3d/procedural-generator — AI/Algorithmic Generator Test Suite", () => {
  it("1. Generates 10-room procedural dungeon with key/lock & boss room", () => {
    const vAdv = ProceduralGenerator.generateAdventure({
      seed: 42,
      title: "The Forgotten Caverns",
      theme: "cavern-complex",
      roomCount: 10,
      targetPartyLevel: 3,
      includeBossRoom: true,
      includeKeyLockPuzzle: true,
    });

    expect(vAdv.adventure.id).toBe("proc-dungeon-42");
    expect(vAdv.adventure.locations.length).toBe(11); // 10 rooms + 1 escape tunnel

    // Audit with validator
    const audit = validateAdventure(vAdv);
    expect(audit.valid).toBe(true);
    expect(audit.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("2. Compiles generated adventure spatial layout via WorldCompiler", () => {
    const vAdv = ProceduralGenerator.generateAdventure({ seed: 100, roomCount: 8 });
    const layout = WorldCompiler.compile(vAdv);

    expect(layout.rooms.length).toBeGreaterThan(8);
    expect(layout.portals.length).toBeGreaterThan(6);
  });

  it("3. Simulates player traversal through generated procedural dungeon", () => {
    const vAdv = ProceduralGenerator.generateAdventure({ seed: 777, roomCount: 6 });
    const engine = new SimulatorEngine(vAdv, 777);

    expect(engine.state.currentLocationId).toBe("proc-start");

    // Move to next room
    const res = engine.executeAction({ kind: "move", direction: "north" });
    expect(res.success).toBe(true);
    expect(engine.state.currentLocationId).toBe("proc-room-1");
  });

  it("4. Generates procedural dungeons across all theme biomes", () => {
    const themes = ["classic-dungeon", "cavern-complex", "ancient-crypt", "keep-fortress"] as const;

    for (const theme of themes) {
      const vAdv = ProceduralGenerator.generateAdventure({ seed: 123, theme, roomCount: 5 });
      const audit = validateAdventure(vAdv);
      expect(audit.valid).toBe(true);
    }
  });
});
