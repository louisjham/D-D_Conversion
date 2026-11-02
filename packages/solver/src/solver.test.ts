import { describe, it, expect } from "vitest";
import { VersionedAdventure } from "@grimoire3d/ir";
import { SimulatorEngine, cloneGameState } from "@grimoire3d/simulator";
import {
  b2KeepOnTheBorderlands,
  brokenAltarAdventure,
  serpentAltarAdventure,
} from "@grimoire3d/fixtures";
import {
  solveAdventure,
  hashState,
  enumerateLegalActions,
  isQuestComplete,
} from "./index";

describe("@grimoire3d/solver — BFS State-Space Solver Suite", () => {
  it("1. GameState.clone() creates an isolated deep copy of all required state elements", () => {
    const engine = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, 42);
    engine.state.flags.set("test-flag", true);
    engine.state.inventory.add("test-key");
    engine.state.discoveredSecrets.add("secret-1");
    engine.state.unlockedExits.add("exit-1");
    engine.state.playerHp = 20;

    const cloned = engine.state.clone ? engine.state.clone() : cloneGameState(engine.state);

    // Verify deep copy values
    expect(cloned.currentLocationId).toBe(engine.state.currentLocationId);
    expect(cloned.flags.get("test-flag")).toBe(true);
    expect(cloned.inventory.has("test-key")).toBe(true);
    expect(cloned.discoveredSecrets.has("secret-1")).toBe(true);
    expect(cloned.unlockedExits.has("exit-1")).toBe(true);
    expect(cloned.playerHp).toBe(20);

    // Mutate cloned and assert original is completely untouched
    cloned.currentLocationId = "mutated-room";
    cloned.flags.set("test-flag", false);
    cloned.flags.set("cloned-only-flag", true);
    cloned.inventory.add("cloned-only-item");
    cloned.discoveredSecrets.add("secret-2");
    cloned.unlockedExits.add("exit-2");
    cloned.playerHp = 5;

    expect(engine.state.currentLocationId).not.toBe("mutated-room");
    expect(engine.state.flags.get("test-flag")).toBe(true);
    expect(engine.state.flags.has("cloned-only-flag")).toBe(false);
    expect(engine.state.inventory.has("cloned-only-item")).toBe(false);
    expect(engine.state.discoveredSecrets.has("secret-2")).toBe(false);
    expect(engine.state.unlockedExits.has("exit-2")).toBe(false);
    expect(engine.state.playerHp).toBe(20);
  });

  it("2. hashState() produces deterministic hash with HP bucketing and sorted elements", () => {
    const engine1 = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, 42);
    engine1.state.flags.set("b", true);
    engine1.state.flags.set("a", true);
    engine1.state.inventory.add("key-z");
    engine1.state.inventory.add("key-a");
    engine1.state.playerHp = 23;

    const engine2 = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, 42);
    engine2.state.flags.set("a", true);
    engine2.state.flags.set("b", true);
    engine2.state.inventory.add("key-a");
    engine2.state.inventory.add("key-z");
    // HP 22 is in the same bucket as 23 when bucketSize = 5 (ceil(23/5)=5, ceil(22/5)=5)
    engine2.state.playerHp = 22;

    const hash1 = hashState(engine1.state, 5);
    const hash2 = hashState(engine2.state, 5);

    expect(hash1).toBe(hash2);

    // When HP drops to bucket 3 (e.g. HP 12, ceil(12/5)=3), hash changes
    engine2.state.playerHp = 12;
    const hash3 = hashState(engine2.state, 5);
    expect(hash3).not.toBe(hash1);
  });

  it("3. Deliberately broken fixture proves UNSOLVABLE with correct dead-end identified", () => {
    const result = solveAdventure(brokenAltarAdventure as VersionedAdventure, {
      maxDepth: 20,
      maxStates: 500,
      seed: 42,
    });

    expect(result.status).toBe("UNSOLVABLE");
    expect(result.solved).toBe(false);
    expect(result.shortestPath).toEqual([]);
    expect(result.deadEnds.length).toBeGreaterThan(0);

    // The dead-end must be identified at 'entry-room'
    const entryDeadEnd = result.deadEnds.find((d) => d.locationId === "entry-room");
    expect(entryDeadEnd).toBeDefined();
    expect(entryDeadEnd?.locationId).toBe("entry-room");
  });

  it("4. B2 Keep on the Borderlands fixture proves SOLVABLE", () => {
    const result = solveAdventure(b2KeepOnTheBorderlands as VersionedAdventure, {
      maxDepth: 50,
      maxStates: 5000,
      seed: 42,
    });

    expect(result.status).toBe("SOLVABLE");
    expect(result.solved).toBe(true);
    expect(result.shortestPath.length).toBeGreaterThan(0);
    expect(result.finalState).toBeDefined();

    // Verify quest flags in final state
    expect(result.finalState?.flags.get("high-priest-defeated")).toBe(true);
    expect(result.finalState?.flags.get("caves-cleared")).toBe(true);
  });

  it("5. Serpent Altar Crypt fixture proves SOLVABLE", () => {
    const result = solveAdventure(serpentAltarAdventure as VersionedAdventure, {
      maxDepth: 50,
      maxStates: 3000,
      seed: 42,
    });

    expect(result.status).toBe("SOLVABLE");
    expect(result.solved).toBe(true);
    expect(result.shortestPath.length).toBeGreaterThan(0);
    expect(result.finalState?.flags.get("escaped-crypt")).toBe(true);
  });
});
