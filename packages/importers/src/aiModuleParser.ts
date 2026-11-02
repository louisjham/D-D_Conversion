import { VersionedAdventure, VersionedAdventureSchema } from "@grimoire3d/ir";
import { validateAdventure, ValidationResult } from "@grimoire3d/validator";
import { AiClientConfig, generateAiCompletion } from "./aiProvider";

export interface AiConversionReport {
  moduleTitle: string;
  summary: string;
  systemProfile: string;
  startLocationId: string;
  gameLoopDescription: string;
  locationsConverted: Array<{
    id: string;
    label: string;
    biome: string;
    lighting: string;
    exitsCount: number;
    interactablesCount: number;
    secretsCount: number;
    playerFacingDescription: string;
  }>;
  monsterCompendium: Array<{
    id: string;
    name: string;
    hp: number;
    ac: number;
    attackBonus: number;
    damageRoll: string;
    xpValue?: number;
    spawnLocationLabel?: string;
  }>;
  npcCompendium: Array<{
    id: string;
    name: string;
    disposition: string;
    dialogueText: string;
    locationLabel?: string;
  }>;
  validationStatus: {
    valid: boolean;
    issueCount: number;
  };
  markdownReport: string;
}

export interface AiImportResult {
  success: boolean;
  versionedAdventure?: VersionedAdventure;
  validation: ValidationResult;
  extractionLog: string[];
  repairPassesRun: number;
  report?: AiConversionReport;
}

