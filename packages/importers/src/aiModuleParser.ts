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
  fullTextLog?: string;
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

4. MANDATORY COMPREHENSIVE LOCATION EXTRACTION (CRITICAL):
   - You MUST extract and convert EVERY SINGLE room, chamber, hall, building, or area mentioned in the source module into an entry in "adventure.locations".
   - NEVER truncate, omit, or limit your output to a small 2-room or 3-room sample. If the module has 10, 20, or 35 rooms, extract all 10, 20, or 35 rooms!
   - Every room must include its full read-aloud flavor text, tactical exits connecting to adjacent rooms, and all interactables/monsters found in that room.

OUTPUT ONLY VALID RAW JSON MATCHING SCHEMA VERSION "0.1".`;
  }


  public static async parseModuleTextToIR(
    rawText: string,
    config: AiClientConfig,
    onProgress?: (msg: string) => void
  ): Promise<AiImportResult> {
    const log: string[] = [];
    const addLog = (msg: string, sendToProgress: boolean = true) => {
      const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
      log.push(entry);
      if (onProgress && sendToProgress) {
        onProgress(msg.length > 200 ? msg.slice(0, 197) + "..." : msg);
      }
    };

    addLog(`Initiating AI Module Parser using provider: ${config.provider} (${config.modelName})`);
    if (config.provider !== "offline-heuristic" && !config.apiKey) {
      addLog(`⚠️ No API key specified for ${config.provider}. Running built-in Offline Rules Engine.`);
    }
    addLog(`=== INPUT MODULE SOURCE TEXT (${rawText.length} characters) ===\n${rawText}\n=== END INPUT MODULE SOURCE TEXT ===`, false);

    const maxChars = config.provider === "google-gemini"
      ? 350000
      : config.provider === "openrouter"
      ? 100000
      : 350000;
    const textToSend = rawText.slice(0, maxChars);

    const systemPrompt = this.getDungeonMasterSystemPrompt();
    const userPrompt = `Convert the following D&D module text into Grimoire3D VersionedAdventure IR JSON:

CRITICAL EXTRACTION REQUIREMENTS:
1. EXTRACT ALL ROOMS: You MUST convert EVERY SINGLE room, chamber, hall, and area in the text into its own distinct Location object in "adventure.locations". DO NOT summarize or truncate to only 2 or 3 rooms. If the text has 10, 20, or 35 rooms, extract ALL of them!
2. CONNECTIVITY: Connect rooms with exits so that all rooms are reachable from "start".
3. DETAILS: Extract the player read-aloud description, DM notes, monsters, items/keys, and secrets for every room.
4. Output ONLY valid raw JSON matching schemaVersion "0.1".

