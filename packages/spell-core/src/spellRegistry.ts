import { Spell, SpellSchool, Spellbook, LearnSpellResult } from "./types";
import rawSpells from "./spells.json" with { type: "json" };

export const SPELL_REGISTRY: Record<string, Spell> = rawSpells as Record<string, Spell>;

export function getSpell(id: string): Spell | undefined {
  if (SPELL_REGISTRY[id]) return SPELL_REGISTRY[id];
  const cleanId = id.toLowerCase().replace(/^spell-/, "").trim();
  if (SPELL_REGISTRY[cleanId]) return SPELL_REGISTRY[cleanId];
  return Object.values(SPELL_REGISTRY).find(
    (s) => s.id === id || s.id === cleanId || s.name.toLowerCase() === id.toLowerCase()
  );
}

export function getSpellsByLevel(level: number): Spell[] {
  return Object.values(SPELL_REGISTRY).filter((s) => s.level === level);
}

export function getSpellsBySchool(school: SpellSchool): Spell[] {
  return Object.values(SPELL_REGISTRY).filter((s) => s.school === school);
}

export function learnSpell(
  spellbook: Spellbook,
  spellId: string,
  casterLevel: number
): LearnSpellResult {
  const spell = getSpell(spellId);
  if (!spell) {
    const reason = `Spell '${spellId}' does not exist in registry.`;
    return { success: false, message: reason, reason };
  }

  if (spellbook.knownSpells.includes(spell.id)) {
    const reason = `Spell '${spell.name}' is already known.`;
    return { success: false, message: reason, reason };
  }

  const maxCastableLevel = spell.level === 0 ? 9 : Math.min(9, Math.max(1, Math.ceil(casterLevel / 2)));
  if (spell.level > maxCastableLevel) {
    const ordinal = spell.level === 1 ? "1st" : spell.level === 2 ? "2nd" : spell.level === 3 ? "3rd" : `${spell.level}th`;
    const reason = `Caster level ${casterLevel} cannot learn ${ordinal}-level spells (max level: ${maxCastableLevel}).`;
    return {
      success: false,
      message: reason,
      reason,
    };
  }

  if (spellbook.knownSpells.length >= spellbook.maxCapacity) {
    const reason = `Spellbook is full (capacity: ${spellbook.maxCapacity}).`;
    return {
      success: false,
      message: reason,
      reason,
    };
  }

  const newSpellbook: Spellbook = {
    ...spellbook,
    knownSpells: [...spellbook.knownSpells, spell.id],
  };

  const message = `Learned '${spell.name}' (Level ${spell.level} ${spell.school}).`;
  return {
    success: true,
    message,
    newSpellbook,
  };
}