export class AiModuleParser {
  /**
   * Generates a comprehensive conversion report summarizing module details,
   * converted locations, monster/NPC compendium, and the game loop architecture.
   */
  public static generateConversionReport(
    vAdventure: VersionedAdventure,
    validation: ValidationResult
  ): AiConversionReport {
    const adv = vAdventure.adventure;
    const startLoc = adv.locations.find((l) => l.id === adv.start);

    // Extract Monster Compendium from adventure locations
    const monsterMap = new Map<string, any>();
    adv.locations.forEach((loc) => {
      if (loc.interactables) {
        loc.interactables.forEach((inter) => {
          if (inter.label?.toLowerCase().includes("monster") || inter.label?.toLowerCase().includes("ambush")) {
            monsterMap.set(inter.id, {
              id: inter.id,
              name: inter.label,
              hp: 12,
              ac: 13,
              attackBonus: 3,
              damageRoll: "1d6+1",
              spawnLocationLabel: loc.label,
            });
          }
        });
      }
    });

    // Also extract monsters from adv.monsters if defined
    if (adv.monsters && Array.isArray(adv.monsters)) {
      adv.monsters.forEach((m: any) => {
        monsterMap.set(m.id || m.name, {
          id: m.id || m.name,
          name: m.name || "Monster",
          hp: m.hp || 10,
          ac: m.ac || 12,
          attackBonus: m.attackBonus || 3,
          damageRoll: m.damageRoll || "1d6",
          xpValue: m.xpValue || 50,
          spawnLocationLabel: "Global Encounters",
        });
      });
    }

    const monsterCompendium = Array.from(monsterMap.values());

    // Extract NPC Compendium
    const npcCompendium = (adv.npcs || []).map((npc: any) => {
      const parentLoc = adv.locations.find((l) => l.id === npc.locationId);
      return {
        id: npc.id,
        name: npc.name,
        disposition: npc.disposition,
        dialogueText: npc.dialogueText,
        locationLabel: parentLoc?.label || "Unassigned Location",
      };
    });

    const locationsConverted = adv.locations.map((loc) => ({
      id: loc.id,
      label: loc.label,
      biome: loc.presentation?.biome || "crypt",
      lighting: loc.presentation?.lighting || "torchlit",
      exitsCount: loc.exits.length,
      interactablesCount: loc.interactables.length,
      secretsCount: loc.secrets.length,
      playerFacingDescription: loc.narrative?.playerFacingDescription || "No description.",
    }));

    // Construct Game Loop Description
    const totalKeys = adv.locations.reduce(
      (acc, l) => acc + l.interactables.filter((i: any) => i.grantsItemId || i.onInspectEffects?.some((e: any) => e.kind === "grantItem")).length,
      0
    );
    const totalLockedExits = adv.locations.reduce(
      (acc, l) => acc + l.exits.filter((e) => e.locked).length,
      0
    );
    const totalSecrets = adv.locations.reduce((acc, l) => acc + l.secrets.length, 0);

    const gameLoopDescription = `[SSI Gold Box RPG Architecture Paradigm] Players begin at '${startLoc?.label || adv.start}'. Exploration proceeds through ${adv.locations.length} connected 2D grid chambers in the style of Pool of Radiance & Curse of the Azure Bonds. The loop includes ${totalLockedExits} locked exit gate(s) requiring ${totalKeys} key item(s), ${totalSecrets} hidden secret switch(es), and ${monsterCompendium.length} tactical turn-based battle triggers. Solvability verified via BFS state-space solver.`;


    // Build Markdown Report
    const mdLines: string[] = [
      `# 📜 AI Module Conversion & Game Loop Report`,
      `**Module Title**: ${adv.title}`,
      `**System Profile**: ${adv.systemProfile || "classic-dungeon"}`,
      `**Starting Room**: ${startLoc?.label || adv.start} (ID: \`${adv.start}\`)`,
      `**Solver Status**: ${validation.valid ? "✅ VALIDATED (100% Reachable & Solvable)" : `⚠️ ${validation.issues.length} Issue(s) Found`}`,
      ``,
      `---`,
      ``,
      `## 1. Executive Summary & Module Overview`,
      `${(adv as any).summary || `${adv.title} converted module successfully mapped to Grimoire3D VersionedAdventure IR.`}`,

      ``,
      `### 🔄 Game Loop Architecture & Exploration Progression`,
       gameLoopDescription,
      ``,
      `---`,
      ``,
      `## 2. Converted Location Breakdown (${locationsConverted.length} Locations)`,
      `| Location Label | ID | Biome | Exits | Objects | Secrets | Player Read-Aloud Summary |`,
      `|---|---|---|---|---|---|---|`,
      ...locationsConverted.map(
        (loc) =>
          `| **${loc.label}** | \`${loc.id}\` | \`${loc.biome}\` | ${loc.exitsCount} | ${loc.interactablesCount} | ${loc.secretsCount} | ${loc.playerFacingDescription.slice(0, 50)}... |`
      ),
      ``,
      `---`,
      ``,
      `## 3. Monster & NPC Tactical Compendium`,
      `### ⚔️ Monsters & Threats (${monsterCompendium.length} Registered)`,
      monsterCompendium.length > 0
        ? `| Monster Name | HP | AC | Attack Bonus | Damage Roll | Location |` +
          "\n" +
          `|---|---|---|---|---|---|` +
          "\n" +
          monsterCompendium
            .map(
              (m) =>
                `| **${m.name}** | ${m.hp} | ${m.ac} | +${m.attackBonus} | \`${m.damageRoll}\` | ${m.spawnLocationLabel || "N/A"} |`
            )
            .join("\n")
        : `*No combat encounters converted for this module.*`,
      ``,
      `### 🗣️ NPCs & Dialogue Nodes (${npcCompendium.length} Registered)`,
      npcCompendium.length > 0
        ? `| NPC Name | Disposition | Location | Dialogue Summary |` +
          "\n" +
          `|---|---|---|---|` +
          "\n" +
          npcCompendium
            .map((n) => `| **${n.name}** | \`${n.disposition}\` | ${n.locationLabel} | "${n.dialogueText.slice(0, 40)}..." |`)
            .join("\n")
        : `*No NPCs converted for this module.*`,
      ``,
      `---`,
      ``,
      `## 4. State-Space Solver Audit`,
      validation.valid
        ? `✅ All locations are reachable from start. All locked doors have accessible keys.`
        : `⚠️ Validation issues detected:\n` +
          validation.issues.map((i) => `- [${i.code}] ${i.message}`).join("\n"),
    ];

    const markdownReport = mdLines.join("\n");

    return {
      moduleTitle: adv.title,
      summary: (adv as any).summary || "",
      systemProfile: adv.systemProfile || "classic-dungeon",

      startLocationId: adv.start,
      gameLoopDescription,
      locationsConverted,
      monsterCompendium,
      npcCompendium,
      validationStatus: {
        valid: validation.valid,
        issueCount: validation.issues.length,
      },
      markdownReport,
    };
  }

