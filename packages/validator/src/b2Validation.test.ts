import { describe, it, expect } from "vitest";
import { validateAdventure } from "@grimoire3d/validator";
import { b2KeepOnTheBorderlands } from "@grimoire3d/fixtures";
import { VersionedAdventure } from "@grimoire3d/ir";
import { SimulatorEngine } from "@grimoire3d/simulator";
import { WorldCompiler } from "@grimoire3d/world-compiler";

describe("B2: The Keep on the Borderlands IR Validation & Simulation", () => {
  it("1. Validates b2KeepOnTheBorderlands IR JSON schema and solvability", () => {
    const result = validateAdventure(b2KeepOnTheBorderlands as VersionedAdventure);
    expect(result.valid).toBe(true);
    const errors = result.issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("2. Compiles B2 spatial layout via WorldCompiler", () => {
    const layout = WorldCompiler.compile(b2KeepOnTheBorderlands as VersionedAdventure);
    expect(layout.rooms.length).toBeGreaterThan(30);
    const mainGate = layout.rooms.find((r) => r.id === "keep-main-gate");
    expect(mainGate).toBeDefined();
    expect(mainGate?.label).toContain("Main Gate");
  });

  it("3. Simulates player traversal from Main Gate to Castellan Chamber and Caves of Chaos", () => {
    const engine = new SimulatorEngine(b2KeepOnTheBorderlands as VersionedAdventure, 42);
    expect(engine.state.currentLocationId).toBe("keep-main-gate");

    // Move to Entry Yard
    let res = engine.executeAction({ kind: "move", direction: "north" });
    expect(res.success).toBe(true);
    expect(engine.state.currentLocationId).toBe("keep-entry-yard");

    // Visit Tavern
    res = engine.executeAction({ kind: "move", direction: "east" });
    expect(res.success).toBe(true);
    expect(engine.state.currentLocationId).toBe("keep-tavern");

    // Inspect Notice Board to hear rumor
    res = engine.executeAction({ kind: "inspect", targetId: "rumor-board" });
    expect(res.success).toBe(true);
    expect(engine.state.flags.get("heard-caves-rumor")).toBe(true);
  });

  it("4. Simulates traversal into Goblin Lair (Cave C) and Hobgoblin Armory (Cave D)", () => {
    const engine = new SimulatorEngine(b2KeepOnTheBorderlands as VersionedAdventure, 42);
    // Directly place player at Ravine Entrance
    engine.state.currentLocationId = "wild-ravine-entrance";

    // Enter Cave C (Goblin Lair Entrance)
    let res = engine.executeAction({ kind: "move", direction: "south" });
    expect(res.success).toBe(true);
    expect(engine.state.currentLocationId).toBe("cave-c-entrance");

    // Move to Goblin Guard Room
    res = engine.executeAction({ kind: "move", direction: "west" });
    expect(res.success).toBe(true);
    expect(engine.state.currentLocationId).toBe("cave-c-guard");

    // Return to Ravine Entrance
    engine.executeAction({ kind: "move", direction: "east" });
    engine.executeAction({ kind: "move", direction: "north" });
    expect(engine.state.currentLocationId).toBe("wild-ravine-entrance");

    // Enter Cave D (Hobgoblin Entrance)
    res = engine.executeAction({ kind: "move", direction: "up" });
    expect(res.success).toBe(true);
    expect(engine.state.currentLocationId).toBe("cave-d-entrance");
  });

  it("5. Verifies PHB player actions and DMG world boundaries in B2", () => {
    const engine = new SimulatorEngine(b2KeepOnTheBorderlands as VersionedAdventure, 42);

    // --- PHB Action 1: Listen at Door ---
    // Start at Entry Yard
    engine.state.currentLocationId = "keep-entry-yard";
    let listenRes = engine.executeAction({ kind: "listen", direction: "east" });
    expect(listenRes.success).toBe(true);
    expect(listenRes.message).toMatch(/Lively fiddle tunes|discern only silence/);

    // --- PHB Action 2 & DMG Boundary: Safe Haven Rest vs Dungeon Rest ---
    // Resting in the Keep is safe
    engine.state.playerHp = 10;
    let restRes = engine.executeAction({ kind: "rest" });
    expect(restRes.success).toBe(true);
    expect(engine.state.playerHp).toBe(18); // Healed +8

    // Move to Cave C Guard Room
    engine.state.currentLocationId = "cave-c-guard";

    // --- PHB Action 3 & DMG Boundary: Stuck Door & Force Door ---
    // Moving west to Goblin Chieftain initially fails because door is stuck
    let moveRes = engine.executeAction({ kind: "move", direction: "west" });
    expect(moveRes.success).toBe(false);
    expect(moveRes.message).toContain("stuck");

    // Listen at the stuck chieftain door first
    listenRes = engine.executeAction({ kind: "listen", direction: "west" });
    expect(listenRes.success).toBe(true);
    expect(listenRes.message).toMatch(/Angry goblin squeals|discern only silence/);

    // Force open the stuck door
    const forceRes = engine.executeAction({ kind: "forceDoor", direction: "west" });
    expect(forceRes.success).toBe(true);
    expect(forceRes.message).toContain("Battered open door");

    // Now moving west succeeds!
    moveRes = engine.executeAction({ kind: "move", direction: "west" });
    expect(moveRes.success).toBe(true);
    expect(engine.state.currentLocationId).toBe("cave-c-chieftain");

    // --- PHB Action 4: Social Parley with Encounter ---
    const parleyRes = engine.executeAction({ kind: "parley" });
    expect(parleyRes).toBeDefined();

    // --- PHB Action 5: Search for Traps & Hazards ---
    engine.state.currentLocationId = "cave-a-pit-trap";
    const trapRes = engine.executeAction({ kind: "searchTraps" });
    expect(trapRes.success).toBe(true);
    expect(trapRes.message).toMatch(/10-foot covered pit trap|No active triggers or pitfalls detected/);
  });
});
