import { describe, it, expect } from "vitest";
import { ProceduralGenerator, TopologyPattern, GENERATOR_VERSION } from "./index";
import { validateAdventure } from "@grimoire3d/validator";
import { WorldCompiler } from "@grimoire3d/world-compiler";
import { SimulatorEngine } from "@grimoire3d/simulator";
import { solveAdventure } from "@grimoire3d/solver";

describe("@grimoire3d/procedural-generator — Constraint-Based Topology Generator", () => {
  it("1. Generates 10 dungeons with the same seed -> byte-identical JSON", () => {
    const seed = 42;
    const firstJson = JSON.stringify(
      ProceduralGenerator.generateAdventure({ seed, roomCount: 10 })
    );

    for (let i = 0; i < 9; i++) {
      const json = JSON.stringify(
        ProceduralGenerator.generateAdventure({ seed, roomCount: 10 })
      );
      expect(json).toBe(firstJson);
    }
  });

  it("2. Key is always reachable before locked door and dungeon is SOLVABLE via solver", () => {
    const vAdv = ProceduralGenerator.generateAdventure({
      seed: 1234,
      roomCount: 10,
      includeKeyLockPuzzle: true,
      includeBossRoom: true,
      topologyPattern: "hub-and-spoke",
    });

    const result = solveAdventure(vAdv, {
      maxDepth: 50,
      maxStates: 2000,
      seed: 42,
    });

    expect(result.status).toBe("SOLVABLE");
    expect(result.solved).toBe(true);
    expect(result.shortestPath.length).toBeGreaterThan(0);

    // Verify key was collected in final state inventory
    expect(result.finalState?.inventory.has("brass-key")).toBe(true);
  });

  it("3. No generated dungeon is a pure linear chain (assert min branching factor & loops)", () => {
    const patterns: TopologyPattern[] = [
      "hub-and-spoke",
      "linear-with-loopback",
      "branching-with-bottleneck",
      "b2-hybrid",
    ];

    for (const pattern of patterns) {
      const vAdv = ProceduralGenerator.generateAdventure({
        seed: 777,
        roomCount: 10,
        topologyPattern: pattern,
      });

      const locs = vAdv.adventure.locations.filter((l) => l.id !== "escape-tunnel");
      const degrees = locs.map((l) => l.exits.length);

      // Min branching: at least one room must have degree >= 3 (a hub/fork)
      const maxDegree = Math.max(...degrees);
      expect(maxDegree).toBeGreaterThanOrEqual(3);

      // Total directed exits across rooms: in a pure chain of N rooms, total exits <= 2*(N-1)
      // With cycles/loopbacks, total exits must exceed a simple tree
      const totalExits = degrees.reduce((a, b) => a + b, 0);
      expect(totalExits).toBeGreaterThanOrEqual(locs.length * 2);

      // Assert at least one secret bypass or loop exists
      const hasSecretOrLoop = locs.some(
        (l) => l.secrets.length > 0 || l.presentation?.ambienceTags?.includes("hub")
      );
      expect(hasSecretOrLoop).toBe(true);
    }
  });

  it("4. Boss room is at maximum graph depth from entrance", () => {
    const patterns: TopologyPattern[] = [
      "hub-and-spoke",
      "linear-with-loopback",
      "branching-with-bottleneck",
    ];

    for (const pattern of patterns) {
      const vAdv = ProceduralGenerator.generateAdventure({
        seed: 888,
        roomCount: 10,
        topologyPattern: pattern,
      });

      const locMap = new Map(vAdv.adventure.locations.map((l) => [l.id, l]));

      // BFS depth from proc-start
      const depth = new Map<string, number>([["proc-start", 0]]);
      const q = ["proc-start"];

      while (q.length > 0) {
        const curr = q.shift()!;
        const d = depth.get(curr)!;
        const loc = locMap.get(curr);
        if (!loc) continue;

        for (const exit of loc.exits) {
          if (exit.target === "escape-tunnel") continue;
          if (!depth.has(exit.target)) {
            depth.set(exit.target, d + 1);
            q.push(exit.target);
          }
        }
      }

      const allDepths = Array.from(depth.values());
      const maxDepth = Math.max(...allDepths);
      const bossDepth = depth.get("proc-boss-room");

      expect(bossDepth).toBeDefined();
      expect(bossDepth).toBe(maxDepth);
    }
  });

  it("5. Assigns proper room roles across generated topology", () => {
    const vAdv = ProceduralGenerator.generateAdventure({
      seed: 555,
      roomCount: 10,
      topologyPattern: "hub-and-spoke",
    });

    const tags = vAdv.adventure.locations.flatMap(
      (l) => l.presentation?.ambienceTags || []
    );

    expect(tags).toContain("entrance");
    expect(tags).toContain("hub");
    expect(tags).toContain("puzzle");
    expect(tags).toContain("boss");
    expect(tags).toContain("treasure");
  });

  it("6. Compiles spatial layout via WorldCompiler and validates IR", () => {
    const vAdv = ProceduralGenerator.generateAdventure({ seed: 999, roomCount: 8 });
    const audit = validateAdventure(vAdv);
    expect(audit.valid).toBe(true);

    const layout = WorldCompiler.compile(vAdv);
    expect(layout.rooms.length).toBeGreaterThan(8);
    expect(layout.portals.length).toBeGreaterThan(6);
  });

  it("7. Generated entities have provenance.extraction.method === 'procedural' and match input seed", () => {
    const seed = 4242;
    const vAdv = ProceduralGenerator.generateAdventure({ seed, roomCount: 10, includeKeyLockPuzzle: true });

    // 1. Locations and their sub-entities
    expect(vAdv.adventure.locations.length).toBeGreaterThan(0);
    for (const loc of vAdv.adventure.locations) {
      expect(loc.provenance).toBeDefined();
      expect(loc.provenance?.extraction.method).toBe("procedural");
      expect(loc.provenance?.extraction.generator?.seed).toBe(seed);
      expect(loc.provenance?.extraction.generator?.version).toBe(GENERATOR_VERSION);

      // Exits on each location
      for (const exit of loc.exits) {
        expect(exit.provenance).toBeDefined();
        expect(exit.provenance?.extraction.method).toBe("procedural");
        expect(exit.provenance?.extraction.generator?.seed).toBe(seed);
        expect(exit.provenance?.extraction.generator?.version).toBe(GENERATOR_VERSION);
      }

      // Interactables
      for (const inter of loc.interactables) {
        expect(inter.provenance).toBeDefined();
        expect(inter.provenance?.extraction.method).toBe("procedural");
        expect(inter.provenance?.extraction.generator?.seed).toBe(seed);
      }

      // Secrets
      for (const secret of loc.secrets) {
        expect(secret.provenance).toBeDefined();
        expect(secret.provenance?.extraction.method).toBe("procedural");
        expect(secret.provenance?.extraction.generator?.seed).toBe(seed);
      }
    }

    // 2. Items
    expect(vAdv.adventure.items.length).toBeGreaterThan(0);
    for (const item of vAdv.adventure.items) {
      expect(item.provenance).toBeDefined();
      expect(item.provenance?.extraction.method).toBe("procedural");
      expect(item.provenance?.extraction.generator?.seed).toBe(seed);
      expect(item.provenance?.extraction.generator?.version).toBe(GENERATOR_VERSION);
    }

    // 3. Monsters
    expect(vAdv.adventure.monsters.length).toBeGreaterThan(0);
    for (const monster of vAdv.adventure.monsters) {
      expect(monster.provenance).toBeDefined();
      expect(monster.provenance?.extraction.method).toBe("procedural");
      expect(monster.provenance?.extraction.generator?.seed).toBe(seed);
      expect(monster.provenance?.extraction.generator?.version).toBe(GENERATOR_VERSION);
    }
  });
});
