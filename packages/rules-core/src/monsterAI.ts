import { MonsterTemplate } from "@grimoire3d/ir";
import { SeededRNG } from "./rules";

export type MonsterActionType = "melee" | "ranged" | "disengage" | "special" | "flee";

export interface MonsterTurnDecision {
  action: MonsterActionType;
  description: string;
  hasAdvantage: boolean;
  bonusDamage: number;
  specialEffect?: string;
  breaksMorale: boolean;
}

export function executeMonsterAI(
  monster: MonsterTemplate,
  currentMonsterHp: number,
  playerStats: { hp: number; ac: number; distanceFeet?: number; isAlone?: boolean },
  alliedMonstersRemaining: number,
  rng: SeededRNG
): MonsterTurnDecision {
  const hpPercent = currentMonsterHp / monster.hp;
  const role = monster.role || "soldier";
  const traits = monster.traits || [];

  // 1. Morale / Flee Check (DMG / Monster Manual rules)
  // Non-mindless monsters test morale when bloodied (HP <= 30%) and outnumbered
  if (hpPercent <= 0.3 && !traits.includes("undead") && monster.creatureType !== "undead") {
    const baseMorale = monster.morale || 7;
    const d1 = rng.rollDice(6);
    const d2 = rng.rollDice(6);
    if (d1 + d2 > baseMorale) {
      return {
        action: "flee",
        description: `${monster.name} panics as blood pours from wounds! Morale broken (rolled ${d1 + d2} vs Morale ${baseMorale}). Fleeing into the shadows!`,
        hasAdvantage: false,
        bonusDamage: 0,
        breaksMorale: true,
      };
    }
  }

  // 2. Special Trait: Petrifying Gaze (e.g., Basilisk)
  if (traits.includes("petrifying-gaze")) {
    return {
      action: "special",
      description: `${monster.name} fixes its luminescent pale eyes upon you! Petrifying Gaze demands a DC 14 Constitution saving throw!`,
      hasAdvantage: false,
      bonusDamage: 0,
      specialEffect: "petrifying-gaze",
      breaksMorale: false,
    };
  }

  // 3. Archetype: Skirmisher (e.g. Goblin, Kobold) - Nimble Escape
  if (role === "skirmisher") {
    // If bloodied or cornered, uses Nimble Escape to disengage and shoot from range
    if (hpPercent < 0.5) {
      return {
        action: "ranged",
        description: `${monster.name} uses Nimble Escape to scramble backward out of sword reach, loosing a hasty arrow!`,
        hasAdvantage: false,
        bonusDamage: 0,
        breaksMorale: false,
      };
    }
  }

  // 4. Trait: Pack Tactics (e.g. Kobolds, Wolves) & Soldier Archetype (e.g. Hobgoblins)
  let hasAdvantage = false;
  if ((traits.includes("pack-tactics") || role === "soldier") && alliedMonstersRemaining > 1) {
    hasAdvantage = true; // Flanking ally grants advantage on attack roll!
  }

  // 5. Archetype: Brute (e.g. Ogre, Troglodyte)
  if (role === "brute") {
    const recklessRoll = rng.rollDice(4);
    if (recklessRoll === 4) {
      return {
        action: "melee",
        description: `${monster.name} winds up a reckless power swing with bone-crushing momentum! (+3 bonus damage)`,
        hasAdvantage: true,
        bonusDamage: 3,
        breaksMorale: false,
      };
    }
  }

  // 6. Archetype: Predator (e.g. Giant Spider, Crocodile)
  if (role === "predator") {
    const ambush = rng.rollDice(3) === 1;
    if (ambush) {
      return {
        action: "special",
        description: `${monster.name} strikes with predatory instinct, aiming to grasp and entangle!`,
        hasAdvantage: true,
        bonusDamage: 2,
        specialEffect: "grab",
        breaksMorale: false,
      };
    }
  }

  // Default Melee Attack
  const advantageText = hasAdvantage ? " (flanking with Pack Tactics - roll with Advantage!)" : "";
  return {
    action: "melee",
    description: `${monster.name} lunges forward with a vicious strike${advantageText}.`,
    hasAdvantage,
    bonusDamage: 0,
    breaksMorale: false,
  };
}