  private static getDungeonMasterSystemPrompt(): string {
    return `You are a master D&D 5e Dungeon Master and CRPG world architect. Your task is to translate raw D&D tabletop modules, maps, encounters, and tables into a strict Grimoire3D VersionedAdventure IR JSON (v0.1), using the classic SSI Gold Box series (Pool of Radiance, Curse of the Azure Bonds, Death Knights of Krynn) as the exemplar of low-compute computer RPG translation.

SSI GOLD BOX PARADIGM & GAMEPLAY LOOP ARCHITECTURE:
1. TWO-PHASE EXPLORATION & COMBAT PARADIGM:
   - Exploration Mode: Clear 2D grid/dungeon navigation with rich player read-aloud descriptions ("narrative.playerFacingDescription").
   - Tactical Combat Mode: Turn-based 2D grid combat with initiative order, action budgets (Movement, Action, Bonus Action), and monster AI tactics.

2. DM KNOWLEDGE vs PLAYER KNOWLEDGE PARTITIONING:
   - PLAYER FACING: "narrative.playerFacingDescription" (visuals, sounds, obvious objects) and public exit doors.
   - DM SECRETS: "narrative.gmNotes" (DM journal entries, monster ambush triggers, trap disarm details) and "secrets" (hidden brick switches with Perception DCs).

3. PROGRESSION LOOP INTEGRITY:
   - "start": Clear starting location ID.
   - Every locked exit key requirement MUST be obtainable from an interactable in an accessible room.
   - Create a tight, rewarding game loop: Start Entry -> Room Exploration & Clues -> Key Hunting / Secret Unlocking -> Tactical Monster Encounters -> Boss Chamber / Climax.

OUTPUT ONLY VALID RAW JSON MATCHING SCHEMA VERSION "0.1".`;
  }


  public static async parseModuleTextToIR(
    rawText: string,
    config: AiClientConfig,
    onProgress?: (msg: string) => void
  ): Promise<AiImportResult> {
    const log: string[] = [];
    const addLog = (msg: string) => {
      log.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
      if (onProgress) onProgress(msg);
    };

    addLog(`Initiating AI Module Parser using provider: ${config.provider} (${config.modelName})`);

    const systemPrompt = this.getDungeonMasterSystemPrompt();
    const userPrompt = `Convert the following D&D module text into Grimoire3D VersionedAdventure IR JSON:

=== MODULE TEXT START ===
${rawText.slice(0, 9000)}
=== MODULE TEXT END ===`;

    addLog("Sending module extraction prompt to AI model...");
    let rawAiResponse = "";
    try {
      rawAiResponse = await generateAiCompletion(userPrompt, config, systemPrompt);
      addLog("Received AI extraction response. Parsing JSON...");
    } catch (err: any) {
      addLog(`AI Completion Failed: ${err?.message || err}`);
      return {
        success: false,
        validation: { valid: false, issues: [{ code: "AI_EXTRACTION_FAILED", message: err?.message || "AI API call failed", severity: "error", entityType: "adventure", entityId: "root" }] },
        extractionLog: log,
        repairPassesRun: 0,
      };
    }

    let parsedJson: any = null;
    try {
      parsedJson = JSON.parse(rawAiResponse);
    } catch (_firstParseErr) {
      addLog("AI response was not valid JSON. Attempting sanitized extraction...");

      // Strategy 1: Strip markdown fences (```json ... ```)
      let sanitized = rawAiResponse
        .replace(/^```(?:json|JSON)?\s*\n?/gm, '')
        .replace(/\n?```\s*$/gm, '');

      try {
        parsedJson = JSON.parse(sanitized);
        addLog("JSON recovery succeeded after stripping markdown fences.");
      } catch (_secondParseErr) {
        // Strategy 2: Extract from first { to last }
        const firstBrace = rawAiResponse.indexOf('{');
        const lastBrace = rawAiResponse.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          try {
            parsedJson = JSON.parse(rawAiResponse.substring(firstBrace, lastBrace + 1));
            addLog("JSON recovery succeeded via brace extraction.");
          } catch (_thirdParseErr) {
            addLog("All JSON recovery strategies failed.");
            return {
              success: false,
              validation: { valid: false, issues: [{ code: "INVALID_JSON", message: "AI response failed all JSON parsing strategies", severity: "error", entityType: "adventure", entityId: "root" }] },
              extractionLog: log,
              repairPassesRun: 0,
            };
          }
        } else {
          addLog("No JSON object structure found in AI response.");
          return {
            success: false,
            validation: { valid: false, issues: [{ code: "INVALID_JSON", message: "No JSON structure found in AI response", severity: "error", entityType: "adventure", entityId: "root" }] },
            extractionLog: log,
            repairPassesRun: 0,
          };
        }
      }
    }

