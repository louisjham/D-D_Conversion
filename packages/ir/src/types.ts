import { z } from "zod";

// --- Provenance Schema ---
export const ProvenanceSchema = z.object({
  sourceId: z.string(),
  page: z.number().optional(),
  quote: z.string().optional(),
  bounds: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  extraction: z.object({
    method: z.enum(["manual", "fixture", "llm"]),
    model: z.string().optional(),
    runId: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
  }),
  review: z.object({
    status: z.enum(["unreviewed", "accepted", "edited", "rejected"]),
    reviewedAt: z.string().optional(),
  }),
});
export type Provenance = z.infer<typeof ProvenanceSchema>;

// --- Conditions (Discriminated Union) ---
export const ConditionAlwaysSchema = z.object({
  kind: z.literal("always"),
});

export const ConditionFlagSchema = z.object({
  kind: z.literal("flag"),
  flag: z.string(),
  equals: z.boolean(),
});

export const ConditionHasItemSchema = z.object({
  kind: z.literal("hasItem"),
  itemId: z.string(),
});

export const ConditionCheckPassedSchema = z.object({
  kind: z.literal("checkPassed"),
  checkId: z.string(),
});

export const ConditionSchema = z.discriminatedUnion("kind", [
  ConditionAlwaysSchema,
  ConditionFlagSchema,
  ConditionHasItemSchema,
  ConditionCheckPassedSchema,
]);
export type Condition = z.infer<typeof ConditionSchema>;

// --- Effects (Discriminated Union) ---
export const EffectSetFlagSchema = z.object({
  kind: z.literal("setFlag"),
  flag: z.string(),
  value: z.boolean(),
});

export const EffectGrantItemSchema = z.object({
  kind: z.literal("grantItem"),
  itemId: z.string(),
});

export const EffectRevealSecretSchema = z.object({
  kind: z.literal("revealSecret"),
  secretId: z.string(),
});

export const EffectOpenExitSchema = z.object({
  kind: z.literal("openExit"),
  exitId: z.string(),
});

export const EffectSchema = z.discriminatedUnion("kind", [
  EffectSetFlagSchema,
  EffectGrantItemSchema,
  EffectRevealSecretSchema,
  EffectOpenExitSchema,
]);
export type Effect = z.infer<typeof EffectSchema>;

// --- Lock Specification ---
export const LockSpecSchema = z.object({
  keyItemId: z.string().optional(),
  pickable: z.boolean().optional(),
  lockpickDC: z.number().optional(),
  requiredFlag: z.string().optional(),
});
export type LockSpec = z.infer<typeof LockSpecSchema>;

// --- Exits ---
export const ExitSchema = z.object({
  id: z.string(),
  direction: z.enum(["north", "south", "east", "west", "up", "down"]),
  target: z.string(),
  locked: LockSpecSchema.optional(),
  visibleWhen: ConditionSchema.optional(),
  provenance: ProvenanceSchema.optional(),
  doorType: z.enum(["open", "wood", "iron", "stone", "portcullis"]).optional(),
  doorState: z.enum(["open", "closed", "stuck", "barred", "locked"]).optional(),
  forceDC: z.number().optional(),
  listenNotice: z.string().optional(),
});
export type Exit = z.infer<typeof ExitSchema>;

// --- Secrets ---
export const SecretSchema = z.object({
  id: z.string(),
  label: z.string(),
  perceptionDC: z.number(),
  discovered: z.boolean().default(false),
  revealsExitId: z.string().optional(),
  grantsItemId: z.string().optional(),
  provenance: ProvenanceSchema.optional(),
});
export type Secret = z.infer<typeof SecretSchema>;

// --- Interactables ---
export const InteractableSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  actionType: z.string().optional(),
  inspectionCheck: z
    .object({
      ability: z.enum(["perception", "investigation", "arcana", "athletics", "sleight-of-hand"]),
      dc: z.number(),
    })
    .optional(),
  onInspectEffects: z.array(EffectSchema).optional(),
  provenance: ProvenanceSchema.optional(),
});
export type Interactable = z.infer<typeof InteractableSchema>;

// --- Encounters & Monsters ---
export const MonsterTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  hp: z.number(),
  ac: z.number(),
  attackBonus: z.number(),
  damageRoll: z.string(),
  provenance: ProvenanceSchema.optional(),
});
export type MonsterTemplate = z.infer<typeof MonsterTemplateSchema>;

export const EncounterSchema = z.object({
  id: z.string(),
  trigger: ConditionSchema,
  enemies: z.array(
    z.object({
      monsterTemplateId: z.string(),
      count: z.number(),
    })
  ),
  tactics: z.string().optional(),
  victoryEffects: z.array(EffectSchema).optional(),
  defeatEffects: z.array(EffectSchema).optional(),
  provenance: ProvenanceSchema.optional(),
});
export type Encounter = z.infer<typeof EncounterSchema>;

// --- NPCs ---
export const NPCSchema = z.object({
  id: z.string(),
  name: z.string(),
  disposition: z.enum(["hostile", "neutral", "friendly"]),
  locationId: z.string(),
  dialogueText: z.string(),
  provenance: ProvenanceSchema.optional(),
  state: z.enum(["free", "imprisoned", "recruited"]).optional(),
  rescueReward: EffectSchema.optional(),
  combatStats: z
    .object({
      hp: z.number(),
      ac: z.number(),
      attackBonus: z.number(),
      damageRoll: z.string(),
    })
    .optional(),
});
export type NPC = z.infer<typeof NPCSchema>;

