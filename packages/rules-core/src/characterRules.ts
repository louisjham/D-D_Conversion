import { PlayerCharacter } from "@grimoire3d/ir";
import { SeededRNG, CheckResult } from "./rules";

export type AbilityName = "str" | "dex" | "con" | "int" | "wis" | "cha";
export type RaceName = "human" | "elf" | "dwarf" | "halfling" | "gnome";
export type ClassName = "fighter" | "rogue" | "cleric" | "wizard";

export function calcAbilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export interface RacialBonus {
  abilityBonuses: Partial<Record<AbilityName, number>>;
  speed: number;
  traits: string[];
}

export function getRacialTraits(race: RaceName): RacialBonus {
  switch (race) {
    case "human":
      return {
        abilityBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
        speed: 30,
        traits: ["versatile", "human-inspiration"],
      };
    case "elf":
      return {
        abilityBonuses: { dex: 2, int: 1 },
        speed: 30,
        traits: ["darkvision", "keen-senses", "fey-ancestry", "trance"],
      };
    case "dwarf":
      return {
        abilityBonuses: { con: 2, str: 1 },
        speed: 25,
        traits: ["darkvision", "dwarven-resilience", "stonecunning", "dwarven-toughness"],
      };
    case "halfling":
      return {
        abilityBonuses: { dex: 2, cha: 1 },
        speed: 25,
        traits: ["lucky", "brave", "halfling-nimbleness"],
      };
    case "gnome":
      return {
        abilityBonuses: { int: 2, con: 1 },
        speed: 25,
        traits: ["darkvision", "gnome-cunning"],
      };
  }
}

export interface ClassDefinition {
  hitDie: number;
  primaryAbility: AbilityName;
  savingThrows: AbilityName[];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  classFeatures: string[];
}

export function getClassDefinition(className: ClassName, level: number = 1): ClassDefinition {
  switch (className) {
    case "fighter":
      return {
        hitDie: 10,
        primaryAbility: "str",
        savingThrows: ["str", "con"],
        armorProficiencies: ["all-armor", "shields"],
        weaponProficiencies: ["simple", "martial"],
        classFeatures: ["second-wind", "fighting-style", level >= 2 ? "action-surge" : ""].filter(Boolean),
      };
    case "rogue":
      return {
        hitDie: 8,
        primaryAbility: "dex",
        savingThrows: ["dex", "int"],
        armorProficiencies: ["light-armor"],
        weaponProficiencies: ["simple", "hand-crossbow", "longsword", "rapier", "shortsword"],
        classFeatures: ["sneak-attack", "thieves-cant", "expertise", level >= 2 ? "cunning-action" : ""].filter(Boolean),
      };
    case "cleric":
      return {
        hitDie: 8,
        primaryAbility: "wis",
        savingThrows: ["wis", "cha"],
        armorProficiencies: ["light-armor", "medium-armor", "shields"],
        weaponProficiencies: ["simple"],
        classFeatures: ["spellcasting", "divine-domain", level >= 2 ? "turn-undead" : ""].filter(Boolean),
      };
    case "wizard":
      return {
        hitDie: 6,
        primaryAbility: "int",
        savingThrows: ["int", "wis"],
        armorProficiencies: [],
        weaponProficiencies: ["daggers", "darts", "slings", "quarterstaffs", "light-crossbows"],
        classFeatures: ["spellcasting", "spellbook", "arcane-recovery"],
      };
  }
}

