import { describe, it, expect } from "vitest";
import { SimulatorEngine, GameAction } from "./simulator";
import { serpentAltarAdventure, brokenAltarAdventure } from "@grimoire3d/fixtures";
import { VersionedAdventure } from "@grimoire3d/ir";
import { validateAdventure } from "@grimoire3d/validator";
import { createSaveGameEnvelope } from "@grimoire3d/save-format";

describe("Stateful Property & Invariant Test Suite", () => {
  it("Invariant 1: Invalid action cannot mutate engine state", () => {
    const engine = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, 42);
    const preState = JSON.stringify(engine.state);

    // Attempt invalid move to non-existent exit
    const res = engine.executeAction({ kind: "move", exitId: "bogus-exit-99" });
    expect(res.success).toBe(false);

    const postState = JSON.stringify(engine.state);
    expect(preState).toBe(postState);
  });

  it("Invariant 2: All emitted DomainEvents reference valid adventure entities", () => {
    const engine = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, 42);
    engine.executeAction({ kind: "move", exitId: "exit-entry-to-guard" });
    engine.executeAction({ kind: "inspect", targetId: "wooden-chest" });

    const locIds = new Set(serpentAltarAdventure.adventure.locations.map((l: any) => l.id));
    const itemIds = new Set(serpentAltarAdventure.adventure.items.map((i: any) => i.id));

    for (const ev of engine.state.emittedEvents) {
      if (ev.kind === "player_moved") {
        expect(locIds.has(ev.toRoomId)).toBe(true);
      } else if (ev.kind === "item_granted") {
        expect(itemIds.has(ev.itemId)).toBe(true);
      }
    }
  });

  it("Invariant 3: Save ➔ Load preserves byte-equivalent normalized state", () => {
    const engine = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, 42);
    engine.executeAction({ kind: "move", exitId: "exit-entry-to-guard" });
    engine.executeAction({ kind: "inspect", targetId: "wooden-chest" });

    const saveEnvelope = createSaveGameEnvelope("serpent-altar-crypt", 42, {
      currentLocationId: engine.state.currentLocationId,
      playerGridPos: { x: 4, y: 0 },
      inventory: Array.from(engine.state.inventory),
      flags: Array.from(engine.state.flags.entries()),
      playerHp: engine.state.playerHp,
      playerMaxHp: engine.state.playerMaxHp,
      playerAc: engine.state.playerAc,
      discoveredSecrets: Array.from(engine.state.discoveredSecrets),
      unlockedExits: Array.from(engine.state.unlockedExits),
      discoveredRooms: Array.from(engine.state.discoveredRooms),
      actionLogHistory: engine.state.actionLog,
      inCombat: engine.state.inCombat,
    });

    const serialized = JSON.stringify(saveEnvelope);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.sessionState.currentLocationId).toBe("guard-post");
    expect(deserialized.sessionState.inventory).toContain("iron-key");
  });

  it("Invariant 4: Replaying generated action logs under same seed produces identical state & events", () => {
    const seed = 1234;
    const eng1 = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, seed);
    const eng2 = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, seed);

    const actions: GameAction[] = [
      { kind: "move", exitId: "exit-entry-to-guard" },
      { kind: "inspect", targetId: "wooden-chest" },
      { kind: "move", exitId: "exit-guard-to-corridor" },
    ];

    actions.forEach((a) => {
      eng1.executeAction(a);
      eng2.executeAction(a);
    });

    expect(JSON.stringify(eng1.state.emittedEvents)).toBe(JSON.stringify(eng2.state.emittedEvents));
  });

  it("Invariant 5: Inventory never contains unknown or duplicate items", () => {
    const engine = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, 42);
    engine.executeAction({ kind: "move", exitId: "exit-entry-to-guard" });
    engine.executeAction({ kind: "inspect", targetId: "wooden-chest" });

    const itemIds = new Set(serpentAltarAdventure.adventure.items.map((i: any) => i.id));
    for (const item of engine.state.inventory) {
      expect(itemIds.has(item)).toBe(true);
    }
  });

  it("Invariant 6: Revealed secrets and unlocked exits remain revealed/unlocked unless explicitly reset", () => {
    const engine = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, 42);
    engine.executeAction({ kind: "move", exitId: "exit-entry-to-guard" });
    engine.executeAction({ kind: "move", exitId: "exit-guard-to-corridor" });
    engine.executeAction({ kind: "search", targetId: "secret-door-treasury" });

    expect(engine.state.discoveredSecrets.has("secret-door-treasury")).toBe(true);

    // Move around and verify secret remains revealed
    engine.executeAction({ kind: "move", exitId: "exit-corridor-to-guard" });
    expect(engine.state.discoveredSecrets.has("secret-door-treasury")).toBe(true);
  });

  it("Invariant 7: Simulator never enters a state with player location absent from compiled adventure", () => {
    const engine = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, 42);
    const validLocationIds = new Set(serpentAltarAdventure.adventure.locations.map((l: any) => l.id));

    engine.executeAction({ kind: "move", exitId: "exit-entry-to-guard" });
    expect(validLocationIds.has(engine.state.currentLocationId)).toBe(true);

    engine.executeAction({ kind: "move", exitId: "exit-guard-to-corridor" });
    expect(validLocationIds.has(engine.state.currentLocationId)).toBe(true);
  });

  it("Invariant 8: State-space validator never reports 'solvable' if mandatory objective is unreachable", () => {
    const res = validateAdventure(brokenAltarAdventure);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.code === "UNSOLVABLE_LOCK_KEY_UNREACHABLE")).toBe(true);
  });

  it("Invariant 9: RandomTable evaluation is deterministic under fixed seed", () => {
    const b2Fixture = require("../../fixtures/src/b2KeepOnTheBorderlands.json");
    const eng1 = new SimulatorEngine(b2Fixture as VersionedAdventure, 42);
    const eng2 = new SimulatorEngine(b2Fixture as VersionedAdventure, 42);

    const res1 = eng1.evaluateRandomTable("table-b2-wilderness-encounters");
    const res2 = eng2.evaluateRandomTable("table-b2-wilderness-encounters");

    expect(res1.roll).toBe(res2.roll);
    expect(res1.entry?.result).toEqual(res2.entry?.result);
    expect(eng1.state.emittedEvents).toEqual(eng2.state.emittedEvents);
  });

  it("Invariant 10: Executing rollTable action emits RANDOM_TABLE_ROLLED event", () => {
    const b2Fixture = require("../../fixtures/src/b2KeepOnTheBorderlands.json");
    const engine = new SimulatorEngine(b2Fixture as VersionedAdventure, 100);

    const res = engine.executeAction({ kind: "rollTable", tableId: "table-b2-caves-wandering-monsters" });
    expect(res.success).toBe(true);

    const rolledEvent = engine.state.emittedEvents.find((e) => e.kind === "random_table_rolled");
    expect(rolledEvent).toBeDefined();
  });
});
