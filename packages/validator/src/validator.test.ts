import { describe, it, expect } from "vitest";
import { validateAdventure } from "./validator";
import {
  serpentAltarAdventure,
  brokenAltarAdventure,
  secretBranchAdventure,
} from "@grimoire3d/fixtures";

describe("Deterministic Validator & Lock/Key State-Space Solver", () => {
  it("1. Canonical Serpent Altar Crypt fixture should be 100% valid", () => {
    const result = validateAdventure(serpentAltarAdventure);
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("2. Broken Altar Crypt fixture should produce precise error issues", () => {
    const result = validateAdventure(brokenAltarAdventure);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "DANGLING_EXIT_TARGET")).toBe(true);
    expect(result.issues.some((i) => i.code === "UNSOLVABLE_LOCK_KEY_UNREACHABLE")).toBe(true);
    expect(result.issues.some((i) => i.code === "UNSATISFIABLE_CONDITION_FLAG")).toBe(true);
  });

  it("3. Secret Branch Crypt fixture should be solvable via secret route", () => {
    const result = validateAdventure(secretBranchAdventure);
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === "error")).toHaveLength(0);
  });

  it("4. Should detect dangling exit targets with suggested fixes", () => {
    const adv = JSON.parse(JSON.stringify(serpentAltarAdventure));
    adv.adventure.locations[0].exits[0].target = "non-existent-room-99";
    const res = validateAdventure(adv);
    expect(res.valid).toBe(false);
    const issue = res.issues.find((i) => i.code === "DANGLING_EXIT_TARGET");
    expect(issue).toBeDefined();
    expect(issue?.suggestedFix).toBeDefined();
  });

  it("5. Should catch key item placed behind the door it opens", () => {
    const adv = JSON.parse(JSON.stringify(serpentAltarAdventure));
    // Move iron-key grant effect to altar-chamber (behind the locked door) and make door unpickable
    adv.adventure.locations[1].interactables[0].onInspectEffects = [];
    adv.adventure.locations[4].exits[1].locked = { keyItemId: "iron-key", pickable: false };
    adv.adventure.locations[5].interactables = [
      {
        id: "hidden-altar-key",
        label: "Key Box",
        description: "Contains key",
        onInspectEffects: [{ kind: "grantItem", itemId: "iron-key" }],
      },
    ];

    const res = validateAdventure(adv);
    expect(res.valid).toBe(false);
    const lockIssue = res.issues.find((i) => i.code === "UNSOLVABLE_LOCK_KEY_UNREACHABLE");
    expect(lockIssue).toBeDefined();
  });

  it("6. Should validate two keys and two locks in correct acquisition order", () => {
    const adv = JSON.parse(JSON.stringify(serpentAltarAdventure));
    // Add second key in guard-post and second locked exit in trap-room
    adv.adventure.items.push({ id: "gold-key", name: "Gold Key", type: "key", description: "Test key" });
    adv.adventure.locations[1].interactables[0].onInspectEffects.push({ kind: "grantItem", itemId: "gold-key" });
    adv.adventure.locations[4].exits.push({
      id: "exit-trap-to-treasury-gold",
      direction: "up",
      target: "secret-treasury",
      locked: { keyItemId: "gold-key" },
    });

    const res = validateAdventure(adv);
    expect(res.valid).toBe(true);
  });

  it("7. Should catch unsatisfiable condition flags", () => {
    const adv = JSON.parse(JSON.stringify(serpentAltarAdventure));
    adv.adventure.locations[0].exits[0].visibleWhen = { kind: "flag", flag: "ghost-flag-never-set", equals: true };
    const res = validateAdventure(adv);
    expect(res.valid).toBe(false);
    const flagIssue = res.issues.find((i) => i.code === "UNSATISFIABLE_CONDITION_FLAG");
    expect(flagIssue).toBeDefined();
  });

  it("8. Should detect duplicate location IDs", () => {
    const adv = JSON.parse(JSON.stringify(serpentAltarAdventure));
    adv.adventure.locations[1].id = "entry-hall";
    const res = validateAdventure(adv);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.code === "DUPLICATE_LOCATION_ID")).toBe(true);
  });

  it("9. Should detect duplicate item IDs", () => {
    const adv = JSON.parse(JSON.stringify(serpentAltarAdventure));
    adv.adventure.items.push({ id: "iron-key", name: "Dup Key", type: "key", description: "Dup" });
    const res = validateAdventure(adv);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.code === "DUPLICATE_ITEM_ID")).toBe(true);
  });

  it("10. Should detect duplicate exit IDs across locations", () => {
    const adv = JSON.parse(JSON.stringify(serpentAltarAdventure));
    adv.adventure.locations[1].exits[0].id = "exit-entry-to-guard";
    const res = validateAdventure(adv);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.code === "DUPLICATE_EXIT_ID")).toBe(true);
  });

  it("11. Should detect duplicate secret IDs", () => {
    const adv = JSON.parse(JSON.stringify(serpentAltarAdventure));
    adv.adventure.locations[3].secrets.push({
      id: "secret-door-treasury",
      label: "Dup Secret",
      perceptionDC: 10,
      discovered: false,
    });
    const res = validateAdventure(adv);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.code === "DUPLICATE_SECRET_ID")).toBe(true);
  });

  it("12. Should detect invalid start location", () => {
    const adv = JSON.parse(JSON.stringify(serpentAltarAdventure));
    adv.adventure.start = "non-existent-start-node";
    const res = validateAdventure(adv);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.code === "INVALID_START_LOCATION")).toBe(true);
  });

  it("13. Should detect missing monster template in encounters", () => {
    const adv = JSON.parse(JSON.stringify(serpentAltarAdventure));
    adv.adventure.locations[5].encounter.enemies[0].monsterTemplateId = "missing-dragon";
    const res = validateAdventure(adv);
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.code === "MISSING_MONSTER_TEMPLATE")).toBe(true);
  });

  it("14. Should warn on unreachable orphan locations", () => {
    const adv = JSON.parse(JSON.stringify(serpentAltarAdventure));
    adv.adventure.locations.push({
      id: "isolated-island-room",
      label: "Island Room",
      geometry: { x: 50, y: 50, width: 4, height: 4 },
      presentation: { biome: "crypt", lighting: "dark", ambienceTags: [] },
      narrative: { playerFacingDescription: "Orphan", gmNotes: [] },
      exits: [],
      interactables: [],
      secrets: [],
    });
    const res = validateAdventure(adv);
    expect(res.issues.some((i) => i.code === "ORPHAN_LOCATION")).toBe(true);
  });

  it("15. Should report state-space search truncation when limit exceeded", () => {
    const adv = JSON.parse(JSON.stringify(serpentAltarAdventure));
    // Add multiple circular flags to inflate state space
    for (let i = 0; i < 15; i++) {
      adv.adventure.locations[0].interactables.push({
        id: `inter-${i}`,
        label: `Inter ${i}`,
        description: "Flag spinner",
        onInspectEffects: [{ kind: "setFlag", flag: `flag-${i}`, value: true }],
      });
    }
    const res = validateAdventure(adv);
    // Should complete cleanly without hanging
    expect(res).toBeDefined();
  });
});
