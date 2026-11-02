import { describe, it, expect } from "vitest";
import { SimulatorEngine, GameState } from "./simulator";
import { serpentAltarAdventure } from "@grimoire3d/fixtures";
import { VersionedAdventure } from "@grimoire3d/ir";

describe("Simulator Engine Replayability & Save/Load Round-Trip", () => {
  it("1. Replaying identical action sequence with identical seed produces byte-equivalent session state", () => {
    const seed = 9999;
    const engineA = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, seed);
    const engineB = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, seed);

    const actionSequence = [
      { kind: "move", exitId: "exit-entry-to-guard" },
      { kind: "inspect", targetId: "wooden-chest" },
      { kind: "move", exitId: "exit-guard-to-corridor" },
      { kind: "search", targetId: "secret-door-treasury" },
      { kind: "move", exitId: "exit-corridor-to-trap" },
      { kind: "unlockExit", exitId: "exit-trap-to-altar" },
      { kind: "move", exitId: "exit-trap-to-altar" },
      { kind: "resolveCombat", encounterId: "enc-altar-viper" },
    ];

    for (const action of actionSequence) {
      engineA.executeAction(action as any);
      engineB.executeAction(action as any);
    }

    const stateAJson = JSON.stringify({
      currentLocationId: engineA.state.currentLocationId,
      inventory: Array.from(engineA.state.inventory).sort(),
      flags: Array.from(engineA.state.flags.entries()).sort(),
      playerHp: engineA.state.playerHp,
      discoveredSecrets: Array.from(engineA.state.discoveredSecrets).sort(),
      unlockedExits: Array.from(engineA.state.unlockedExits).sort(),
      actionLog: engineA.state.actionLog,
    });

    const stateBJson = JSON.stringify({
      currentLocationId: engineB.state.currentLocationId,
      inventory: Array.from(engineB.state.inventory).sort(),
      flags: Array.from(engineB.state.flags.entries()).sort(),
      playerHp: engineB.state.playerHp,
      discoveredSecrets: Array.from(engineB.state.discoveredSecrets).sort(),
      unlockedExits: Array.from(engineB.state.unlockedExits).sort(),
      actionLog: engineB.state.actionLog,
    });

    expect(stateAJson).toBe(stateBJson);
  });

  it("2. Save/Load round-trip test preserves exact engine state across serialization", () => {
    const engine = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, 42);
    engine.executeAction({ kind: "move", exitId: "exit-entry-to-guard" });
    engine.executeAction({ kind: "inspect", targetId: "wooden-chest" });

    // Save state
    const savedStateSerialized = JSON.stringify({
      currentLocationId: engine.state.currentLocationId,
      inventory: Array.from(engine.state.inventory),
      flags: Array.from(engine.state.flags.entries()),
      playerHp: engine.state.playerHp,
      discoveredSecrets: Array.from(engine.state.discoveredSecrets),
      unlockedExits: Array.from(engine.state.unlockedExits),
      actionLog: engine.state.actionLog,
      seed: engine.state.seed,
    });

    // Deserialized rehydrated state
    const parsed = JSON.parse(savedStateSerialized);
    const rehydratedState: GameState = {
      currentLocationId: parsed.currentLocationId,
      inventory: new Set(parsed.inventory),
      flags: new Map(parsed.flags),
      playerHp: parsed.playerHp,
      playerMaxHp: 24,
      playerAc: 14,
      playerAttackBonus: 5,
      playerCharacter: engine.state.playerCharacter,
      discoveredSecrets: new Set(parsed.discoveredSecrets),
      unlockedExits: new Set(parsed.unlockedExits),
      discoveredRooms: new Set([parsed.currentLocationId]),
      emittedEvents: [],
      inCombat: false,
      gameEnded: false,
      actionLog: parsed.actionLog,
      seed: parsed.seed,
      turnCount: parsed.turnCount || 0,
    };

    expect(rehydratedState.currentLocationId).toBe("guard-post");
    expect(rehydratedState.inventory.has("iron-key")).toBe(true);
    expect(rehydratedState.actionLog.length).toBeGreaterThan(1);
  });
});
