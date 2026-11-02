import { describe, it, expect } from "vitest";
import { validateAdventure } from "@grimoire3d/validator";
import { a1SlavePitsOfTheUndercity } from "@grimoire3d/fixtures";
import { VersionedAdventure } from "@grimoire3d/ir";
import { SimulatorEngine } from "@grimoire3d/simulator";
import { WorldCompiler } from "@grimoire3d/world-compiler";

describe("A1: Slave Pits of the Undercity IR Validation & Simulation", () => {
  it("1. Validates a1SlavePitsOfTheUndercity IR JSON schema and solvability", () => {
    const result = validateAdventure(a1SlavePitsOfTheUndercity as VersionedAdventure);
    const errors = result.issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
    expect(result.valid).toBe(true);
  });

  it("2. Compiles A1 spatial layout via WorldCompiler", () => {
    const layout = WorldCompiler.compile(a1SlavePitsOfTheUndercity as VersionedAdventure);
    expect(layout.rooms.length).toBe(13);

    const secretEnt = layout.rooms.find((r) => r.id === "a1-secret-entrance");
    expect(secretEnt).toBeDefined();
    expect(secretEnt?.label).toContain("Secret Entrance");

    const slavePens = layout.rooms.find((r) => r.id === "a1-slave-pens");
    expect(slavePens).toBeDefined();
    expect(slavePens?.label).toContain("Slave Pens");
  });

  it("3. Simulates full tactical infiltration: temple raid, sewers, and slave liberation", () => {
    const engine = new SimulatorEngine(a1SlavePitsOfTheUndercity as VersionedAdventure, 42);
    expect(engine.state.currentLocationId).toBe("a1-secret-entrance");

    // PHB Action: Listen at secret door
    let listenRes = engine.executeAction({ kind: "listen", direction: "north" });
    expect(listenRes.success).toBe(true);

    // PHB Action: Search & disarm spring trap
    let trapRes = engine.executeAction({ kind: "searchTraps" });
    expect(trapRes.success).toBe(true);

    // Move to Collapsed Guard Room -> Barracks
    let res = engine.executeAction({ kind: "move", direction: "north" });
    expect(res.success).toBe(true);
    expect(engine.state.currentLocationId).toBe("a1-collapsed-guard");

    res = engine.executeAction({ kind: "move", direction: "north" });
    expect(res.success).toBe(true);
    expect(engine.state.currentLocationId).toBe("a1-barracks-hall");

    // Sabotage alarm gong to prevent reinforcements
    res = engine.executeAction({ kind: "inspect", targetId: "slaver-alarm-gong" });
    expect(res.success).toBe(true);
    expect(engine.state.flags.get("alarm-gong-sabotaged")).toBe(true);

    // Loot barracks key
    res = engine.executeAction({ kind: "inspect", targetId: "slaver-armory-rack" });
    expect(res.success).toBe(true);
    expect(engine.state.inventory.has("slaver-iron-key")).toBe(true);

    // Advance to Inner Courtyard -> Great Temple of Earth Dragon
    res = engine.executeAction({ kind: "move", direction: "north" });
    expect(res.success).toBe(true);
    expect(engine.state.currentLocationId).toBe("a1-inner-courtyard");

    res = engine.executeAction({ kind: "move", direction: "north" });
    expect(res.success).toBe(true);
    expect(engine.state.currentLocationId).toBe("a1-earth-temple");

    // Loot Earth Dragon Eye
    res = engine.executeAction({ kind: "inspect", targetId: "earth-dragon-statue" });
    expect(res.success).toBe(true);
    expect(engine.state.inventory.has("jeweled-dragon-eye")).toBe(true);

    // Slay Slaver Captain encounter to win master key
    // Emulate boss defeat
    engine.state.inventory.add("master-slave-key");
    engine.state.flags.set("slaver-captain-defeated", true);

    // Descend trapdoor into Flooded Undercity Sewers
    res = engine.executeAction({ kind: "move", direction: "down" });
    expect(res.success).toBe(true);
    expect(engine.state.currentLocationId).toBe("a1-flooded-sewer");

    // Unlock and enter Slave Pens with master-slave-key
    res = engine.executeAction({ kind: "move", direction: "north" });
    expect(res.success).toBe(true);
    expect(engine.state.currentLocationId).toBe("a1-slave-pens");

    // Free the captives!
    res = engine.executeAction({ kind: "inspect", targetId: "cell-iron-manacles" });
    expect(res.success).toBe(true);
    expect(engine.state.inventory.has("slave-ledger-scroll")).toBe(true);
    expect(engine.state.flags.get("slaves-liberated")).toBe(true);
  });

  it("4. Verifies A1 new mechanics: basilisk gaze hazards and barred garden exits", () => {
    const engine = new SimulatorEngine(a1SlavePitsOfTheUndercity as VersionedAdventure, 42);
    engine.state.currentLocationId = "a1-overgrown-garden";

    // Moving north to basilisk den initially blocked by barred iron gate
    let res = engine.executeAction({ kind: "move", direction: "north" });
    expect(res.success).toBe(false);
    expect(res.message).toContain("barred");

    // Batter open the barred gate
    const forceRes = engine.executeAction({ kind: "forceDoor", direction: "north" });
    expect(forceRes.success).toBe(true);

    // Pass through into Basilisk Den
    res = engine.executeAction({ kind: "move", direction: "north" });
    expect(res.success).toBe(true);
    expect(engine.state.currentLocationId).toBe("a1-basilisk-den");

    // Loot the petrified adventurer's magic ring
    const lootRes = engine.executeAction({ kind: "inspect", targetId: "petrified-warrior-statue" });
    expect(lootRes.success).toBe(true);
    expect(engine.state.inventory.has("ring-protection-a1")).toBe(true);
  });
});
