import { z } from "zod";

export const SpellSchoolSchema = z.enum([
  "evocation",
  "abjuration",
  "conjuration",
  "divination",
  "necromancy",
  "transmutation",
  "illusion",
  "enchantment",
]);
export type SpellSchool = z.infer<typeof SpellSchoolSchema>;

export const SpellTargetTypeSchema = z.enum([
  "singleTarget",
  "group",
  "allEnemies",
  "self",
  "party",
]);
export type SpellTargetType = z.infer<typeof SpellTargetTypeSchema>;

export const SpellKindSchema = z.enum([
  "damage",
  "healing",
  "buff",
  "debuff",
  "utility",
]);
export type SpellKind = z.infer<typeof SpellKindSchema>;

export const StatusEffectTypeSchema = z.enum([
  "poisoned",
  "stunned",
  "blessed",
  "shielded",
  "hasted",
]);
export type StatusEffectType = z.infer<typeof StatusEffectTypeSchema>;

export const StatusEffectSchema = z.object({
  id: z.string(),
  type: StatusEffectTypeSchema,
  durationRounds: z.number(),
  potency: z.number(),
});
export type StatusEffect = z.infer<typeof StatusEffectSchema>;

export const SpellSchema = z.object({
  id: z.string(),
  name: z.string(),
  school: SpellSchoolSchema,
  level: z.number().min(0).max(9),
  manaCost: z.number().min(0),
  kind: SpellKindSchema,
  targetType: SpellTargetTypeSchema,
  diceFormula: z.string(),
  scaleWithCasterLevel: z.boolean().default(false),
  allowedClasses: z.array(z.string()),
  statusEffects: z.array(StatusEffectSchema).optional(),
  description: z.string(),
});
export type Spell = z.infer<typeof SpellSchema>;

export type CasterState = {
  characterName: string;
  characterClass: string;
  level: number;
  currentMana: number;
  maxMana: number;
  activeStatusEffects: StatusEffect[];
};

export type SpellCastResult = {
  success: boolean;
  message: string;
  manaSpent: number;
  remainingMana: number;
  totalRoll: number;
  appliedEffects: StatusEffect[];
};
