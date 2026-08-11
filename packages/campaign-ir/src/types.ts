import { z } from "zod";

export const LocalSourceProvenanceSchema = z.object({
  sourceId: z.string(),
  documentHash: z.string(),
  page: z.number(),
  quoteHash: z.string(),
  quotePreview: z.string().optional(), // local-only, never committed or serialized publicly
  bounds: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  extractionMethod: z.enum(["manual", "text-parser", "llm"]),
  confidence: z.number().optional(),
  review: z.object({
    status: z.enum(["unreviewed", "accepted", "edited", "rejected"]),
    reviewedAt: z.string().optional(),
  }),
});

export type LocalSourceProvenance = z.infer<typeof LocalSourceProvenanceSchema>;

export const WorldTimeSchema = z.object({
  day: z.number(),
  hour: z.number(), // 0-23
});

export type WorldTime = z.infer<typeof WorldTimeSchema>;

export const TravelNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["hub", "expedition-site", "waypoint"]),
  regionId: z.string(),
});

export type TravelNode = z.infer<typeof TravelNodeSchema>;

export const TravelEdgeSchema = z.object({
  id: z.string(),
  name: z.string(),
  fromNodeId: z.string(),
  toNodeId: z.string(),
  durationHours: z.number(),
  riskProfile: z.enum(["low", "moderate", "high", "extreme"]),
  travelEventTableId: z.string(),
  requirements: z.array(z.string()).default([]),
});

export type TravelEdge = z.infer<typeof TravelEdgeSchema>;

export const HubServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["inn", "provisioner", "tavern", "quest-contact", "travel-board"]),
  description: z.string(),
});

export type HubService = z.infer<typeof HubServiceSchema>;

export const RumorSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  sourceServiceId: z.string(),
  truth: z.enum(["true", "false", "partial", "unknown"]),
  provenance: LocalSourceProvenanceSchema.optional(),
});

export type Rumor = z.infer<typeof RumorSchema>;

export const FactionDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  initialStrength: z.number(),
  initialAlert: z.number(),
  initialDisposition: z.number(),
  territory: z.array(z.string()),
  goals: z.array(z.string()),
  allies: z.array(z.string()),
  enemies: z.array(z.string()),
});

export type FactionDefinition = z.infer<typeof FactionDefinitionSchema>;

export const CampaignQuestSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  targetEntityId: z.string(),
  rewardGold: z.number(),
  factionId: z.string().optional(),
});

export type CampaignQuest = z.infer<typeof CampaignQuestSchema>;

export const CampaignRegionSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.enum(["hub", "dungeon-complex"]),
  adventureId: z.string().optional(),
  controllingFactionId: z.string().optional(),
  nodes: z.array(TravelNodeSchema),
  edges: z.array(TravelEdgeSchema),
  services: z.array(HubServiceSchema).default([]),
  rumors: z.array(RumorSchema).default([]),
  factions: z.array(FactionDefinitionSchema).default([]),
  quests: z.array(CampaignQuestSchema).default([]),
});

export type CampaignRegion = z.infer<typeof CampaignRegionSchema>;

export const VersionedCampaignSchema = z.object({
  schemaVersion: z.literal("0.1"),
  campaign: z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    startingRegionId: z.string(),
    startingNodeId: z.string(),
    regions: z.array(CampaignRegionSchema),
  }),
});

export type VersionedCampaign = z.infer<typeof VersionedCampaignSchema>;
