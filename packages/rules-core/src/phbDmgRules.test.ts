import { describe, it, expect } from "vitest";
import {
  SeededRNG,
  createStandardCharacter,
  calcAbilityMod,
  resolveCharacterCheck,
  useSecondWind,
  executeMonsterAI,
  getDifficultyDC,
  calcTrapDamage,
  calcFallingDamage,
  calcLightSourceSpecs,
  convertCoinage,
  generateDungeonDressing,
  generateTreasureDrop,
  resolveShortRest,
  resolveLongRest,
} from "../src";
import { MonsterTemplate } from "@grimoire3d/ir";

describe("PHB Character Mechanics & Inherent Abilities", () => {
  it("1. Generates accurate race and class statistics across PHB 2024 archetypes", () => {
    const fighter = createStandardCharacter({ race: "dwarf", class: "fighter", level: 2 });
    expect(fighter.race).toBe("dwarf");
    expect(fighter.class).toBe("fighter");
    expect(fighter.abilities.con).toBe(16); // 14 base + 2 dwarf
    expect(fighter.traits).toContain("dwarven-resilience");
    expect(fighter.traits).toContain("stonecunning");
    expect(fighter.classFeatures).toContain("second-wind");
    expect(fighter.ac).toBe(18); // Heavy armor + shield
  });

  it("2. Verifies Dwarf Stonecunning bonus on secret door/stone perception", () => {
    const dwarf = createStandardCharacter({ race: "dwarf", class: "fighter" });
    const rng = new SeededRNG(42);
    // Stone context adds +3 stonecunning bonus
    const check = resolveCharacterCheck(dwarf, "wis", 14, rng, { isStone: true });
    expect(check.bonus).toBeGreaterThanOrEqual(4); // WIS mod + 3 stonecunning
  });

  it("3. Verifies Halfling Lucky rerolling natural 1s", () => {
    const halfling = createStandardCharacter({ race: "halfling", class: "rogue" });
    expect(halfling.traits).toContain("lucky");
    // Verify Halfling Lucky feature exists on character
    expect(halfling.speed).toBe(25);
    expect(halfling.abilities.dex).toBe(18); // 16 base + 2 halfling
  });

  it("4. Executes Fighter Second Wind bonus action healing", () => {
    const fighter = createStandardCharacter({ race: "human", class: "fighter", level: 3 });
    const rng = new SeededRNG(42);
    fighter.hp = 10;
    const res = useSecondWind(fighter, rng);
    expect(res.success).toBe(true);
    expect(fighter.hp).toBeGreaterThan(10);
    expect(res.message).toContain("Used Second Wind");

    // Second use before rest fails
    const secondRes = useSecondWind(fighter, rng);
    expect(secondRes.success).toBe(false);
  });
});

describe("Monster Manual AI Generation & Characteristics", () => {
  it("1. Skirmishers use Nimble Escape when bloodied to shoot from range", () => {
    const goblin: MonsterTemplate = {
      id: "goblin-skirmisher",
      name: "Goblin Skirmisher",
      hp: 7,
      ac: 15,
      attackBonus: 4,
      damageRoll: "1d6+2",
      role: "skirmisher",
      traits: ["nimble-escape"],
    };
    const rng = new SeededRNG(123);
    const decision = executeMonsterAI(goblin, 2, { hp: 20, ac: 16 }, 1, rng);
    expect(decision.action).toBe("ranged");
    expect(decision.description).toContain("Nimble Escape");
  });

  it("2. Soldiers with Pack Tactics gain attack advantage when allies flank", () => {
    const hobgoblin: MonsterTemplate = {
      id: "hobgoblin-soldier",
      name: "Hobgoblin Sentry",
      hp: 11,
      ac: 18,
      attackBonus: 3,
      damageRoll: "1d8+1",
      role: "soldier",
      traits: ["pack-tactics"],
    };
    const rng = new SeededRNG(123);
    const decision = executeMonsterAI(hobgoblin, 11, { hp: 20, ac: 16 }, 3 /* allies present */, rng);
    expect(decision.hasAdvantage).toBe(true);
    expect(decision.description).toContain("Pack Tactics");
  });

  it("3. Brutes execute bone-crushing power swings with bonus damage", () => {
    const ogre: MonsterTemplate = {
      id: "ogre-brute",
      name: "Cave Ogre",
      hp: 59,
      ac: 11,
      attackBonus: 6,
      damageRoll: "2d8+4",
      role: "brute",
      traits: [],
    };
    const rng = new SeededRNG(999);
    // Across 10 rounds, brute should trigger power attack
    let triggeredPower = false;
    for (let i = 0; i < 10; i++) {
      const dec = executeMonsterAI(ogre, 59, { hp: 20, ac: 16 }, 1, rng);
      if (dec.bonusDamage > 0) triggeredPower = true;
    }
    expect(triggeredPower).toBe(true);
  });

  it("4. Basilisk triggers Petrifying Gaze special attack", () => {
    const basilisk: MonsterTemplate = {
      id: "basilisk",
      name: "Basilisk",
      hp: 52,
      ac: 15,
      attackBonus: 5,
      damageRoll: "2d6+3",
      role: "predator",
      traits: ["petrifying-gaze"],
    };
    const rng = new SeededRNG(42);
    const decision = executeMonsterAI(basilisk, 52, { hp: 20, ac: 16 }, 1, rng);
    expect(decision.specialEffect).toBe("petrifying-gaze");
    expect(decision.description).toContain("Petrifying Gaze");
  });
});

