import { z } from "zod";

export const LocalSourceManifestSchema = z.object({
  sourceId: z.string(),
  sourceKind: z.enum(["pdf-text-export", "manual-entry"]),
  localPath: z.string(),
  documentHash: z.string(),
  pageCount: z.number().optional(),
  importedAt: z.string(),
  processingMode: z.literal("local-only"),
  remoteTransmissionAllowed: z.literal(false),
});

export type LocalSourceManifest = z.infer<typeof LocalSourceManifestSchema>;

export function createLocalSourceManifest(
  sourceId: string,
  localPath: string,
  documentHash: string,
  pageCount?: number,
  sourceKind: LocalSourceManifest["sourceKind"] = "pdf-text-export"
): LocalSourceManifest {
  return {
    sourceId,
    sourceKind,
    localPath,
    documentHash,
    pageCount,
    importedAt: new Date().toISOString(),
    processingMode: "local-only",
    remoteTransmissionAllowed: false,
  };
}