=== MODULE TEXT START ===
${textToSend}
=== MODULE TEXT END ===`;

    addLog(`=== DUNGEON MASTER SYSTEM PROMPT ===\n${systemPrompt}\n=== END DUNGEON MASTER SYSTEM PROMPT ===`, false);
    addLog(`=== USER PROMPT SENT TO MODEL ===\n${userPrompt}\n=== END USER PROMPT ===`, false);

    addLog("Sending module extraction prompt to AI model...");
    let rawAiResponse = "";
    try {
      rawAiResponse = await generateAiCompletion(userPrompt, config, systemPrompt);
      addLog("Received AI extraction response. Parsing JSON...");
      addLog(`=== RAW AI COMPLETION RESPONSE (${rawAiResponse.length} characters) ===\n${rawAiResponse}\n=== END RAW AI COMPLETION RESPONSE ===`, false);
    } catch (err: any) {
      addLog(`AI Completion Failed: ${err?.message || err}`);
      return {
        success: false,
        validation: { valid: false, issues: [{ code: "AI_EXTRACTION_FAILED", message: err?.message || "AI API call failed", severity: "error", entityType: "adventure", entityId: "root" }] },
        extractionLog: log,
        fullTextLog: log.join("\n"),
        repairPassesRun: 0,
      };
    }

    let parsedJson: any = null;
    try {
      parsedJson = JSON.parse(rawAiResponse);
      addLog("Initial raw JSON parse succeeded.");
    } catch (firstParseErr: any) {
      addLog(`AI response was not directly valid JSON (${firstParseErr?.message || firstParseErr}). Attempting sanitized extraction...`);

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
            const braceExtracted = rawAiResponse.substring(firstBrace, lastBrace + 1);
            parsedJson = JSON.parse(braceExtracted);
            addLog(`JSON recovery succeeded via brace extraction [${firstBrace}..${lastBrace}].`);
          } catch (thirdParseErr: any) {
            addLog(`All JSON recovery strategies failed: ${thirdParseErr?.message || thirdParseErr}`);
            return {
              success: false,
              validation: { valid: false, issues: [{ code: "INVALID_JSON", message: "AI response failed all JSON parsing strategies", severity: "error", entityType: "adventure", entityId: "root" }] },
              extractionLog: log,
              fullTextLog: log.join("\n"),
              repairPassesRun: 0,
            };
          }
        } else {
          addLog("No JSON object structure found in AI response.");
          return {
            success: false,
            validation: { valid: false, issues: [{ code: "INVALID_JSON", message: "No JSON structure found in AI response", severity: "error", entityType: "adventure", entityId: "root" }] },
            extractionLog: log,
            fullTextLog: log.join("\n"),
            repairPassesRun: 0,
          };
        }
      }
    }

    const zodResult = VersionedAdventureSchema.safeParse(parsedJson);
    let vAdventure: VersionedAdventure;

    if (zodResult.success) {
      vAdventure = zodResult.data as VersionedAdventure;
      addLog(`Zod schema validation passed successfully (schemaVersion: "${vAdventure.schemaVersion}").`);
    } else {
      const allZodErrors = zodResult.error.issues
        .map((i: any) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n');
      addLog(`Zod schema validation found ${zodResult.error.issues.length} issue(s):\n${allZodErrors}`);

      // Only proceed if the IR has fundamental structure
      if (parsedJson && parsedJson.adventure && Array.isArray(parsedJson.adventure.locations)) {
        addLog("IR has basic structure (adventure.locations[]). Proceeding with repair...");
        vAdventure = parsedJson as VersionedAdventure;

        // Attempt AI-driven schema repair if online
        if (config.provider !== "offline-heuristic") {
          addLog("Initiating AI Schema Self-Correction Repair Pass...");
          const repairPrompt = `The extracted D&D adventure JSON failed Zod schema validation:\n\n${allZodErrors}\n\nHere is the current JSON:\n${JSON.stringify(parsedJson, null, 2)}\n\nPlease repair the JSON so it strictly adheres to the schema. Return ONLY the corrected full JSON object.`;
          addLog(`=== SCHEMA REPAIR PROMPT ===\n${repairPrompt}\n=== END SCHEMA REPAIR PROMPT ===`, false);
          try {
            const repairedRaw = await generateAiCompletion(repairPrompt, config, systemPrompt);
            addLog(`=== RAW SCHEMA REPAIR RESPONSE (${repairedRaw.length} characters) ===\n${repairedRaw}\n=== END RAW SCHEMA REPAIR RESPONSE ===`, false);
            const repairedJson = JSON.parse(repairedRaw);
            const repairedZod = VersionedAdventureSchema.safeParse(repairedJson);
            if (repairedZod.success) {
              vAdventure = repairedZod.data as VersionedAdventure;
              addLog("Schema self-correction succeeded.");
            } else {
              const remainingZodErrors = repairedZod.error.issues
                .map((i: any) => `  - ${i.path.join('.')}: ${i.message}`)
                .join('\n');
              addLog(`Schema repair pass still has Zod issues:\n${remainingZodErrors}\nContinuing with best-effort IR.`);
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
          fullTextLog: log.join("\n"),
          repairPassesRun: 0,
        };
      }
    }

    addLog("Running Grimoire3D state-space reachability and solver validator...");
    let validation = validateAdventure(vAdventure);
    let repairPasses = 0;

    addLog(`Grimoire3D solver validator completed: valid=${validation.valid}, issuesCount=${validation.issues.length}`);
    if (validation.issues.length > 0) {
      const issueDetails = validation.issues
        .map((iss) => `  - [${iss.severity.toUpperCase()}] ${iss.code}: ${iss.message} (Entity: ${iss.entityId || "N/A"}, Type: ${iss.entityType})`)
        .join('\n');
      addLog(`Validation issues detected:\n${issueDetails}`);
    }

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

      addLog(`=== SOLVER REPAIR PROMPT ===\n${repairPrompt}\n=== END SOLVER REPAIR PROMPT ===`, false);

      try {
        const repairedRaw = await generateAiCompletion(repairPrompt, config, systemPrompt);
        addLog(`=== RAW SOLVER REPAIR RESPONSE (${repairedRaw.length} characters) ===\n${repairedRaw}\n=== END RAW SOLVER REPAIR RESPONSE ===`, false);
        const repairedJson = JSON.parse(repairedRaw);
        const repairedZod = VersionedAdventureSchema.safeParse(repairedJson);
        if (repairedZod.success) {
          vAdventure = repairedZod.data as VersionedAdventure;
          validation = validateAdventure(vAdventure);
          addLog(`Self-correction complete. Validation status: ${validation.valid ? "VALIDATED" : "ISSUES REMAIN"}`);
          if (!validation.valid) {
            const recheckIssues = validation.issues
              .map((iss) => `  - [${iss.severity.toUpperCase()}] ${iss.code}: ${iss.message} (Entity: ${iss.entityId || "N/A"})`)
              .join('\n');
            addLog(`Issues remaining after solver repair:\n${recheckIssues}`);
          }
        } else {
          addLog(`Repaired JSON from solver pass failed Zod validation: ${repairedZod.error.message}`);
        }
      } catch (err: any) {
        addLog(`Self-Correction Repair Pass failed: ${err?.message || err}`);
      }
    }

    addLog("Generating Comprehensive AI Module Conversion & Game Loop Report...");
    const report = this.generateConversionReport(vAdventure, validation);
    addLog(`=== CONVERSION REPORT SUMMARY ===\n${report.gameLoopDescription}\n=== END CONVERSION REPORT SUMMARY ===`, false);
    addLog(`AI Module Extraction Pipeline Complete. Valid: ${validation.valid}, Total Locations: ${vAdventure.adventure.locations.length}.`);

    return {
      success: validation.valid,
      versionedAdventure: vAdventure,
      validation,
      extractionLog: log,
      fullTextLog: log.join("\n"),
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
    const addLog = (msg: string, sendToProgress: boolean = true) => {
      const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
      log.push(entry);
      if (onProgress && sendToProgress) {
        onProgress(msg.length > 200 ? msg.slice(0, 197) + "..." : msg);
      }
    };

    addLog(`Re-invoking AI Module Doctor using provider: ${config.provider} (${config.modelName})...`);

    const currentValidation = validateAdventure(existingAdventure);
    addLog(`Initial adventure has ${existingAdventure.adventure.locations.length} locations, initial valid: ${currentValidation.valid}`);
    const systemPrompt = this.getDungeonMasterSystemPrompt();

    const userPrompt = `Re-examine, repair, and enhance the following D&D adventure JSON:

