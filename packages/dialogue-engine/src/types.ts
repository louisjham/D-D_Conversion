import { z } from "zod";
import { ConditionSchema, EffectSchema } from "@grimoire3d/ir";

export const DialogueCheckSchema = z.object({
  ability: z.enum(["persuasion", "intimidation", "deception", "history", "insight"]),
  dc: z.number(),
  successNextNodeId: z.string(),
  failureNextNodeId: z.string(),
});
export type DialogueCheck = z.infer<typeof DialogueCheckSchema>;

export const DialogueChoiceSchema = z.object({
  id: z.string(),
  text: z.string(),
  nextNodeId: z.string().nullable(),
  visibleWhen: ConditionSchema.optional(),
  check: DialogueCheckSchema.optional(),
  effects: z.array(EffectSchema).optional(),
});
export type DialogueChoice = z.infer<typeof DialogueChoiceSchema>;

export const DialogueNodeSchema = z.object({
  id: z.string(),
  speakerName: z.string(),
  text: z.string(),
  portrait: z.string().optional(),
  choices: z.array(DialogueChoiceSchema),
  onEnterEffects: z.array(EffectSchema).optional(),
});
export type DialogueNode = z.infer<typeof DialogueNodeSchema>;

export const DialogueTreeSchema = z.object({
  id: z.string(),
  npcId: z.string(),
  startNodeId: z.string(),
  nodes: z.array(DialogueNodeSchema),
});
export type DialogueTree = z.infer<typeof DialogueTreeSchema>;

export type DialogueState = {
  treeId: string;
  npcId: string;
  currentNodeId: string | null;
  dialogueEnded: boolean;
  historyNodeIds: string[];
  lastCheckResult?: {
    ability: string;
    dc: number;
    roll: number;
    success: boolean;
  };
};
