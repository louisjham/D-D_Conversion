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

  it("3. extractionLog in AiImportResult contains the full text log", async () => {
    const rawModuleText = `
    1. GUARD ROOM: Heavy oak door. A wooden chest holds an iron key.
    2. CELL BLOCK: Locked iron door leads to dungeons.
    `;

    const progressMessages: string[] = [];
    const config = DEFAULT_AI_CONFIGS["offline-heuristic"];
    const result = await AiModuleParser.parseModuleTextToIR(rawModuleText, config, (msg) => {
      progressMessages.push(msg);
    });

    expect(result.success).toBe(true);
    expect(Array.isArray(result.extractionLog)).toBe(true);
    expect(result.extractionLog.length).toBeGreaterThan(5);

    // fullTextLog convenience property
    expect(result.fullTextLog).toBeDefined();
    expect(result.fullTextLog).toBe(result.extractionLog.join("\n"));

    const combinedLog = result.extractionLog.join("\n");

    // Full text log must contain the raw input module source text
    expect(combinedLog).toContain("=== INPUT MODULE SOURCE TEXT");
    expect(combinedLog).toContain("1. GUARD ROOM: Heavy oak door.");
    expect(combinedLog).toContain("=== END INPUT MODULE SOURCE TEXT ===");

    // Full text log must contain the system prompt and user prompt sent
    expect(combinedLog).toContain("=== DUNGEON MASTER SYSTEM PROMPT ===");
    expect(combinedLog).toContain("=== USER PROMPT SENT TO MODEL ===");

    // Full text log must contain the raw AI completion response
    expect(combinedLog).toContain("=== RAW AI COMPLETION RESPONSE");
    expect(combinedLog).toContain('"schemaVersion"');
    expect(combinedLog).toContain('"adventure"');
    expect(combinedLog).toContain("=== END RAW AI COMPLETION RESPONSE ===");

    // Full text log must contain schema validation and validator diagnostics
    expect(combinedLog).toContain("Zod schema validation passed");
    expect(combinedLog).toContain("Grimoire3D solver validator completed");

    // Full text log must contain the conversion report summary
    expect(combinedLog).toContain("=== CONVERSION REPORT SUMMARY ===");
    expect(combinedLog).toContain("AI Module Extraction Pipeline Complete");

    // onProgress received concise steps
    expect(progressMessages.length).toBeGreaterThan(0);
  });

  it("4. recompileAndFixAdventure captures full text log in extractionLog", async () => {
    const rawModuleText = `
    1. SHRINE: Ancient stone altar.
    `;
    const config = DEFAULT_AI_CONFIGS["offline-heuristic"];
    const initialResult = await AiModuleParser.parseModuleTextToIR(rawModuleText, config);
    expect(initialResult.versionedAdventure).toBeDefined();

    const recompileResult = await AiModuleParser.recompileAndFixAdventure(
      initialResult.versionedAdventure!,
      config,
      "Enhance narrative descriptions"
    );

    expect(recompileResult.extractionLog.length).toBeGreaterThan(3);
    const combinedLog = recompileResult.extractionLog.join("\n");

    expect(combinedLog).toContain("=== USER RECOMPILE PROMPT SENT TO MODEL ===");
    expect(combinedLog).toContain("Enhance narrative descriptions");
    expect(combinedLog).toContain("=== RAW AI RECOMPILE RESPONSE");
    expect(recompileResult.fullTextLog).toBe(recompileResult.extractionLog.join("\n"));
  });
});
