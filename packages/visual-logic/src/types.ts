import { z } from "zod";
import { ConditionSchema, EffectSchema } from "@grimoire3d/ir";

export const VisualNodeTypeSchema = z.enum(["trigger", "condition", "action"]);
export type VisualNodeType = z.infer<typeof VisualNodeTypeSchema>;

export const TriggerKindSchema = z.enum([
  "onRoomEnter",
  "onInteract",
  "onTurnInterval",
  "onCombatVictory",
  "onSecretDiscovered",
]);
export type TriggerKind = z.infer<typeof TriggerKindSchema>;

export const ConditionKindSchema = z.enum([
  "checkFlag",
  "checkItem",
  "checkAbility",
  "checkTurnCount",
]);
export type ConditionKind = z.infer<typeof ConditionKindSchema>;

export const ActionKindSchema = z.enum([
  "setFlag",
  "grantItem",
  "revealSecret",
  "unlockExit",
  "triggerEncounter",
  "rollTable",
  "teleportPlayer",
]);
export type ActionKind = z.infer<typeof ActionKindSchema>;

export const VisualLogicNodeSchema = z.object({
  id: z.string(),
  type: VisualNodeTypeSchema,
  kind: z.string(),
  title: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.any()),
});
export type VisualLogicNode = z.infer<typeof VisualLogicNodeSchema>;

export const VisualLogicEdgeSchema = z.object({
  id: z.string(),
  fromNodeId: z.string(),
  fromPort: z.string(),
  toNodeId: z.string(),
  toPort: z.string(),
});
export type VisualLogicEdge = z.infer<typeof VisualLogicEdgeSchema>;

export const EventGraphSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  nodes: z.array(VisualLogicNodeSchema),
  edges: z.array(VisualLogicEdgeSchema),
});
export type EventGraph = z.infer<typeof EventGraphSchema>;

export type CompiledEventScript = {
  graphId: string;
  triggerNodeId: string;
  conditions: any[];
  effects: any[];
  valid: boolean;
  errors: string[];
};