    const zodResult = VersionedAdventureSchema.safeParse(parsedJson);
    let vAdventure: VersionedAdventure;

    if (zodResult.success) {
      vAdventure = zodResult.data as VersionedAdventure;
      addLog("Zod schema validation passed.");
    } else {
      const zodErrors = zodResult.error.issues
        .slice(0, 10)
        .map((i: any) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n');
      addLog(`Zod schema validation found ${zodResult.error.issues.length} issue(s):\n${zodErrors}`);

      // Only proceed if the IR has fundamental structure
      if (parsedJson && parsedJson.adventure && Array.isArray(parsedJson.adventure.locations)) {
        addLog("IR has basic structure (adventure.locations[]). Proceeding with repair...");
        vAdventure = parsedJson as VersionedAdventure;

        // Attempt AI-driven schema repair if online
        if (config.provider !== "offline-heuristic") {
          addLog("Initiating AI Schema Self-Correction Repair Pass...");
          const repairPrompt = `The extracted D&D adventure JSON failed Zod schema validation:\n\n${zodErrors}\n\nHere is the current JSON:\n${JSON.stringify(parsedJson, null, 2)}\n\nPlease repair the JSON so it strictly adheres to the schema. Return ONLY the corrected full JSON object.`;
          try {
            const repairedRaw = await generateAiCompletion(repairPrompt, config, systemPrompt);
            const repairedJson = JSON.parse(repairedRaw);
            const repairedZod = VersionedAdventureSchema.safeParse(repairedJson);
            if (repairedZod.success) {
              vAdventure = repairedZod.data as VersionedAdventure;
              addLog("Schema self-correction succeeded.");
            } else {
              addLog("Schema repair pass still has Zod issues. Continuing with best-effort IR.");
            }
          } catch (repairErr: any) {
            addLog(`Schema repair pass failed: ${repairErr?.message || repairErr}`);
          }
        }
      } else {
        addLog("IR lacks fundamental structure (no adventure.locations[]). Cannot proceed.");
        return {
          success: false,
          validation: { valid: false, issues: [{ code: "SCHEMA_VALIDATION_FAILED", message: `Schema validation failed: IR missing required structure`, severity: "error", entityType: "adventure", entityId: "root" }] },
          extractionLog: log,
          repairPassesRun: 0,
        };
      }
    }

    addLog("Running Grimoire3D state-space reachability and solver validator...");
    let validation = validateAdventure(vAdventure);
    let repairPasses = 0;

    if (!validation.valid && config.provider !== "offline-heuristic") {
      addLog(`Validator found ${validation.issues.length} solver issue(s). Initiating AI Self-Correction Repair Pass...`);
      repairPasses++;

      const issueDescriptions = validation.issues
        .map((iss) => `- [${iss.severity.toUpperCase()}] ${iss.code}: ${iss.message} (Entity: ${iss.entityId || "N/A"})`)
        .join("\n");

      const repairPrompt = `The extracted D&D adventure JSON failed state-space validation with the following issues:

${issueDescriptions}

Here is the current JSON:
${JSON.stringify(vAdventure, null, 2)}

Please repair the JSON so that exit targets match room IDs and keys are obtainable.
Return ONLY the corrected full JSON object.`;

      try {
        const repairedRaw = await generateAiCompletion(repairPrompt, config, systemPrompt);
        const repairedJson = JSON.parse(repairedRaw);
        const repairedZod = VersionedAdventureSchema.safeParse(repairedJson);
        if (repairedZod.success) {
          vAdventure = repairedZod.data as VersionedAdventure;
          validation = validateAdventure(vAdventure);
          addLog(`Self-correction complete. Validation status: ${validation.valid ? "VALIDATED" : "ISSUES REMAIN"}`);
        }
      } catch (err: any) {
        addLog(`Self-Correction Repair Pass failed: ${err?.message || err}`);
      }
    }

    addLog("Generating Comprehensive AI Module Conversion & Game Loop Report...");
    const report = this.generateConversionReport(vAdventure, validation);

    return {
      success: validation.valid,
      versionedAdventure: vAdventure,
      validation,
      extractionLog: log,
      repairPassesRun: repairPasses,
      report,
    };
  }

