import { z } from "zod";

export const SaveGameEnvelopeSchema = z.object({
  schemaVersion: z.literal("0.1"),
  rulesProfileId: z.string(),
  rulesProfileVersion: z.string(),
  adventureId: z.string(),
  adventureContentHash: z.string(),
  seed: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sessionState: z.object({
    currentLocationId: z.string(),
    playerGridPos: z.object({ x: z.number(), y: z.number() }),
    inventory: z.array(z.string()),
    flags: z.array(z.tuple([z.string(), z.boolean()])),
    playerHp: z.number(),
    playerMaxHp: z.number(),
    playerAc: z.number(),
    discoveredSecrets: z.array(z.string()),
    unlockedExits: z.array(z.string()),
    discoveredRooms: z.array(z.string()),
    actionLogHistory: z.array(z.string()),
    inCombat: z.boolean().default(false),
  }),
});

export type SaveGameEnvelope = z.infer<typeof SaveGameEnvelopeSchema>;

export function createSaveGameEnvelope(
  adventureId: string,
  seed: number,
  sessionState: SaveGameEnvelope["sessionState"],
  rulesProfileId: string = "classic-lite",
  rulesProfileVersion: string = "1.0.0"
): SaveGameEnvelope {
  return {
    schemaVersion: "0.1",
    rulesProfileId,
    rulesProfileVersion,
    adventureId,
    adventureContentHash: `hash-${adventureId}-v0.1`,
    seed,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sessionState,
  };
}

export type SaveValidationResult = {
  compatible: boolean;
  action: "load" | "warn" | "reject";
  reason?: string;
};

export function validateSaveGameCompatibility(
  envelope: unknown,
  expectedAdventureId: string
): SaveValidationResult {
  const parseRes = SaveGameEnvelopeSchema.safeParse(envelope);
  if (!parseRes.success) {
    return {
      compatible: false,
      action: "reject",
      reason: "Corrupted or invalid SaveGameEnvelope schema.",
    };
  }

  const save = parseRes.data;

  if (save.adventureId !== expectedAdventureId) {
    return {
      compatible: false,
      action: "reject",
      reason: `Save belongs to adventure '${save.adventureId}', expected '${expectedAdventureId}'.`,
    };
  }

  if (save.schemaVersion !== "0.1") {
    return {
      compatible: false,
      action: "reject",
      reason: `Incompatible save schema version '${save.schemaVersion}'.`,
    };
  }

  return {
    compatible: true,
    action: "load",
  };
}
