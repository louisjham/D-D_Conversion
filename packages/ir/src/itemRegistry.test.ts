import { describe, it, expect } from "vitest";
import {
  ITEM_REGISTRY,
  getItem,
  getItemsByType,
  resolveItem,
  ItemSchema,
  Item,
  Adventure,
  VersionedAdventure,
} from "./index";
import { validateAdventure } from "@grimoire3d/validator";
import { serpentAltarAdventure, b2KeepOnTheBorderlands } from "@grimoire3d/fixtures";

describe("@grimoire3d/ir — Canonical Item Registry & Resolution Test Suite", () => {
  it("1. ITEM_REGISTRY contains equipment items from 5e PHB Chapter 5", () => {
    const keys = Object.keys(ITEM_REGISTRY);
    expect(keys.length).toBeGreaterThanOrEqual(100);

    // Verify all entries pass ItemSchema validation
    for (const key of keys) {
      const item = ITEM_REGISTRY[key];
      const result = ItemSchema.safeParse(item);
      if (!result.success) {
        throw new Error(`Item '${key}' failed ItemSchema validation: ${JSON.stringify(result.error.issues)}`);
      }
      expect(result.success).toBe(true);
    }
  });

  it("2. Spot-checks 10 well-known items match 5e PHB specifications", () => {
    // 1. Longsword
    const longsword = getItem("longsword");
    expect(longsword).toBeDefined();
    expect(longsword!.name).toBe("Longsword");
    expect(longsword!.type).toBe("weapon");
    expect(longsword!.valueCoins).toBe(15);
    expect(longsword!.physical?.weightLbs).toBe(3);
    expect(longsword!.weapon?.damageDice).toBe("1d8");
    expect(longsword!.weapon?.damageType).toBe("slashing");
    expect(longsword!.weapon?.properties).toContain("versatile (1d10)");

    // 2. Plate Armor
    const plate = getItem("plate");
    expect(plate).toBeDefined();
    expect(plate!.type).toBe("armor");
    expect(plate!.valueCoins).toBe(1500);
    expect(plate!.physical?.weightLbs).toBe(65);
    expect(plate!.armor?.acBonus).toBe(18);
    expect(plate!.armor?.armorCategory).toBe("heavy");

    const plateAlias = getItem("plate-armor");
    expect(plateAlias).toBeDefined();
    expect(plateAlias!.armor?.acBonus).toBe(18);

    // 3. Healing Potion
    const healingPotion = getItem("healing-potion");
    expect(healingPotion).toBeDefined();
    expect(healingPotion!.name).toBe("Potion of Healing");
    expect(healingPotion!.type).toBe("potion");
    expect(healingPotion!.valueCoins).toBe(50);
    expect(healingPotion!.physical?.weightLbs).toBe(0.5);

    // 4. Thieves' Tools
    const thievesTools = getItem("thieves-tools");
    expect(thievesTools).toBeDefined();
    expect(thievesTools!.type).toBe("tool");
    expect(thievesTools!.valueCoins).toBe(25);
    expect(thievesTools!.physical?.weightLbs).toBe(1);

    // 5. Rope
    const rope = getItem("rope");
    expect(rope).toBeDefined();
    expect(rope!.valueCoins).toBe(1);
    expect(rope!.physical?.weightLbs).toBe(10);

    // 6. Torch
    const torch = getItem("torch");
    expect(torch).toBeDefined();
    expect(torch!.valueCoins).toBe(0.01);
    expect(torch!.physical?.weightLbs).toBe(1);
    expect(torch!.type).toBe("consumable");

    // 7. Longbow
    const longbow = getItem("longbow");
    expect(longbow).toBeDefined();
    expect(longbow!.type).toBe("weapon");
    expect(longbow!.valueCoins).toBe(50);
    expect(longbow!.physical?.weightLbs).toBe(2);
    expect(longbow!.weapon?.damageDice).toBe("1d8");
    expect(longbow!.weapon?.damageType).toBe("piercing");

    // 8. Shield
    const shield = getItem("shield");
    expect(shield).toBeDefined();
    expect(shield!.type).toBe("shield");
    expect(shield!.valueCoins).toBe(10);
    expect(shield!.physical?.weightLbs).toBe(6);
    expect(shield!.armor?.acBonus).toBe(2);

    // 9. Backpack
    const backpack = getItem("backpack");
    expect(backpack).toBeDefined();
    expect(backpack!.type).toBe("container");
    expect(backpack!.valueCoins).toBe(2);
    expect(backpack!.physical?.weightLbs).toBe(5);

    // 10. Rations
    const rations = getItem("rations");
    expect(rations).toBeDefined();
    expect(rations!.type).toBe("consumable");
    expect(rations!.valueCoins).toBe(0.5);
    expect(rations!.physical?.weightLbs).toBe(2);
  });

  it("3. getItemsByType filters unique registry items by category", () => {
    const weapons = getItemsByType("weapon");
    expect(weapons.length).toBeGreaterThanOrEqual(30);
    expect(weapons.every((w) => w.type === "weapon")).toBe(true);

    const armors = getItemsByType("armor");
    expect(armors.length).toBeGreaterThanOrEqual(10);
    expect(armors.every((a) => a.type === "armor")).toBe(true);

    const tools = getItemsByType("tool");
    expect(tools.length).toBeGreaterThanOrEqual(25);
    expect(tools.every((t) => t.type === "tool")).toBe(true);
  });

  it("4. resolveItem prioritizes adventure custom items before registry fallback", () => {
    const customLongsword: Item = {
      id: "longsword",
      name: "Elven Moonblade Longsword",
      type: "weapon",
      description: "An ancient glowing moonblade that counts as a longsword.",
      valueCoins: 500,
      weapon: {
        damageDice: "1d10",
        damageType: "slashing",
        enhancementBonus: 2,
      },
    };

    const mockAdventure: Adventure = {
      id: "adv-custom",
      title: "Custom Realm",
      systemProfile: "classic-dungeon",
      start: "loc-1",
      locations: [],
      npcs: [],
      monsters: [],
      items: [customLongsword],
      quests: [],
    };

    // Resolving 'longsword' with adventure should return custom override
    const resolvedCustom = resolveItem("longsword", mockAdventure);
    expect(resolvedCustom).toBeDefined();
    expect(resolvedCustom?.name).toBe("Elven Moonblade Longsword");
    expect(resolvedCustom?.valueCoins).toBe(500);

    // Resolving 'shield' with adventure should fallback to canonical registry
    const resolvedFallback = resolveItem("shield", mockAdventure);
    expect(resolvedFallback).toBeDefined();
    expect(resolvedFallback?.name).toBe("Shield");
    expect(resolvedFallback?.valueCoins).toBe(10);
  });

  it("5. B2 Keep on the Borderlands fixture validates clean with custom items override", () => {
    const result = validateAdventure(b2KeepOnTheBorderlands);
    expect(result.valid).toBe(true);
    const errors = result.issues.filter((i) => i.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("6. Validator cleanly resolves canonical items and flags UNKNOWN_ITEM_REFERENCE for bogus items", () => {
    const testAdv = JSON.parse(JSON.stringify(serpentAltarAdventure)) as VersionedAdventure;

    // Granting canonical item 'healing-potion' (not in adv.items) passes cleanly
    testAdv.adventure.locations[0].interactables = [
      {
        id: "inter-chest",
        label: "Crypt Chest",
        description: "A small stone chest.",
        onInspectEffects: [{ kind: "grantItem", itemId: "healing-potion" }],
      },
    ];

    const cleanResult = validateAdventure(testAdv);
    const itemErrors1 = cleanResult.issues.filter((i) => i.code === "UNKNOWN_ITEM_REFERENCE");
    expect(itemErrors1).toHaveLength(0);

    // Granting bogus item 'not-an-item' triggers UNKNOWN_ITEM_REFERENCE
    testAdv.adventure.locations[0].interactables = [
      {
        id: "inter-chest",
        label: "Crypt Chest",
        description: "A small stone chest.",
        onInspectEffects: [{ kind: "grantItem", itemId: "not-an-item" }],
      },
    ];

    const failResult = validateAdventure(testAdv);
    const itemErrors2 = failResult.issues.filter((i) => i.code === "UNKNOWN_ITEM_REFERENCE");
    expect(itemErrors2.length).toBeGreaterThan(0);
    expect(itemErrors2[0].message).toContain("not-an-item");
  });

  it("7. Validator flags ITEM_ID_SHADOWS_REGISTRY warning with differing fields when custom item collides", () => {
    const testAdv = JSON.parse(JSON.stringify(serpentAltarAdventure)) as VersionedAdventure;

    // Add a custom item that shares ID 'longsword' but differs in valueCoins and description
    testAdv.adventure.items.push({
      id: "longsword",
      name: "Longsword",
      type: "weapon",
      description: "A rusty chipped longsword found in a goblin den.",
      valueCoins: 3, // canonical is 15
    });

    const result = validateAdventure(testAdv);
    const shadowWarnings = result.issues.filter((i) => i.code === "ITEM_ID_SHADOWS_REGISTRY");
    const longswordWarning = shadowWarnings.find((i) => i.entityId === "longsword");
    expect(longswordWarning).toBeDefined();
    expect(longswordWarning!.severity).toBe("warning");
    expect(longswordWarning!.message).toContain("valueCoins");
    expect(longswordWarning!.message).toContain("description");
  });
});
