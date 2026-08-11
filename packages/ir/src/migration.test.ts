import { describe, it, expect } from "vitest";
import { migrateAdventureToV01 } from "./migrations";
import { serpentAltarAdventure } from "@grimoire3d/fixtures";

describe("IR Schema Migration Engine", () => {
  it("1. Should pass through valid v0.1 VersionedAdventure unchanged", () => {
    const migrated = migrateAdventureToV01(serpentAltarAdventure);
    expect(migrated.schemaVersion).toBe("0.1");
    expect(migrated.adventure.id).toBe("serpent-altar-crypt");
  });

  it("2. Should migrate legacy unversioned adventure JSON to VersionedAdventure v0.1 envelope", () => {
    const legacyJson = {
      id: "legacy-dungeon",
      title: "The Old Dungeon",
      locations: [
        {
          id: "old-room-1",
          label: "Old Room 1",
          geometry: { x: 0, y: 0, width: 4, height: 4 },
          presentation: { biome: "crypt", lighting: "dark", ambienceTags: [] },
          narrative: { playerFacingDescription: "Old description", gmNotes: [] },
          exits: [],
          interactables: [],
          secrets: [],
        },
      ],
    };

    const migrated = migrateAdventureToV01(legacyJson);
    expect(migrated.schemaVersion).toBe("0.1");
    expect(migrated.metadata.importedBy).toBe("manual");
    expect(migrated.adventure.title).toBe("The Old Dungeon");
    expect(migrated.adventure.start).toBe("old-room-1");
  });
});
