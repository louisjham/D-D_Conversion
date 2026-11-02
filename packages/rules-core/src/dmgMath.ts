import { SeededRNG } from "./rules";
import { PlayerCharacter } from "@grimoire3d/ir";
import { calcAbilityMod, getClassDefinition } from "./characterRules";

export type DifficultyTier = "very-easy" | "easy" | "medium" | "hard" | "very-hard" | "deadly";

export function getDifficultyDC(tier: DifficultyTier): number {
  switch (tier) {
    case "very-easy":
      return 5;
    case "easy":
      return 10;
    case "medium":
      return 15;
    case "hard":
      return 20;
    case "very-hard":
      return 25;
    case "deadly":
      return 30;
  }
}

export function calcTrapDamage(
  severity: "setback" | "dangerous" | "deadly",
  rng: SeededRNG
): { diceRoll: number; damageText: string } {
  let diceCount = 1;
  if (severity === "dangerous") diceCount = 2;
  if (severity === "deadly") diceCount = 4;

  let total = 0;
  for (let i = 0; i < diceCount; i++) {
    total += rng.rollDice(10);
  }
  return {
    diceRoll: total,
    damageText: `${diceCount}d10 (${total} damage)`,
  };
}

export function calcFallingDamage(distanceFeet: number, rng: SeededRNG): number {
  const d6Count = Math.min(20, Math.floor(distanceFeet / 10));
  if (d6Count <= 0) return 0;
  let total = 0;
  for (let i = 0; i < d6Count; i++) {
    total += rng.rollDice(6);
  }
  return total;
}

export function calcLightSourceSpecs(source: "torch" | "lantern" | "candle" | "spell"): {
  turns: number;
  brightRadius: number;
  dimRadius: number;
} {
  switch (source) {
    case "torch":
      return { turns: 6, brightRadius: 20, dimRadius: 20 };
    case "lantern":
      return { turns: 36, brightRadius: 30, dimRadius: 30 };
    case "candle":
      return { turns: 6, brightRadius: 5, dimRadius: 5 };
    case "spell":
      return { turns: 6, brightRadius: 20, dimRadius: 20 };
  }
}

export function resolveShortRest(
  character: PlayerCharacter,
  diceToSpend: number,
  rng: SeededRNG
): { hpRestored: number; newHp: number; message: string } {
  const classDef = getClassDefinition(character.class, character.level);
  const conMod = calcAbilityMod(character.abilities.con);

  let totalRestored = 0;
  for (let i = 0; i < diceToSpend; i++) {
    const roll = rng.rollDice(classDef.hitDie);
    const heal = Math.max(1, roll + conMod);
    totalRestored += heal;
  }

  const prevHp = character.hp;
  character.hp = Math.min(character.maxHp, character.hp + totalRestored);
  const actualHealed = character.hp - prevHp;

  return {
    hpRestored: actualHealed,
    newHp: character.hp,
    message: `Short Rest completed (1 hour). Expended ${diceToSpend}d${classDef.hitDie} hit dice -> Restored ${actualHealed} HP (${character.hp}/${character.maxHp}).`,
  };
}

export function resolveLongRest(character: PlayerCharacter): {
  hpRestored: number;
  newHp: number;
  featuresReset: string[];
  message: string;
} {
  const prevHp = character.hp;
  character.hp = character.maxHp;
  const featuresReset = [...(character.spentFeatures || [])];
  character.spentFeatures = [];

  const actualHealed = character.hp - prevHp;
  return {
    hpRestored: actualHealed,
    newHp: character.maxHp,
    featuresReset,
    message: `Long Rest completed (8 hours in safe haven). Restored to full HP (${character.maxHp}) and refreshed all class abilities (${featuresReset.join(", ") || "none expended"}).`,
  };
}

export function convertCoinage(coins: {
  cp?: number;
  sp?: number;
  gp?: number;
  pp?: number;
}): { totalInGold: number; formatted: string } {
  const cp = coins.cp || 0;
  const sp = coins.sp || 0;
  const gp = coins.gp || 0;
  const pp = coins.pp || 0;

  const totalInGold = cp * 0.01 + sp * 0.1 + gp + pp * 10;
  const parts = [];
  if (pp > 0) parts.push(`${pp}pp`);
  if (gp > 0) parts.push(`${gp}gp`);
  if (sp > 0) parts.push(`${sp}sp`);
  if (cp > 0) parts.push(`${cp}cp`);

  return {
    totalInGold: Math.round(totalInGold * 100) / 100,
    formatted: parts.join(", ") || "0gp",
  };
}

export function generateDungeonDressing(
  rng: SeededRNG,
  biome: string = "cavern"
): { odor: string; sound: string; air: string } {
  const odors = [
    "Damp rotting straw and decaying wood",
    "Faint metallic tang of ozone and sulfur",
    "Pungent animal musk and stale bat guano",
    "Musty earthen dust from long-undisturbed tombs",
    "Charcoal smoke, animal fat, and roasted tubers",
  ];
  const sounds = [
    "Distant water droplets echoing rhythmically into unseen pools",
    "Faint scratching of insect legs across rough masonry",
    "Low whistling draft funneled through hairline fractures",
    "Muffled guttural mumbling that abruptly fades into stillness",
    "A soft scrape of gravel as if something shifted weight in the dark",
  ];
  const airs = [
    "Cold clammy draft rising from lower chasms",
    "Stagnant, suffocating stillness smelling of dry bone",
    "Humid mist condensing on slick cavern flagstones",
    "Brisk chilly airflow carrying the scent of rain from outside",
  ];

  const odor = odors[rng.rollDice(odors.length) - 1];
  const sound = sounds[rng.rollDice(sounds.length) - 1];
  const air = airs[rng.rollDice(airs.length) - 1];

  return { odor, sound, air };
}

export function generateTreasureDrop(
  challengeRating: number,
  rng: SeededRNG
): { coins: { gp: number; sp: number }; gem?: string; item?: string } {
  const multiplier = Math.max(1, challengeRating);
  const gp = rng.rollDice(10) * 5 * multiplier;
  const sp = rng.rollDice(10) * 10 * multiplier;

  const gemRoll = rng.rollDice(6);
  let gem: string | undefined;
  if (gemRoll >= 4) {
    const gems = [
      "Banded Agate (10gp)",
      "Tiger Eye (10gp)",
      "Bloodstone (50gp)",
      "Carnelian (50gp)",
      "Amber Gemstone (100gp)",
      "Garnet (100gp)",
    ];
    gem = gems[rng.rollDice(gems.length) - 1];
  }

  const magicRoll = rng.rollDice(20);
  let item: string | undefined;
  if (magicRoll >= 18) {
    const minorMagic = [
      "Potion of Healing",
      "Spell Scroll (Radiant Light)",
      "Potion of Invisibility",
      "Ring of Protection +1",
    ];
    item = minorMagic[rng.rollDice(minorMagic.length) - 1];
  }

  return { coins: { gp, sp }, gem, item };
}