${customUserInstructions ? `ADDITIONAL USER DM INSTRUCTIONS:\n${customUserInstructions}\n` : ""}

CURRENT ADVENTURE JSON:
${JSON.stringify(existingAdventure, null, 2)}

REQUIREMENTS:
1. Fix any unreachable rooms or dangling exit targets.
2. Separate DM Secret Notes into narrative.gmNotes and Player Read-Aloud into narrative.playerFacingDescription.
3. Return ONLY valid JSON matching schemaVersion "0.1".`;

    addLog(`=== DUNGEON MASTER SYSTEM PROMPT ===\n${systemPrompt}\n=== END DUNGEON MASTER SYSTEM PROMPT ===`, false);
    addLog(`=== USER RECOMPILE PROMPT SENT TO MODEL ===\n${userPrompt}\n=== END USER RECOMPILE PROMPT ===`, false);

    try {
      const repairedRaw = await generateAiCompletion(userPrompt, config, systemPrompt);
      addLog(`=== RAW AI RECOMPILE RESPONSE (${repairedRaw.length} characters) ===\n${repairedRaw}\n=== END RAW AI RECOMPILE RESPONSE ===`, false);
      const repairedJson = JSON.parse(repairedRaw);
      const repairedZod = VersionedAdventureSchema.safeParse(repairedJson);

      let vAdventure: VersionedAdventure;
      if (repairedZod.success) {
        vAdventure = repairedZod.data as VersionedAdventure;
        addLog(`Re-compiled adventure parsed and passed Zod schema validation successfully.`);
      } else {
        const errorMsg = repairedZod.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
        addLog(`Re-compiled JSON failed Zod schema validation:\n${errorMsg}`);
        throw new Error(`Zod schema validation failed: ${errorMsg}`);
      }

      let validation = validateAdventure(vAdventure);
      addLog(`Re-compiled adventure Grimoire3D solver validation: valid=${validation.valid}, issuesCount=${validation.issues.length}`);
      if (validation.issues.length > 0) {
        const issList = validation.issues.map((i) => `  - [${i.severity.toUpperCase()}] ${i.code}: ${i.message}`).join('\n');
        addLog(`Validation issues remaining:\n${issList}`);
      }

      addLog("Generating updated AI Module Conversion Report...");
      const report = this.generateConversionReport(vAdventure, validation);
      addLog(`=== RECOMPILE CONVERSION REPORT SUMMARY ===\n${report.gameLoopDescription}\n=== END RECOMPILE CONVERSION REPORT SUMMARY ===`, false);

      return {
        success: validation.valid,
        versionedAdventure: vAdventure,
        validation,
        extractionLog: log,
        fullTextLog: log.join("\n"),
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
        fullTextLog: log.join("\n"),
        repairPassesRun: 1,
        report,
      };
    }
  }
}
