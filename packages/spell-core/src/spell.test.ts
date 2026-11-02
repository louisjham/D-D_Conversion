import { describe, it, expect } from "vitest";
import {
  Spell,
  SpellSchema,
  CasterState,
  SpellEvaluator,
  SPELL_REGISTRY,
  getSpell,
  getSpellsByLevel,
  getSpellsBySchool,
  learnSpell,
  Spellbook,
} from "./index";
import { SeededRNG } from "@grimoire3d/rules-core";
import { validateAdventure } from "@grimoire3d/validator";
import { serpentAltarAdventure } from "@grimoire3d/fixtures";
import { VersionedAdventure } from "@grimoire3d/ir";

describe("@grimoire3d/spell-core — Complete Spell System Test Suite", () => {
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
    range: { value: 150, unit: "feet" },
    duration: { value: 0, unit: "instantaneous" },
    castingTime: { value: 1, unit: "action" },
    components: { verbal: true, somatic: true, material: "a tiny ball of bat guano and sulfur" },
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
    range: { value: 0, unit: "touch" },
    duration: { value: 0, unit: "instantaneous" },
    castingTime: { value: 1, unit: "action" },
    components: { verbal: true, somatic: true },
    statusEffects: [{ id: "eff-bless", type: "blessed", durationRounds: 3, potency: 2 }],
    description: "Heals target for 2d8 hit points and applies Blessed status.",
  };

  it("1. Validates extended Spell Zod Schema parsing", () => {
    const res1 = SpellSchema.safeParse(fireballSpell);
    expect(res1.success).toBe(true);

    const res2 = SpellSchema.safeParse(healSpell);
    expect(res2.success).toBe(true);

    const envSpell: Spell = {
      id: "spell-fog-cloud",
      name: "Fog Cloud",
      school: "conjuration",
      level: 1,
      manaCost: 2,
      kind: "environment",
      targetType: "group",
      diceFormula: "0",
      scaleWithCasterLevel: false,
      allowedClasses: ["wizard", "druid"],
      range: { value: 120, unit: "feet" },
      duration: { value: 60, unit: "concentration" },
      castingTime: { value: 1, unit: "action" },
      components: { verbal: true, somatic: true },
      environmentEffects: [
        {
          kind: "createZone",
          description: "Creates a 20-foot-radius sphere of fog heavily obscuring the area.",
        },
      ],
      description: "Creates a 20-foot-radius sphere of fog.",
    };
    const res3 = SpellSchema.safeParse(envSpell);
    expect(res3.success).toBe(true);
  });

  it("2. SPELL_REGISTRY contains >= 300 spells from PHB/DMG", () => {
    const spellKeys = Object.keys(SPELL_REGISTRY);
    expect(spellKeys.length).toBeGreaterThanOrEqual(300);

    // Verify all spells in registry pass SpellSchema validation
    for (const key of spellKeys) {
      const spell = SPELL_REGISTRY[key];
      const result = SpellSchema.safeParse(spell);
      if (!result.success) {
        throw new Error(`Spell '${key}' failed validation: ${JSON.stringify(result.error.issues)}`);
      }
      expect(result.success).toBe(true);
    }
  });

  it("3. Spot-checks 10 well-known spells against PHB specifications", () => {
    // 1. Fireball
    const fireball = getSpell("fireball");
    expect(fireball).toBeDefined();
    expect(fireball!.level).toBe(3);
    expect(fireball!.school).toBe("evocation");
    expect(fireball!.range).toEqual({ value: 150, unit: "feet" });
    expect(fireball!.duration.unit).toBe("instantaneous");
    expect(fireball!.diceFormula).toBe("8d6");
    expect(fireball!.kind).toBe("damage");

    // 2. Magic Missile
    const magicMissile = getSpell("magic-missile");
    expect(magicMissile).toBeDefined();
    expect(magicMissile!.level).toBe(1);
    expect(magicMissile!.school).toBe("evocation");
    expect(magicMissile!.range).toEqual({ value: 120, unit: "feet" });
    expect(magicMissile!.duration.unit).toBe("instantaneous");
    expect(magicMissile!.diceFormula).toBe("1d4+1");
    expect(magicMissile!.kind).toBe("damage");

    // 3. Cure Wounds
    const cureWounds = getSpell("cure-wounds");
    expect(cureWounds).toBeDefined();
    expect(cureWounds!.level).toBe(1);
    expect(cureWounds!.school).toBe("evocation");
    expect(cureWounds!.range).toEqual({ value: 0, unit: "touch" });
    expect(cureWounds!.duration.unit).toBe("instantaneous");
    expect(cureWounds!.diceFormula).toBe("1d8");
    expect(cureWounds!.kind).toBe("healing");

    // 4. Shield
    const shield = getSpell("shield");
    expect(shield).toBeDefined();
    expect(shield!.level).toBe(1);
    expect(shield!.school).toBe("abjuration");
    expect(shield!.range).toEqual({ value: 0, unit: "self" });
    expect(shield!.duration).toEqual({ value: 1, unit: "rounds" });
    expect(shield!.kind).toBe("buff");

    // 5. Darkness
    const darkness = getSpell("darkness");
    expect(darkness).toBeDefined();
    expect(darkness!.level).toBe(2);
    expect(darkness!.school).toBe("evocation");
    expect(darkness!.range).toEqual({ value: 60, unit: "feet" });
    expect(darkness!.duration.unit).toBe("concentration");
    expect(darkness!.kind).toBe("environment");

    // 6. Misty Step
    const mistyStep = getSpell("misty-step");
    expect(mistyStep).toBeDefined();
    expect(mistyStep!.level).toBe(2);
    expect(mistyStep!.school).toBe("conjuration");
    expect(mistyStep!.range).toEqual({ value: 0, unit: "self" });
    expect(mistyStep!.duration.unit).toBe("instantaneous");
    expect(mistyStep!.kind).toBe("environment");

    // 7. Counterspell
    const counterspell = getSpell("counterspell");
    expect(counterspell).toBeDefined();
    expect(counterspell!.level).toBe(3);
    expect(counterspell!.school).toBe("abjuration");
    expect(counterspell!.range).toEqual({ value: 60, unit: "feet" });
    expect(counterspell!.duration.unit).toBe("instantaneous");

    // 8. Revivify
    const revivify = getSpell("revivify");
    expect(revivify).toBeDefined();
    expect(revivify!.level).toBe(3);
    expect(revivify!.school).toBe("necromancy");
    expect(revivify!.range).toEqual({ value: 0, unit: "touch" });
    expect(revivify!.duration.unit).toBe("instantaneous");
    expect(revivify!.kind).toBe("healing");

    // 9. Wish
    const wish = getSpell("wish");
    expect(wish).toBeDefined();
    expect(wish!.level).toBe(9);
    expect(wish!.school).toBe("conjuration");
    expect(wish!.range).toEqual({ value: 0, unit: "self" });
    expect(wish!.duration.unit).toBe("instantaneous");

    // 10. Eldritch Blast
    const eldritchBlast = getSpell("eldritch-blast");
    expect(eldritchBlast).toBeDefined();
    expect(eldritchBlast!.level).toBe(0);
    expect(eldritchBlast!.school).toBe("evocation");
    expect(eldritchBlast!.range).toEqual({ value: 120, unit: "feet" });
    expect(eldritchBlast!.duration.unit).toBe("instantaneous");
    expect(eldritchBlast!.diceFormula).toBe("1d10");
  });

  it("4. learnSpell enforces level caps, duplicates, and capacity without mutation", () => {
    const book: Spellbook = {
      knownSpells: ["magic-missile"],
      maxCapacity: 2,
    };

    // 1. Spell not in registry
    const unknownRes = learnSpell(book, "abracadabra", 5);
    expect(unknownRes.success).toBe(false);
    expect(unknownRes.reason).toContain("does not exist");

    // 2. Already known
    const dupRes = learnSpell(book, "magic-missile", 5);
    expect(dupRes.success).toBe(false);
    expect(dupRes.reason).toContain("already known");

    // 3. Level cap check: Caster level 1 cannot learn level 3 fireball (max castable: 1)
    const tooHighRes = learnSpell(book, "fireball", 1);
    expect(tooHighRes.success).toBe(false);
    expect(tooHighRes.reason).toContain("cannot learn 3rd-level spells");

    // 4. Success learning: Caster level 5 can learn fireball
    const successRes = learnSpell(book, "fireball", 5);
    expect(successRes.success).toBe(true);
    expect(successRes.newSpellbook?.knownSpells).toEqual(["magic-missile", "fireball"]);
    // Original book is unchanged (pure)
    expect(book.knownSpells).toEqual(["magic-missile"]);

    // 5. Capacity check: full book cannot learn more
    const fullRes = learnSpell(successRes.newSpellbook!, "shield", 5);
    expect(fullRes.success).toBe(false);
    expect(fullRes.reason).toContain("Spellbook is full");
  });

  it("5. Pure Evaluator: does NOT mutate input caster and is idempotent", () => {
    const rng = new SeededRNG(42);
    const mageCaster: CasterState = {
      characterName: "Melf",
      characterClass: "mage",
      level: 5,
      currentMana: 50,
      maxMana: 50,
      activeStatusEffects: [],
    };

    // First call
    const res1 = SpellEvaluator.castSpell(fireballSpell, mageCaster, rng);
    expect(res1.success).toBe(true);
    expect(res1.manaSpent).toBe(15);
    expect(res1.remainingMana).toBe(35);
    expect(res1.newCasterState.currentMana).toBe(35);

    // Verify original caster was NOT mutated
    expect(mageCaster.currentMana).toBe(50);
    expect(mageCaster.activeStatusEffects).toHaveLength(0);

    // Second call with same state & seed produces identical result
    const rng2 = new SeededRNG(42);
    const res2 = SpellEvaluator.castSpell(fireballSpell, mageCaster, rng2);
    expect(res2.success).toBe(true);
    expect(res2.manaSpent).toBe(res1.manaSpent);
    expect(res2.remainingMana).toBe(res1.remainingMana);
    expect(res2.totalRoll).toBe(res1.totalRoll);
    expect(res2.newCasterState.currentMana).toBe(35);

    // Caster remains unmutated
    expect(mageCaster.currentMana).toBe(50);
  });

  it("6. Validator flags UNKNOWN_SPELL_REFERENCE for unresolved spells", () => {
    const testAdv = JSON.parse(JSON.stringify(serpentAltarAdventure)) as VersionedAdventure;
    testAdv.adventure.locations[0].interactables = [
      {
        id: "inter-altar",
        label: "Arcane Altar",
        description: "An altar humming with magic.",
        spellIds: ["fireball", "non-existent-spell-xyz"],
      },
    ];
    testAdv.adventure.locations[0].encounter = {
      id: "enc-cultists",
      trigger: { kind: "always" },
      enemies: [],
      spellIds: ["cure-wounds", "bogus-spell-123"],
    };
    testAdv.adventure.locations[0].boundaries = {
      hazards: [
        {
          id: "haz-glyphtrap",
          type: "noxious-fumes",
          dc: 14,
          description: "A magical glyph trap",
          spellIds: ["cloudkill", "fake-hazard-spell"],
        },
      ],
    };
    testAdv.adventure.npcs = [
      {
        id: "npc-wizard",
        name: "Hermit Wizard",
        disposition: "friendly",
        locationId: testAdv.adventure.locations[0].id,
        dialogueText: "Greetings adventurer.",
        spellIds: ["magic-missile", "totally-invalid-spell"],
      },
    ];

    const result = validateAdventure(testAdv);
    const spellIssues = result.issues.filter((i) => i.code === "UNKNOWN_SPELL_REFERENCE");
    expect(spellIssues.length).toBe(4);
    expect(spellIssues.some((i) => i.message.includes("non-existent-spell-xyz"))).toBe(true);
    expect(spellIssues.some((i) => i.message.includes("bogus-spell-123"))).toBe(true);
    expect(spellIssues.some((i) => i.message.includes("fake-hazard-spell"))).toBe(true);
    expect(spellIssues.some((i) => i.message.includes("totally-invalid-spell"))).toBe(true);
  });

  it("7. Validator accepts custom adventure spells defined in adventure.spells", () => {
    const customSpell: Spell = {
      id: "custom-sunburst-nova",
      name: "Sunburst Nova",
      school: "evocation",
      level: 4,
      manaCost: 7,
      kind: "damage",
      targetType: "allEnemies",
      diceFormula: "6d8",
      scaleWithCasterLevel: false,
      allowedClasses: ["cleric", "wizard"],
      range: { value: 60, unit: "feet" },
      duration: { value: 0, unit: "instantaneous" },
      castingTime: { value: 1, unit: "action" },
      components: { verbal: true, somatic: true },
      description: "A custom brilliant burst of solar energy.",
    };

    const testAdv = JSON.parse(JSON.stringify(serpentAltarAdventure)) as VersionedAdventure;
    testAdv.adventure.spells = [customSpell];
    testAdv.adventure.locations[0].interactables = [
      {
        id: "inter-altar",
        label: "Arcane Altar",
        description: "An altar humming with magic.",
        spellIds: ["custom-sunburst-nova", "fireball"],
      },
    ];
    testAdv.adventure.npcs = [
      {
        id: "npc-priest",
        name: "High Priest",
        disposition: "friendly",
        locationId: testAdv.adventure.locations[0].id,
        dialogueText: "Praise the light.",
        spellIds: ["custom-sunburst-nova"],
      },
    ];

    const result = validateAdventure(testAdv);
    const spellIssues = result.issues.filter((i) => i.code === "UNKNOWN_SPELL_REFERENCE");
    expect(spellIssues.length).toBe(0);
  });
});
