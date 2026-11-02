import { describe, it, expect } from "vitest";
import { AiModuleParser } from "./aiModuleParser";
import { DEFAULT_AI_CONFIGS, generateAiCompletion } from "./aiProvider";
import { VersionedAdventure } from "@grimoire3d/ir";

describe("AI Module Importer Test Suite", () => {
  it("1. Offline heuristic provider produces valid VersionedAdventure IR from raw text", async () => {
    const rawModuleText = `
    1. MAIN GATE: Flanked by two towers. Guards are posted here.
    2. FLANKING TOWERS: Four crossbowmen are stationed at the top of each tower.
    3. ENTRY YARD: Paved yard where entrants dismount.
    `;

    const config = DEFAULT_AI_CONFIGS["offline-heuristic"];
    const result = await AiModuleParser.parseModuleTextToIR(rawModuleText, config);

    if (!result.validation.valid) {
      console.log("Validation issues:", result.validation.issues);
    }
    expect(result.success).toBe(true);
    expect(result.versionedAdventure).toBeDefined();
    expect(result.versionedAdventure?.adventure.locations.length).toBeGreaterThanOrEqual(2);
    expect(result.validation.valid).toBe(true);
  });

  it("2. generateAiCompletion handles offline mode correctly without network calls", async () => {
    const config = DEFAULT_AI_CONFIGS["offline-heuristic"];
    const text = await generateAiCompletion("1. GUARD POST: Small room.", config);
    expect(text).toContain("schemaVersion");
    expect(text).toContain("adventure");
  });
});
