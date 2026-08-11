import { VersionedAdventure, VersionedAdventureSchema } from "@grimoire3d/ir";
import { validateAdventure, ValidationResult } from "@grimoire3d/validator";

export type ImportResult = {
  success: boolean;
  versionedAdventure?: VersionedAdventure;
  validation: ValidationResult;
};

export class FixtureImporter {
  public static importFromJSON(jsonInput: unknown): ImportResult {
    const parseResult = VersionedAdventureSchema.safeParse(jsonInput);
    if (!parseResult.success) {
      const validation = validateAdventure(jsonInput);
      return {
        success: false,
        validation,
      };
    }

    const versionedAdventure = parseResult.data as VersionedAdventure;
    const validation = validateAdventure(versionedAdventure);

    return {
      success: validation.valid,
      versionedAdventure,
      validation,
    };
  }
}
