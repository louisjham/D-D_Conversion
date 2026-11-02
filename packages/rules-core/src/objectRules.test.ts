import { describe, it, expect } from "vitest";
import {
  calcObjectDurability,
  damageObject,
  resolveBreakAttempt,
  resolveLockpickAttempt,
  resolveAlchemicalSubstance,
  calcArmsAndEquipmentWeapon,
  calcArmsAndEquipmentArmor,
  MATERIAL_SPECS,
  STANDARD_EQUIPMENT_CATALOG,
  createStandardCharacter,
  SeededRNG,
} from "@grimoire3d/rules-core";
import { SimulatorEngine } from "@grimoire3d/simulator";
import { VersionedAdventure } from "@grimoire3d/ir";

describe("Arms and Equipment Guide: Object Characteristics & Rules", () => {
  it("defines standard and exotic materials with correct hardness and hit points", () => {
    expect(MATERIAL_SPECS.wood.hardness).toBe(5);
    expect(MATERIAL_SPECS.wood.hpPerInch).toBe(10);

    expect(MATERIAL_SPECS.stone.hardness).toBe(8);
    expect(MATERIAL_SPECS.stone.hpPerInch).toBe(15);

    expect(MATERIAL_SPECS.iron.hardness).toBe(10);
    expect(MATERIAL_SPECS.iron.hpPerInch).toBe(30);

    expect(MATERIAL_SPECS.mithral.hardness).toBe(15);
    expect(MATERIAL_SPECS.mithral.hpPerInch).toBe(30);
    expect(MATERIAL_SPECS.mithral.weightMultiplier).toBe(0.5);

    expect(MATERIAL_SPECS.adamantine.hardness).toBe(20);
    expect(MATERIAL_SPECS.adamantine.hpPerInch).toBe(40);

    // Exotic materials from Chapter 1
    expect(MATERIAL_SPECS["baatorian-green-steel"].hardness).toBe(12);
    expect(MATERIAL_SPECS["solanian-truesteel"].hardness).toBe(11);
    expect(MATERIAL_SPECS["gehennan-morghuth-iron"].hardness).toBe(9);
    expect(MATERIAL_SPECS["elven-darkleaf"].hardness).toBe(10);
    expect(MATERIAL_SPECS["blended-quartz"].weightMultiplier).toBe(2.0);
  });

  it("calculates object durability and break DCs for dungeon objects", () => {
    // 2-inch wooden dungeon door
    const woodDoor = calcObjectDurability("wood", 2, "door");
    expect(woodDoor.hardness).toBe(5);
    expect(woodDoor.maxHp).toBe(20);
    expect(woodDoor.breakDc).toBe(18);

    // 2-inch solid iron door
    const ironDoor = calcObjectDurability("iron", 2, "door");
    expect(ironDoor.hardness).toBe(10);
    expect(ironDoor.maxHp).toBe(60);
    expect(ironDoor.breakDc).toBe(28);

    // Iron-banded wooden chest
    const chest = calcObjectDurability("wood", 1, "chest");
    expect(chest.breakDc).toBe(17);
  });

  it("reduces incoming damage by object hardness", () => {
    const door = { hardness: 5, hp: 20, maxHp: 20, material: "wood" as const };
    const res = damageObject(door, 12, "slashing");

    expect(res.absorbedByHardness).toBe(5);
    expect(res.damageDealt).toBe(7);
    expect(res.remainingHp).toBe(13);
    expect(res.isDestroyed).toBe(false);
  });

  it("applies fire vulnerability to wooden objects (double damage)", () => {
    const woodenChest = { hardness: 5, hp: 15, maxHp: 15, material: "wood" as const };
    const res = damageObject(woodenChest, 8, "fire");

    // 8 fire * 2 = 16 adjusted damage - 5 hardness = 11 dealt
    expect(res.damageDealt).toBe(11);
    expect(res.remainingHp).toBe(4);
  });

  it("allows Adamantine weapons to bypass hardness below 20", () => {
    const ironBar = { hardness: 10, hp: 30, maxHp: 30, material: "iron" as const };
    // Striking with normal steel weapon
    const steelRes = damageObject(ironBar, 12, "slashing", "steel");
    expect(steelRes.damageDealt).toBe(2); // 12 - 10 = 2

    // Striking with Adamantine weapon
    const adamantineRes = damageObject(ironBar, 12, "slashing", "adamantine");
    expect(adamantineRes.effectiveHardness).toBe(0);
    expect(adamantineRes.damageDealt).toBe(12); // Hardness completely bypassed!
  });

  it("allows Stonebreaker Acid to bypass stone hardness and deal full dissolution damage", () => {
    const stoneGargoyle = { hardness: 8, hp: 30, maxHp: 30, material: "stone" as const };
    const res = damageObject(stoneGargoyle, 22, "acid", undefined, "stonebreaker-acid");

    expect(res.effectiveHardness).toBe(0);
    expect(res.damageDealt).toBe(22);
    expect(res.remainingHp).toBe(8);
  });

  it("resolves break attempts with crowbar circumstance bonus (+2)", () => {
    const fighter = createStandardCharacter({ class: "fighter", race: "human" }); // STR 16 -> +3
    const crowbar = STANDARD_EQUIPMENT_CATALOG.find((i) => i.id === "item-crowbar");

    // Deterministic RNG roll: say roll 12
    const rng = new SeededRNG(42);
    const res = resolveBreakAttempt(fighter, { breakDc: 17, label: "Stuck Wooden Chest" }, crowbar, rng);

    expect(res.strMod).toBe(3);
    expect(res.toolBonus).toBe(2); // Crowbar +2 bonus
    expect(res.total).toBe(res.roll + 3 + 2);
    expect(res.success).toBe(res.total >= 17);
  });

  it("resolves lockpicking with Thieves' Tools and proficiency", () => {
    const rogue = createStandardCharacter({ class: "rogue", race: "halfling" }); // DEX 16 + 2 -> 18 (+4) or 16 (+3)
    const rng = new SeededRNG(1234);

    const res = resolveLockpickAttempt(rogue, 15, true, rng);
    expect(res.dexMod).toBe(Math.floor((rogue.abilities.dex - 10) / 2));
    expect(res.profBonus).toBe(2);
    expect(res.penalty).toBe(0);
    expect(res.total).toBe(res.roll + res.dexMod + 2);

    // Without tools, incurs -2 penalty
    const noToolsRes = resolveLockpickAttempt(rogue, 15, false, rng);
    expect(noToolsRes.penalty).toBe(-2);
    expect(noToolsRes.total).toBe(noToolsRes.roll + res.dexMod);
  });

  it("resolves alchemical items from Chapter 2", () => {
    const rng = new SeededRNG(55);

    // Bladefire: ignites for 1d6 rounds, deals +1 fire damage
    const bladefire = STANDARD_EQUIPMENT_CATALOG.find((i) => i.id === "item-bladefire")!;
    const bladeRes = resolveAlchemicalSubstance(bladefire, { name: "Longsword" }, rng);
    expect(bladeRes.damage).toBe(1);
    expect(bladeRes.damageType).toBe("fire");
    expect(bladeRes.durationRounds).toBeGreaterThanOrEqual(1);

    // Stonebreaker Acid: deals 3d10 damage on stone
    const stonebreaker = STANDARD_EQUIPMENT_CATALOG.find((i) => i.id === "item-stonebreaker-acid")!;
    const stoneRes = resolveAlchemicalSubstance(stonebreaker, { name: "Stone Vault Gate", material: "stone" }, rng);
    expect(stoneRes.damage).toBeGreaterThanOrEqual(3);
    expect(stoneRes.damageType).toBe("acid");
  });

  it("calculates weapon properties for exotic materials", () => {
    const fighter = createStandardCharacter({ class: "fighter", race: "human" });

    // Baatorian green steel dagger (+1 natural damage bonus)
    const baatorianDagger = STANDARD_EQUIPMENT_CATALOG.find((i) => i.id === "item-baatorian-dagger")!;
    const daggerStats = calcArmsAndEquipmentWeapon(baatorianDagger, fighter);
    expect(daggerStats.damageBonus).toBe(3 + 1); // STR mod 3 + 1 Baatorian bonus
    expect(daggerStats.specialProperties).toContain("baatorian-keen (+1 damage)");

    // Adamantine greatsword (heavy, two-handed, bypasses hardness)
    const adamantineSword = STANDARD_EQUIPMENT_CATALOG.find((i) => i.id === "item-adamantine-greatsword")!;
    const greatswordStats = calcArmsAndEquipmentWeapon(adamantineSword, fighter);
    expect(greatswordStats.damageDice).toBe("2d6");
    expect(greatswordStats.specialProperties).toContain("two-handed");
  });

  it("calculates armor statistics with material adjustments (Mithral & Elven Darkleaf)", () => {
    // Mithral Shirt: max dex +2, check penalty reduced by 3, spell failure -10%
    const mithralShirt = STANDARD_EQUIPMENT_CATALOG.find((i) => i.id === "item-mithral-shirt")!;
    const mithralStats = calcArmsAndEquipmentArmor(mithralShirt);
    expect(mithralStats.maxDexBonus).toBe(8); // 6 + 2
    expect(mithralStats.arcaneSpellFailure).toBe(0); // 10% - 10% = 0%
    expect(mithralStats.specialAbilities).toContain("mithral-agility");

    // Elven Darkleaf Breastplate: max dex +1, check penalty +2 bonus
    const darkleafArmor = STANDARD_EQUIPMENT_CATALOG.find((i) => i.id === "item-darkleaf-breastplate")!;
    const darkleafStats = calcArmsAndEquipmentArmor(darkleafArmor);
    expect(darkleafStats.maxDexBonus).toBe(4); // 3 + 1
    expect(darkleafStats.armorCheckPenalty).toBe(0); // -2 + 2 = 0
    expect(darkleafStats.arcaneSpellFailure).toBe(10); // 15% - 5% = 10%
  });

  it("integrates into SimulatorEngine for object sundering, crowbar forcing, and alchemical usage", () => {
    const testAdventure: VersionedAdventure = {
      schemaVersion: "0.1",
      adventure: {
        id: "dungeon-objects-test",
        title: "Dungeon of Objects",
        start: "chamber-a",
        locations: [
          {
            id: "chamber-a",
            label: "Treasury Chamber",
            geometry: { x: 0, y: 0, width: 20, height: 20 },
            presentation: { biome: "cavern", lighting: "torchlit", ambienceTags: [] },
            narrative: { playerFacingDescription: "A stone chamber.", gmNotes: [] },
            exits: [
              {
                id: "exit-stone-portal",
                direction: "north",
                target: "chamber-b",
                locked: { pickable: true, lockpickDC: 20 },
                forceDC: 20,
              },
            ],
            interactables: [
              {
                id: "reinforced-chest",
                label: "Reinforced Iron Chest",
                description: "A heavy iron chest with an intricate lock.",
                physical: {
                  material: "iron",
                  hardness: 10,
                  hp: 30,
                  maxHp: 30,
                  breakDc: 18,
                  isLocked: true,
                  lockDc: 15,
                },
              },
              {
                id: "stone-monolith",
                label: "Ancient Stone Monolith",
                description: "A massive granite pillar.",
                physical: {
                  material: "stone",
                  hardness: 8,
                  hp: 25,
                  maxHp: 25,
                },
              },
            ],
            secrets: [],
          },
          {
            id: "chamber-b",
            label: "Inner Vault",
            geometry: { x: 0, y: 20, width: 20, height: 20 },
            presentation: { biome: "cavern", lighting: "torchlit", ambienceTags: [] },
            narrative: { playerFacingDescription: "The secret sanctum.", gmNotes: [] },
            exits: [],
            interactables: [],
            secrets: [],
          },
        ],
        items: [
          ...STANDARD_EQUIPMENT_CATALOG,
        ],
        monsters: [],
        quests: [],
        systemProfile: "classic-dungeon",
        npcs: [],
      },
      metadata: {
        createdAt: "2026-11-02T00:00:00Z",
        updatedAt: "2026-11-02T00:00:00Z",
        importedBy: "fixture",
      },
    };

    const engine = new SimulatorEngine(testAdventure, 42);

    // 1. Give player a crowbar and test forcing the chest open
    engine.executeAction({ type: "PICKUP_ITEM", itemId: "item-crowbar" });
    expect(engine.state.inventory.has("item-crowbar")).toBe(true);

    const forceRes = engine.executeAction({
      kind: "useItem",
      itemId: "item-crowbar",
      targetId: "reinforced-chest",
    });
    expect(forceRes.message).toContain("Break check on Reinforced Iron Chest");

    // 2. Give player Stonebreaker Acid and dissolve the stone monolith
    engine.executeAction({ type: "PICKUP_ITEM", itemId: "item-stonebreaker-acid" });
    const acidRes = engine.executeAction({
      kind: "useItem",
      itemId: "item-stonebreaker-acid",
      targetId: "stone-monolith",
    });
    expect(acidRes.success).toBe(true);
    expect(acidRes.message).toContain("Stonebreaker Acid");
    expect(acidRes.message).toContain("bypassed");

    // 3. Attack the chest with Adamantine Greatsword
    engine.executeAction({ type: "PICKUP_ITEM", itemId: "item-adamantine-greatsword" });
    const attackRes = engine.executeAction({
      kind: "attackObject",
      targetId: "reinforced-chest",
      weaponItemId: "item-adamantine-greatsword",
    });
    expect(attackRes.success).toBe(true);
    expect(attackRes.message).toContain("Hardness (10) was bypassed!");
  });
});
