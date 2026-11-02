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
  "environment",
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

export const SpellRangeUnitSchema = z.enum(["feet", "touch", "self", "sight"]);
export type SpellRangeUnit = z.infer<typeof SpellRangeUnitSchema>;

export const SpellRangeSchema = z.object({
  value: z.number(),
  unit: SpellRangeUnitSchema,
});
export type SpellRange = z.infer<typeof SpellRangeSchema>;

export const AreaOfEffectShapeSchema = z.enum(["sphere", "cone", "line", "cube"]);
export type AreaOfEffectShape = z.infer<typeof AreaOfEffectShapeSchema>;

export const AreaOfEffectSchema = z.object({
  shape: AreaOfEffectShapeSchema,
  sizeFeet: z.number(),
});
export type AreaOfEffect = z.infer<typeof AreaOfEffectSchema>;

export const SpellDurationUnitSchema = z.enum([
  "rounds",
  "minutes",
  "hours",
  "instantaneous",
  "concentration",
]);
export type SpellDurationUnit = z.infer<typeof SpellDurationUnitSchema>;

export const SpellDurationSchema = z.object({
  value: z.number(),
  unit: SpellDurationUnitSchema,
});
export type SpellDuration = z.infer<typeof SpellDurationSchema>;

export const CastingTimeUnitSchema = z.enum([
  "action",
  "bonusAction",
  "reaction",
  "minutes",
]);
export type CastingTimeUnit = z.infer<typeof CastingTimeUnitSchema>;

export const CastingTimeSchema = z.object({
  value: z.number(),
  unit: CastingTimeUnitSchema,
});
export type CastingTime = z.infer<typeof CastingTimeSchema>;

export const SpellComponentsSchema = z.object({
  verbal: z.boolean(),
  somatic: z.boolean(),
  material: z.string().optional(),
});
export type SpellComponents = z.infer<typeof SpellComponentsSchema>;

export const EnvironmentEffectKindSchema = z.enum(["createZone", "alterTerrain", "teleport"]);
export type EnvironmentEffectKind = z.infer<typeof EnvironmentEffectKindSchema>;

export const EnvironmentEffectSchema = z.object({
  kind: EnvironmentEffectKindSchema,
  zoneId: z.string().optional(),
  description: z.string(),
});
export type EnvironmentEffect = z.infer<typeof EnvironmentEffectSchema>;

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
  environmentEffects: z.array(EnvironmentEffectSchema).optional(),
  range: SpellRangeSchema,
  areaOfEffect: AreaOfEffectSchema.optional(),
  duration: SpellDurationSchema,
  castingTime: CastingTimeSchema,
  components: SpellComponentsSchema,
  description: z.string(),
  provenance: z.any().optional(),
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
  newCasterState: CasterState;
};

// --- Learning Model ---
export const SpellbookSchema = z.object({
  knownSpells: z.array(z.string()).default([]),
  maxCapacity: z.number().default(20),
});
export type Spellbook = z.infer<typeof SpellbookSchema>;

export type LearnSpellResult = {
  success: boolean;
  message: string;
  reason?: string;
  newSpellbook?: Spellbook;
};

export { learnSpell } from "./spellRegistry";
