import { SeededRNG } from "@grimoire3d/rules-core";
import { parseAndRollDice } from "@grimoire3d/simulator";
import { Spell, CasterState, SpellCastResult, StatusEffect } from "./types";

export class SpellEvaluator {
  public static castSpell(
    spell: Spell,
    caster: CasterState,
    rng: SeededRNG
  ): SpellCastResult {
    // 1. Class Lock Check
    if (spell.allowedClasses.length > 0 && !spell.allowedClasses.includes(caster.characterClass)) {
      return {
        success: false,
        message: `${caster.characterName} (${caster.characterClass}) cannot cast '${spell.name}'. Class restricted.`,
        manaSpent: 0,
        remainingMana: caster.currentMana,
        totalRoll: 0,
        appliedEffects: [],
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
      };
    }

    // 3. Deduct Mana
    caster.currentMana -= spell.manaCost;

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
        caster.activeStatusEffects.push(eff);
        appliedEffects.push(eff);
      }
    }

    const actionTerm = spell.kind === "healing" ? "healed for" : spell.kind === "damage" ? "dealt" : "effect magnitude";
    const msg = `${caster.characterName} cast '${spell.name}' (${spell.school})! ${actionTerm} ${totalRoll}.`;

    return {
      success: true,
      message: msg,
      manaSpent: spell.manaCost,
      remainingMana: caster.currentMana,
      totalRoll,
      appliedEffects,
    };
  }
}