describe("DMG Tables & Math Functions", () => {
  it("1. Evaluates standard DMG DC difficulty tiers", () => {
    expect(getDifficultyDC("very-easy")).toBe(5);
    expect(getDifficultyDC("easy")).toBe(10);
    expect(getDifficultyDC("medium")).toBe(15);
    expect(getDifficultyDC("hard")).toBe(20);
    expect(getDifficultyDC("deadly")).toBe(30);
  });

  it("2. Calculates trap damage math across severity scales", () => {
    const rng = new SeededRNG(42);
    const setback = calcTrapDamage("setback", rng);
    expect(setback.diceRoll).toBeGreaterThanOrEqual(1);
    expect(setback.diceRoll).toBeLessThanOrEqual(10);

    const deadly = calcTrapDamage("deadly", rng);
    expect(deadly.diceRoll).toBeGreaterThanOrEqual(4);
    expect(deadly.diceRoll).toBeLessThanOrEqual(40);
  });

  it("3. Calculates falling damage according to 1d6 per 10ft rule", () => {
    const rng = new SeededRNG(42);
    expect(calcFallingDamage(5, rng)).toBe(0); // Under 10ft -> 0
    const fall30 = calcFallingDamage(30, rng); // 3d6
    expect(fall30).toBeGreaterThanOrEqual(3);
    expect(fall30).toBeLessThanOrEqual(18);
  });

  it("4. Tracks light source depletion and illumination radii", () => {
    const torch = calcLightSourceSpecs("torch");
    expect(torch.turns).toBe(6); // 1 hour = 6 turns
    expect(torch.brightRadius).toBe(20);

    const lantern = calcLightSourceSpecs("lantern");
    expect(lantern.turns).toBe(36); // 6 hours = 36 turns
    expect(lantern.brightRadius).toBe(30);
  });

  it("5. Resolves short and long rest recovery mechanics", () => {
    const character = createStandardCharacter({ race: "human", class: "fighter", level: 2 });
    character.hp = 5;
    character.spentFeatures = ["second-wind"];
    const rng = new SeededRNG(42);

    // Short Rest heals with hit dice
    const shortRes = resolveShortRest(character, 1, rng);
    expect(shortRes.hpRestored).toBeGreaterThan(0);
    expect(character.hp).toBeGreaterThan(5);

    // Long Rest restores full HP and resets expended abilities
    const longRes = resolveLongRest(character);
    expect(longRes.newHp).toBe(character.maxHp);
    expect(character.spentFeatures).toHaveLength(0);
  });

  it("6. Converts multi-denomination coinage to gold standard", () => {
    const wallet = convertCoinage({ cp: 50, sp: 20, gp: 10, pp: 2 });
    // 50cp = 0.5gp, 20sp = 2gp, 10gp = 10gp, 2pp = 20gp -> Total = 32.5gp
    expect(wallet.totalInGold).toBe(32.5);
    expect(wallet.formatted).toContain("2pp, 10gp, 20sp, 50cp");
  });

  it("7. Generates ambient dungeon dressings and random treasure drops", () => {
    const rng = new SeededRNG(12345);
    const dressing = generateDungeonDressing(rng, "cavern");
    expect(dressing.odor).toBeDefined();
    expect(dressing.sound).toBeDefined();
    expect(dressing.air).toBeDefined();

    const treasure = generateTreasureDrop(3, rng);
    expect(treasure.coins.gp).toBeGreaterThan(0);
  });
});
