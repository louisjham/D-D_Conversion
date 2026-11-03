import { describe, it, expect, vi } from "vitest";
import { AiModuleParser } from "./aiModuleParser";
import {
  DEFAULT_AI_CONFIGS,
  AVAILABLE_MODELS,
  generateAiCompletion,
  fetchAvailableGeminiModels,
  fetchAvailableOpenRouterModels,
  fetchAvailableAiModels,
} from "./aiProvider";
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

  it("5. fetchAvailableGeminiModels validates API key and handles empty input", async () => {
    await expect(fetchAvailableGeminiModels("")).rejects.toThrow(
      "Gemini API key is required"
    );
    await expect(fetchAvailableGeminiModels("   ")).rejects.toThrow(
      "Gemini API key is required"
    );
  });

  it("6. fetchAvailableGeminiModels fetches, filters, and formats live models", async () => {
    const mockApiResponse = {
      models: [
        {
          name: "models/gemini-2.0-flash",
          displayName: "Gemini 2.0 Flash",
          description: "Next-gen multimodal workhorse",
          supportedGenerationMethods: ["generateContent", "countTokens"],
        },
        {
          name: "models/gemini-1.5-pro",
          displayName: "Gemini 1.5 Pro",
          description: "High-reasoning multimodal model",
          supportedGenerationMethods: ["generateContent", "countTokens"],
        },
        {
          name: "models/text-embedding-004",
          displayName: "Text Embedding 004",
          description: "Embedding only",
          supportedGenerationMethods: ["embedContent"],
        },
        {
          name: "models/aqa",
          displayName: "Attributed Question Answering",
          supportedGenerationMethods: ["generateAnswer"],
        },
      ],
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockApiResponse,
    } as any);

    try {
      const models = await fetchAvailableGeminiModels("test-fake-key-123");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("https://generativelanguage.googleapis.com/v1beta/models?key=test-fake-key-123"),
        expect.objectContaining({ method: "GET" })
      );

      // Verify filtered out non-generation models
      expect(models.length).toBe(2);
      expect(models.some((m) => m.id === "gemini-2.0-flash")).toBe(true);
      expect(models.some((m) => m.id === "gemini-1.5-pro")).toBe(true);
      expect(models.some((m) => m.id === "text-embedding-004")).toBe(false);
      expect(models.some((m) => m.id === "aqa")).toBe(false);

      // Verify stripped 'models/' prefix and formatted display name
      const flashModel = models.find((m) => m.id === "gemini-2.0-flash");
      expect(flashModel?.name).toBe("Gemini 2.0 Flash (gemini-2.0-flash)");
      expect(flashModel?.description).toBe("Next-gen multimodal workhorse");

      // Verify fetchAvailableAiModels integration
      const aiModels = await fetchAvailableAiModels("google-gemini", "test-fake-key-123");
      expect(aiModels.length).toBe(2);

      const offlineModels = await fetchAvailableAiModels("offline-heuristic", "");
      expect(offlineModels[0].id).toBe("local-heuristic-v1");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("7. Offline heuristic extracts all rooms from Title Case and varied D&D formatting without limiting to 2 rooms", async () => {
    const rawModuleText = `
    1. Main Gate: Flanked by two towers. Guards are posted here.
    2. Flanking Towers: Four crossbowmen are stationed at the top of each tower. Inside is a chest with a key.
    3. Entry Yard: Paved yard where entrants dismount.
    4. Stables: Large wooden stable holding 20 horses. Secret door in hayloft.
    5. Common Stables: Drovers attend mules.
    6. Guard Barracks: Thirty off-duty guards.
    `;

    const config = DEFAULT_AI_CONFIGS["offline-heuristic"];
    const result = await AiModuleParser.parseModuleTextToIR(rawModuleText, config);

    expect(result.success).toBe(true);
    expect(result.versionedAdventure).toBeDefined();
    expect(result.versionedAdventure?.adventure.locations.length).toBe(6);
    expect(result.validation.valid).toBe(true);

    const labels = result.versionedAdventure?.adventure.locations.map((l) => l.label);
    expect(labels).toContain("1. Main Gate");
    expect(labels).toContain("2. Flanking Towers");
    expect(labels).toContain("3. Entry Yard");
    expect(labels).toContain("4. Stables");
    expect(labels).toContain("5. Common Stables");
    expect(labels).toContain("6. Guard Barracks");
  });

  it("8. fetchAvailableOpenRouterModels queries openrouter API and sorts free models first", async () => {
    const mockOpenRouterResponse = {
      data: [
        {
          id: "openai/gpt-4o",
          name: "OpenAI: GPT-4o",
          description: "Flagship versatile multimodal model",
          context_length: 128000,
          pricing: { prompt: "0.000005", completion: "0.000015" },
        },
        {
          id: "google/gemini-2.0-flash-exp:free",
          name: "Google: Gemini 2.0 Flash Experimental (free)",
          description: "Next gen Gemini model for free",
          context_length: 1048576,
          pricing: { prompt: "0", completion: "0" },
        },
        {
          id: "meta-llama/llama-3.3-70b-instruct:free",
          name: "Meta: Llama 3.3 70B Instruct (free)",
          description: "Open source powerhouse for free",
          context_length: 131072,
          pricing: { prompt: "0", completion: "0" },
        },
      ],
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockOpenRouterResponse,
    } as any);

    try {
      const models = await fetchAvailableOpenRouterModels("sk-or-test-key");
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://openrouter.ai/api/v1/models",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer sk-or-test-key",
          }),
        })
      );

      expect(models.length).toBe(3);
      // Free models sorted first
      expect(models[0].id).toBe("google/gemini-2.0-flash-exp:free");
      expect(models[1].id).toBe("meta-llama/llama-3.3-70b-instruct:free");
      expect(models[2].id).toBe("openai/gpt-4o");

      // Verify fetchAvailableAiModels routing
      const aiModels = await fetchAvailableAiModels("openrouter", "sk-or-test-key");
      expect(aiModels.length).toBe(3);
      expect(aiModels[0].id).toContain(":free");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