// --- Items ---
export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["key", "weapon", "armor", "potion", "quest", "treasure"]),
  description: z.string(),
  valueCoins: z.number().optional(),
  provenance: ProvenanceSchema.optional(),
});
export type Item = z.infer<typeof ItemSchema>;

// --- Quests ---
export const QuestSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  completionCondition: ConditionSchema,
  rewards: z.array(EffectSchema),
  provenance: ProvenanceSchema.optional(),
});
export type Quest = z.infer<typeof QuestSchema>;

// --- Locations (Rooms) ---
export const RoomGeometrySchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
export type RoomGeometry = z.infer<typeof RoomGeometrySchema>;

export const EnvironmentalHazardSchema = z.object({
  id: z.string(),
  type: z.enum([
    "pit-trap",
    "steep-slope",
    "noxious-fumes",
    "cave-in",
    "deep-water",
    "petrifying-gaze",
    "spring-blade",
    "alarm-summon",
  ]),
  dc: z.number(),
  damage: z.string().optional(),
  description: z.string(),
});
export type EnvironmentalHazard = z.infer<typeof EnvironmentalHazardSchema>;

export const RoomBoundariesSchema = z.object({
  terrain: z.enum(["paved", "hewn-stone", "rough-cavern", "mud-scree", "steep-chasm"]).optional(),
  hazards: z.array(EnvironmentalHazardSchema).optional(),
  acoustics: z.enum(["echoing", "muffled", "normal"]).optional(),
  sensoryCues: z
    .object({
      smell: z.string().optional(),
      sound: z.string().optional(),
      draft: z.string().optional(),
    })
    .optional(),
});
export type RoomBoundaries = z.infer<typeof RoomBoundariesSchema>;

export const WanderingFrequencySchema = z.object({
  checkOnRest: z.boolean(),
  chanceOnD6: z.number(),
  tableId: z.string().optional(),
  monsterTemplateId: z.string().optional(),
});
export type WanderingFrequency = z.infer<typeof WanderingFrequencySchema>;

export const LocationSchema = z.object({
  id: z.string(),
  label: z.string(),
  mapRegion: z.string().optional(),
  geometry: RoomGeometrySchema,
  presentation: z.object({
    biome: z.enum(["crypt", "cavern", "keep", "forest"]),
    lighting: z.enum(["dark", "torchlit", "day"]),
    ambienceTags: z.array(z.string()),
  }),
  narrative: z.object({
    playerFacingDescription: z.string(),
    gmNotes: z.array(z.string()),
  }),
  exits: z.array(ExitSchema),
  interactables: z.array(InteractableSchema),
  secrets: z.array(SecretSchema),
  encounter: EncounterSchema.optional(),
  provenance: ProvenanceSchema.optional(),
  boundaries: RoomBoundariesSchema.optional(),
  wanderingFrequency: WanderingFrequencySchema.optional(),
  availableActions: z.array(z.string()).optional(),
});
export type Location = z.infer<typeof LocationSchema>;

// --- Random Tables ---
export const RandomTableEntrySchema = z.object({
  range: z.tuple([z.number(), z.number()]),
  result: z.object({
    kind: z.enum(["encounter", "item", "flag", "text"]),
    entityId: z.string().optional(),
    text: z.string().optional(),
    count: z.string().optional(),
  }),
});
export type RandomTableEntry = z.infer<typeof RandomTableEntrySchema>;

export const RandomTableSchema = z.object({
  id: z.string(),
  name: z.string(),
  dice: z.string(),
  checkFrequency: z.string().optional(),
  entries: z.array(RandomTableEntrySchema),
  provenance: ProvenanceSchema.optional(),
});
export type RandomTable = z.infer<typeof RandomTableSchema>;

// --- Adventure ---
export const AdventureSchema = z.object({
  id: z.string(),
  title: z.string(),
  systemProfile: z.enum(["1e", "2e", "original", "classic-dungeon"]),
  start: z.string(),
  locations: z.array(LocationSchema),
  npcs: z.array(NPCSchema),
  monsters: z.array(MonsterTemplateSchema),
  items: z.array(ItemSchema),
  quests: z.array(QuestSchema),
  randomTables: z.array(RandomTableSchema).optional(),
});
export type Adventure = z.infer<typeof AdventureSchema>;

// --- Source Document ---
export const SourceDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  pageCount: z.number(),
  sourceFormat: z.enum(["text", "pdf", "markdown"]),
});
export type SourceDocument = z.infer<typeof SourceDocumentSchema>;

// --- Versioned Adventure (v0.1 Envelope) ---
export const VersionedAdventureSchema = z.object({
  schemaVersion: z.literal("0.1"),
  adventure: AdventureSchema,
  sourceDocument: SourceDocumentSchema.optional(),
  metadata: z.object({
    createdAt: z.string(),
    updatedAt: z.string(),
    importedBy: z.enum(["fixture", "manual", "extractor"]),
  }),
});
export type VersionedAdventure = z.infer<typeof VersionedAdventureSchema>;