export function createStandardCharacter(options?: {
  name?: string;
  race?: RaceName;
  class?: ClassName;
  level?: number;
  baseAbilities?: Record<AbilityName, number>;
}): PlayerCharacter {
  const race = options?.race || "human";
  const className = options?.class || "fighter";
  const level = options?.level || 1;
  const name = options?.name || "Valeros the Bold";

  const defaultScores: Record<ClassName, Record<AbilityName, number>> = {
    fighter: { str: 16, dex: 13, con: 14, int: 9, wis: 12, cha: 10 },
    rogue: { str: 10, dex: 16, con: 12, int: 14, wis: 13, cha: 12 },
    cleric: { str: 14, dex: 10, con: 14, int: 10, wis: 16, cha: 12 },
    wizard: { str: 8, dex: 14, con: 13, int: 16, wis: 12, cha: 10 },
  };

  const base = options?.baseAbilities || defaultScores[className];
  const racial = getRacialTraits(race);
  const classDef = getClassDefinition(className, level);

  const abilities = {
    str: base.str + (racial.abilityBonuses.str || 0),
    dex: base.dex + (racial.abilityBonuses.dex || 0),
    con: base.con + (racial.abilityBonuses.con || 0),
    int: base.int + (racial.abilityBonuses.int || 0),
    wis: base.wis + (racial.abilityBonuses.wis || 0),
    cha: base.cha + (racial.abilityBonuses.cha || 0),
  };

  const conMod = calcAbilityMod(abilities.con);
  const dexMod = calcAbilityMod(abilities.dex);

  // Dwarf Toughness gives +1 HP per level
  const dwarfBonus = racial.traits.includes("dwarven-toughness") ? level : 0;
  // Max HP at 1st level = Hit Die + CON mod; subsequent levels = avg + CON mod
  const hpLevel1 = classDef.hitDie + conMod + dwarfBonus;
  const hpSubsequent = Math.max(1, Math.floor(classDef.hitDie / 2) + 1 + conMod) * (level - 1);
  const maxHp = Math.max(1, hpLevel1 + hpSubsequent);

  // Armor Class: Fighter (Chain mail 16 + Shield 2 = 18), Rogue (Leather 11 + DEX = 14), etc.
  let ac = 10 + dexMod;
  if (className === "fighter") ac = 18; // Chain mail + shield
  else if (className === "cleric") ac = 16; // Scale mail + shield
  else if (className === "rogue") ac = 11 + dexMod;

  const proficiencyBonus = 2 + Math.floor((level - 1) / 4);

  return {
    id: `pc-${className}-${race}`,
    name,
    race,
    class: className,
    level,
    abilities,
    hp: maxHp,
    maxHp,
    ac,
    proficiencyBonus,
    speed: racial.speed,
    traits: racial.traits,
    classFeatures: classDef.classFeatures,
    inventory: ["torch", "potion-healing"],
    spentFeatures: [],
  };
}

export function resolveCharacterCheck(
  character: PlayerCharacter,
  ability: AbilityName,
  dc: number,
  rng: SeededRNG,
  context?: { isPoison?: boolean; isStone?: boolean; hasAdvantage?: boolean }
): CheckResult {
  let mod = calcAbilityMod(character.abilities[ability]);

  // Dwarf Stonecunning: +3 bonus on stone/pit checks
  if (context?.isStone && character.traits.includes("stonecunning")) {
    mod += 3;
  }

  // Elf Keen Senses: +2 to Perception (Wisdom)
  if (ability === "wis" && character.traits.includes("keen-senses")) {
    mod += 2;
  }

  let roll = rng.rollD20();

  // Halfling Lucky: reroll any natural 1!
  if (roll === 1 && character.traits.includes("lucky")) {
    roll = rng.rollD20();
  }

  // Dwarf Resilience / Advantage: roll twice, take higher
  const hasAdv =
    context?.hasAdvantage ||
    (context?.isPoison && character.traits.includes("dwarven-resilience"));

  if (hasAdv) {
    let secondRoll = rng.rollD20();
    if (secondRoll === 1 && character.traits.includes("lucky")) {
      secondRoll = rng.rollD20();
    }
    roll = Math.max(roll, secondRoll);
  }

  const isNat20 = roll === 20;
  const isNat1 = roll === 1;
  const total = roll + mod;
  const success = isNat20 || (!isNat1 && total >= dc);

  return { success, roll, bonus: mod, total, dc, isNat20, isNat1 };
}

export function useSecondWind(
  character: PlayerCharacter,
  rng: SeededRNG
): { success: boolean; healed: number; message: string } {
  if (!character.classFeatures.includes("second-wind")) {
    return { success: false, healed: 0, message: "Only fighters possess Second Wind." };
  }
  if (character.spentFeatures?.includes("second-wind")) {
    return { success: false, healed: 0, message: "Second Wind already expended. Recover with rest." };
  }

  const roll = rng.rollDice(10);
  const healed = roll + character.level;
  character.hp = Math.min(character.maxHp, character.hp + healed);
  character.spentFeatures = [...(character.spentFeatures || []), "second-wind"];

  return {
    success: true,
    healed,
    message: `Used Second Wind! Rolled 1d10 (${roll}) + level ${character.level} = restored ${healed} HP (${character.hp}/${character.maxHp}).`,
  };
}
