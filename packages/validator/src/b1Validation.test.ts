import { describe, it, expect } from "vitest";
import { validateAdventure } from "@grimoire3d/validator";
import { b1InSearchOfTheUnknown } from "@grimoire3d/fixtures";
import { VersionedAdventure } from "@grimoire3d/ir";
import { SimulatorEngine } from "@grimoire3d/simulator";
import { WorldCompiler } from "@grimoire3d/world-compiler";

describe("B1: In Search of the Unknown IR Validation & Simulation", () => {
  it("1. Validates b1InSearchOfTheUnknown IR JSON schema and solvability", () => {
    const result = validateAdventure(b1InSearchOfTheUnknown as VersionedAdventure);
    const errors = result.issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
    expect(result.valid).toBe(true);
  });

  it("2. Compiles B1 spatial layout via WorldCompiler", () => {
    const layout = WorldCompiler.compile(b1InSearchOfTheUnknown as VersionedAdventure);
    expect(layout.rooms.length).toBe(13);

    const entrance = layout.rooms.find((r) => r.id === "b1-entrance-alcoves");
    expect(entrance).toBeDefined();
    expect(entrance?.label).toContain("Entrance & Alcoves");

    const library = layout.rooms.find((r) => r.id === "b1-library");
    expect(library).toBeDefined();
    expect(library?.label).toContain("Quasqueton Great Library");
  });

  it("3. Simulates full quest walkthrough: retrieve bronze key and breach Great Library", () => {
    const engine = new SimulatorEngine(b1InSearchOfTheUnknown as VersionedAdventure, 42);
    expect(engine.state.currentLocationId).toBe("b1-entrance-alcoves");

    // Inspect dead adventurers
    let res = engine.executeAction({ kind: "inspect", targetId: "slain-adventurers" });
    expect(res.success).toBe(true);
    expect(engine.state.inventory.has("adventurer-pouch-5gp")).toBe(true);
    expect(engine.state.flags.get("read-quasqueton-name")).toBe(true);

    // Navigate to Dining Room -> Lounge -> Wizard's Chamber -> Closet
    res = engine.executeAction({ kind: "move", direction: "north" });
    expect(res.success).toBe(true);
    expect(engine.state.currentLocationId).toBe("b1-dining-room");

    res = engine.executeAction({ kind: "move", direction: "west" });
    expect(res.success).toBe(true);
    expect(engine.state.currentLocationId).toBe("b1-lounge");

    res = engine.executeAction({ kind: "move", direction: "north" });
    expect(res.success).toBe(true);
    expect(engine.state.currentLocationId).toBe("b1-wizards-chamber");

    res = engine.executeAction({ kind: "move", direction: "west" });
    expect(res.success).toBe(true);
    expect(engine.state.currentLocationId).toBe("b1-wizards-closet");

    // Inspect strongbox to gain the bronze library key
    res = engine.executeAction({ kind: "inspect", targetId: "wardrobe-strongbox" });
    expect(res.success).toBe(true);
    expect(engine.state.inventory.has("bronze-library-key")).toBe(true);

    // Return to Dining Room -> Alcoves -> East Hallway
    engine.executeAction({ kind: "move", direction: "east" }); // back to chamber
    engine.executeAction({ kind: "move", direction: "south" }); // back to lounge
    engine.executeAction({ kind: "move", direction: "east" }); // back to dining
    engine.executeAction({ kind: "move", direction: "south" }); // back to alcoves
    expect(engine.state.currentLocationId).toBe("b1-entrance-alcoves");

    res = engine.executeAction({ kind: "move", direction: "east" });
    expect(res.success).toBe(true);
    expect(engine.state.currentLocationId).toBe("b1-east-hallway");

    // Unlock and enter Great Library using bronze-library-key
    res = engine.executeAction({ kind: "move", direction: "east" });
    expect(res.success).toBe(true);
    expect(engine.state.currentLocationId).toBe("b1-library");

    // Inspect the Chronicles of Quasqueton
    res = engine.executeAction({ kind: "inspect", targetId: "marble-lectern-codex" });
    expect(res.success).toBe(true);
    expect(engine.state.inventory.has("quasqueton-chronicles")).toBe(true);
    expect(engine.state.flags.get("quest-complete-library")).toBe(true);
  });

  it("4. Tests secret passage discovery into Secret Storeroom (Area 10)", () => {
    const engine = new SimulatorEngine(b1InSearchOfTheUnknown as VersionedAdventure, 42);
    // Move to Laboratory directly
    engine.state.currentLocationId = "b1-wizards-laboratory";

    // Reveal secret door
    engine.state.flags.set("sec-lab-revolving-door-discovered", true);

    const res = engine.executeAction({ kind: "move", direction: "east" });
    expect(res.success).toBe(true);
    expect(engine.state.currentLocationId).toBe("b1-secret-storeroom");

    const lootRes = engine.executeAction({ kind: "inspect", targetId: "zelligar-vault-chest" });
    expect(lootRes.success).toBe(true);
    expect(engine.state.inventory.has("potion-healing")).toBe(true);
  });
});
