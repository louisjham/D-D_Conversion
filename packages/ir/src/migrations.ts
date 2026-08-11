import { VersionedAdventure, VersionedAdventureSchema } from "./types";

export function migrateAdventureToV01(rawInput: any): VersionedAdventure {
  // If already v0.1
  if (rawInput && rawInput.schemaVersion === "0.1") {
    return VersionedAdventureSchema.parse(rawInput);
  }

  // Handle legacy v0.0 format (unversioned object)
  const adventureData = rawInput.adventure || rawInput;

  const migrated: VersionedAdventure = {
    schemaVersion: "0.1",
    metadata: {
      createdAt: rawInput.metadata?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      importedBy: rawInput.metadata?.importedBy || "manual",
    },
    sourceDocument: rawInput.sourceDocument || {
      id: "migrated-doc",
      title: adventureData.title || "Migrated Adventure",
      pageCount: 1,
      sourceFormat: "text",
    },
    adventure: {
      id: adventureData.id || "migrated-adventure",
      title: adventureData.title || "Migrated Adventure",
      systemProfile: adventureData.systemProfile || "classic-dungeon",
      start: adventureData.start || adventureData.locations?.[0]?.id || "entry",
      locations: adventureData.locations || [],
      npcs: adventureData.npcs || [],
      monsters: adventureData.monsters || [],
      items: adventureData.items || [],
      quests: adventureData.quests || [],
    },
  };

  return VersionedAdventureSchema.parse(migrated);
}
