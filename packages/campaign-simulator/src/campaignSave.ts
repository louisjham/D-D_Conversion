import { z } from "zod";
import { CampaignSessionState } from "./campaignSession";

export const CampaignSaveEnvelopeSchema = z.object({
  schemaVersion: z.literal("0.1"),
  campaignId: z.string(),
  campaignContentHash: z.string(),
  campaignSeed: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sessionState: z.any(),
});

export type CampaignSaveEnvelope = z.infer<typeof CampaignSaveEnvelopeSchema>;

export function createCampaignSaveEnvelope(
  campaignId: string,
  seed: number,
  sessionState: CampaignSessionState
): CampaignSaveEnvelope {
  return {
    schemaVersion: "0.1",
    campaignId,
    campaignContentHash: `hash-${campaignId}-v0.1`,
    campaignSeed: seed,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sessionState,
  };
}

export function validateCampaignSaveCompatibility(
  envelope: unknown,
  expectedCampaignId: string
): { compatible: boolean; action: "load" | "reject"; reason?: string } {
  const parseRes = CampaignSaveEnvelopeSchema.safeParse(envelope);
  if (!parseRes.success) {
    return { compatible: false, action: "reject", reason: "Invalid or corrupted CampaignSaveEnvelope schema." };
  }

  const save = parseRes.data;
  if (save.campaignId !== expectedCampaignId) {
    return { compatible: false, action: "reject", reason: `Save campaignId '${save.campaignId}' mismatch.` };
  }

  return { compatible: true, action: "load" };
}
