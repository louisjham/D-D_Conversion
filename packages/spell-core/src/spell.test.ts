import { describe, it, expect } from "vitest";
import { Spell, SpellSchema, CasterState, SpellEvaluator } from "./index";
import { SeededRNG } from "@grimoire3d/rules-core";

describe("@grimoire3d/spell-core — Custom Spell & Skill Engine Test Suite", () => {
  const fireballSpell: Spell = {
    id: "spell-fireball",
    name: "Fireball",
    school: "evocation",
    level: 3,
    manaCost: 15,
    kind: "damage",
    targetType: "allEnemies",
    diceFormula: "1d6",
    scaleWithCasterLevel: true,
    allowedClasses: ["mage", "wizard"],
    description: "Flames burst forth dealing 1d6 fire damage per caster level.",
  };

  const healSpell: Spell = {
    id: "spell-cure-wounds",
    name: "Cure Moderate Wounds",
    school: "abjuration",
    level: 2,
    manaCost: 10,
    kind: "healing",
    targetType: "singleTarget",
    diceFormula: "2d8",
    scaleWithCasterLevel: false,
    allowedClasses: ["cleric", "paladin"],
    statusEffects: [{ id: "eff-bless", type: "blessed", durationRounds: 3, potency: 2 }],
    description: "Heals target for 2d8 hit points and applies Blessed status.",
  };

  it("1. Validates Spell Zod Schema parsing", () => {
    const res1 = SpellSchema.safeParse(fireballSpell);
    expect(res1.success).toBe(true);

    const res2 = SpellSchema.safeParse(healSpell);
    expect(res2.success).toBe(true);
  });

  it("2. Enforces class lock restrictions", () => {
    const rng = new SeededRNG(42);
    const mageCaster: CasterState = {
      characterName: "Melf",
      characterClass: "mage",
      level: 5,
      currentMana: 50,
      maxMana: 50,
      activeStatusEffects: [],
    };

    // Mage attempting to cast Cleric heal spell
    const failRes = SpellEvaluator.castSpell(healSpell, mageCaster, rng);
    expect(failRes.success).toBe(false);
    expect(failRes.message).toContain("Class restricted");
    expect(failRes.manaSpent).toBe(0);
  });

  it("3. Deducts mana and calculates caster level scaling damage", () => {
    const rng = new SeededRNG(100);
    const mageCaster: CasterState = {
      characterName: "Melf",
      characterClass: "mage",
      level: 5,
      currentMana: 50,
      maxMana: 50,
      activeStatusEffects: [],
    };

    const res = SpellEvaluator.castSpell(fireballSpell, mageCaster, rng);
    expect(res.success).toBe(true);
    expect(res.manaSpent).toBe(15);
    expect(res.remainingMana).toBe(35);
    expect(res.totalRoll).toBeGreaterThan(0);
    expect(mageCaster.currentMana).toBe(35);
  });

  it("4. Applies status effects during spell casting", () => {
    const rng = new SeededRNG(200);
    const clericCaster: CasterState = {
      characterName: "Kyra",
      characterClass: "cleric",
      level: 4,
      currentMana: 30,
      maxMana: 30,
      activeStatusEffects: [],
    };

    const res = SpellEvaluator.castSpell(healSpell, clericCaster, rng);
    expect(res.success).toBe(true);
    expect(res.appliedEffects).toHaveLength(1);
    expect(clericCaster.activeStatusEffects).toHaveLength(1);
    expect(clericCaster.activeStatusEffects[0].type).toBe("blessed");
  });
});
