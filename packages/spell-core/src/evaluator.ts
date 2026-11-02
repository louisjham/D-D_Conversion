import { SeededRNG } from "@grimoire3d/rules-core";
import { Spell, CasterState, SpellCastResult, StatusEffect } from "./types";

function parseAndRollDice(diceStr: string, rng: SeededRNG): number {
  if (!diceStr || diceStr === "0") return 0;
  const match = diceStr.trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!match) {
    const num = parseInt(diceStr, 10);
    return isNaN(num) ? 0 : num;
  }
  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const mod = match[3] ? parseInt(match[3], 10) : 0;
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += rng.rollDice(sides);
  }
  return Math.max(0, total + mod);
}

export class SpellEvaluator {
  public static castSpell(
    spell: Spell,
    caster: CasterState,
    rng: SeededRNG
  ): SpellCastResult {
    // Pure copy of caster state - no mutation on input caster
    const newCasterState: CasterState = {
      ...caster,
      activeStatusEffects: [...caster.activeStatusEffects],
    };

    // 1. Class Lock Check
    if (spell.allowedClasses.length > 0 && !spell.allowedClasses.includes(caster.characterClass)) {
      return {
        success: false,
        message: `${caster.characterName} (${caster.characterClass}) cannot cast '${spell.name}'. Class restricted.`,
        manaSpent: 0,
        remainingMana: caster.currentMana,
        totalRoll: 0,
        appliedEffects: [],
        newCasterState,
      };
    }

    // 2. Mana Check
    if (caster.currentMana < spell.manaCost) {
      return {
        success: false,
        message: `Insufficient mana to cast '${spell.name}'. Required: ${spell.manaCost}, Current: ${caster.currentMana}.`,
        manaSpent: 0,
        remainingMana: caster.currentMana,
        totalRoll: 0,
        appliedEffects: [],
        newCasterState,
      };
    }

    // 3. Deduct Mana
    newCasterState.currentMana -= spell.manaCost;

    // 4. Calculate Dice Scaling
    let totalRoll = 0;
    const baseRoll = parseAndRollDice(spell.diceFormula, rng);
    if (spell.scaleWithCasterLevel) {
      totalRoll = baseRoll * Math.max(1, caster.level);
    } else {
      totalRoll = baseRoll;
    }

    // 5. Apply Status Effects
    const appliedEffects: StatusEffect[] = [];
    if (spell.statusEffects) {
      for (const eff of spell.statusEffects) {
        newCasterState.activeStatusEffects.push(eff);
        appliedEffects.push(eff);
      }
    }

    const actionTerm =
      spell.kind === "healing"
        ? "healed for"
        : spell.kind === "damage"
        ? "dealt"
        : "effect magnitude";
    const msg = `${caster.characterName} cast '${spell.name}' (${spell.school})! ${actionTerm} ${totalRoll}.`;

    return {
      success: true,
      message: msg,
      manaSpent: spell.manaCost,
      remainingMana: newCasterState.currentMana,
      totalRoll,
      appliedEffects,
      newCasterState,
    };
  }
}