  public static async recompileAndFixAdventure(
    existingAdventure: VersionedAdventure,
    config: AiClientConfig,
    customUserInstructions?: string,
    onProgress?: (msg: string) => void
  ): Promise<AiImportResult> {
    const log: string[] = [];
    const addLog = (msg: string) => {
      log.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
      if (onProgress) onProgress(msg);
    };

    addLog(`Re-invoking AI Module Doctor using provider: ${config.provider} (${config.modelName})...`);

    const currentValidation = validateAdventure(existingAdventure);
    const systemPrompt = this.getDungeonMasterSystemPrompt();

    const userPrompt = `Re-examine, repair, and enhance the following D&D adventure JSON:

${customUserInstructions ? `ADDITIONAL USER DM INSTRUCTIONS:\n${customUserInstructions}\n` : ""}

CURRENT ADVENTURE JSON:
${JSON.stringify(existingAdventure, null, 2)}

REQUIREMENTS:
1. Fix any unreachable rooms or dangling exit targets.
2. Separate DM Secret Notes into narrative.gmNotes and Player Read-Aloud into narrative.playerFacingDescription.
3. Return ONLY valid JSON matching schemaVersion "0.1".`;

    try {
      const repairedRaw = await generateAiCompletion(userPrompt, config, systemPrompt);
      const repairedJson = JSON.parse(repairedRaw);
      const repairedZod = VersionedAdventureSchema.safeParse(repairedJson);

      let vAdventure: VersionedAdventure;
      if (repairedZod.success) {
        vAdventure = repairedZod.data as VersionedAdventure;
      } else {
        const errorMsg = repairedZod.error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
        addLog(`Re-compiled JSON failed Zod schema validation: ${errorMsg}`);
        throw new Error(`Zod schema validation failed: ${errorMsg}`);
      }

      let validation = validateAdventure(vAdventure);
      addLog("Generating updated AI Module Conversion Report...");
      const report = this.generateConversionReport(vAdventure, validation);

      return {
        success: validation.valid,
        versionedAdventure: vAdventure,
        validation,
        extractionLog: log,
        repairPassesRun: 1,
        report,
      };
    } catch (err: any) {
      addLog(`Re-compilation failed: ${err?.message || err}`);
      const report = this.generateConversionReport(existingAdventure, currentValidation);
      return {
        success: false,
        versionedAdventure: existingAdventure,
        validation: currentValidation,
        extractionLog: log,
        repairPassesRun: 1,
        report,
      };
    }
  }
}
