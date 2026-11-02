export type AiProviderType = "google-gemini" | "openrouter" | "offline-heuristic";

export interface AiClientConfig {
  provider: AiProviderType;
  apiKey: string;
  modelName: string;
  baseUrl?: string;
}

export const DEFAULT_AI_CONFIGS: Record<AiProviderType, AiClientConfig> = {
  "google-gemini": {
    provider: "google-gemini",
    apiKey: "",
    modelName: "gemini-1.5-flash",
  },
  openrouter: {
    provider: "openrouter",
    apiKey: "",
    modelName: "google/gemini-2.0-flash-exp:free",
  },
  "offline-heuristic": {
    provider: "offline-heuristic",
    apiKey: "",
    modelName: "local-heuristic-v1",
  },
};

export const AVAILABLE_MODELS = {
  "google-gemini": [
    { id: "gemini-1.5-pro", name: "Google Gemini 1.5 Pro (High Accuracy)" },
    { id: "gemini-1.5-flash", name: "Google Gemini 1.5 Flash (Fast)" },
    { id: "gemini-2.0-flash-exp", name: "Google Gemini 2.0 Flash Experimental" },
  ],
  openrouter: [
    { id: "google/gemini-2.0-flash-exp:free", name: "Google Gemini 2.0 Flash (Free)" },
    { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Meta Llama 3.3 70B (Free)" },
    { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 Reasoning (Free)" },
    { id: "mistralai/mistral-7b-instruct:free", name: "Mistral 7B Instruct (Free)" },
    { id: "qwen/qwen-2.5-72b-instruct:free", name: "Qwen 2.5 72B Instruct (Free)" },
  ],
  "offline-heuristic": [
    { id: "local-heuristic-v1", name: "Offline Rules Engine (No API Key Required)" },
  ],
};

/**
 * Executes an AI text completion request against Google Gemini, OpenRouter, or local offline fallback.
 */
export async function generateAiCompletion(
  prompt: string,
  config: AiClientConfig,
  systemInstruction?: string
): Promise<string> {
  if (config.provider === "offline-heuristic" || !config.apiKey) {
    return generateOfflineHeuristicResponse(prompt);
  }

  if (config.provider === "google-gemini") {
    return callGoogleGeminiApi(prompt, config, systemInstruction);
  }

  if (config.provider === "openrouter") {
    return callOpenRouterApi(prompt, config, systemInstruction);
  }

  throw new Error(`Unsupported AI Provider: ${config.provider}`);
}

async function callGoogleGeminiApi(
  prompt: string,
  config: AiClientConfig,
  systemInstruction?: string
): Promise<string> {
  const model = config.modelName || "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    config.apiKey
  )}`;

  const contents: any[] = [];
  if (systemInstruction) {
    contents.push({
      role: "user",
      parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemInstruction}` }],
    });
    contents.push({
      role: "model",
      parts: [{ text: "Understood. I will strictly follow these system instructions." }],
    });
  }
  contents.push({
    role: "user",
    parts: [{ text: prompt }],
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Gemini API Error (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error("Google Gemini API returned empty text candidate");
  }

  return cleanJsonMarkdown(rawText);
}

async function callOpenRouterApi(
  prompt: string,
  config: AiClientConfig,
  systemInstruction?: string
): Promise<string> {
  const model = config.modelName || "google/gemini-2.0-flash-exp:free";
  const url = config.baseUrl || "https://openrouter.ai/api/v1/chat/completions";

  const messages = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  messages.push({ role: "user", content: prompt });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "HTTP-Referer": "https://grimoire3d.studio",
    "X-Title": "Grimoire3D Studio",
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API Error (${response.status}): ${errorText}`);
  }

  const json = await response.json();
  const rawText = json.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new Error("OpenRouter API returned empty response choice");
  }

  return cleanJsonMarkdown(rawText);
}

function cleanJsonMarkdown(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  return cleaned;
}

function generateOfflineHeuristicResponse(prompt: string): string {
  // Extract room names/numbers from prompt if available
  const areaMatches = Array.from(prompt.matchAll(/(\d+)\.\s+([A-Z\s]{3,30}):?/g));
  const locations = [];

  if (areaMatches.length > 0) {
    for (let i = 0; i < areaMatches.length; i++) {
      const match = areaMatches[i];
      const num = match[1];
      const titleName = match[2].trim();
      const slugName = titleName.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const id = `area-${num}-${slugName}`;
      const nextMatch = areaMatches[i + 1];
      const nextId = nextMatch
        ? `area-${nextMatch[1]}-${nextMatch[2].trim().toLowerCase().replace(/[^a-z0-9]/g, "-")}`
        : null;

      const exits = [];
      if (nextId) {
        exits.push({
          id: `exit-${id}-to-${nextId}`,
          label: `Passage to ${nextMatch[2].trim()}`,
          direction: "north",
          target: nextId,
        });
      }
      if (i > 0) {
        const prevMatch = areaMatches[i - 1];
        const prevId = `area-${prevMatch[1]}-${prevMatch[2].trim().toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
        exits.push({
          id: `exit-${id}-to-${prevId}`,
          label: `Passage back to ${prevMatch[2].trim()}`,
          direction: "south",
          target: prevId,
        });
      }

      locations.push({
        id,
        label: `${num}. ${titleName}`,
        description: `Extracted section for ${titleName}. Contains tactical positions and exploration hazards.`,
        geometry: { x: (i % 5) * 4, y: Math.floor(i / 5) * 4, width: 3, height: 3 },
        presentation: { biome: "keep", lighting: "torchlit", ambienceTags: ["stone", "dark"] },
        narrative: {
          readAloud: `You enter ${titleName}.`,
          playerFacingDescription: `The area of ${titleName} stretches out before you.`,
          gmNotes: ["Tactical positioning room."],
        },
        exits,
        interactables: [
          {
            id: `chest-${id}`,
            label: "Iron Chest",
            description: "A heavy reinforced chest resting in the corner.",
            actionType: "INSPECT",
          },
        ],
        secrets: [],
      });
    }
  } else {
    locations.push(
      {
        id: "imported-entry",
        label: "Module Entry Hall",
        description: "The main entrance room parsed from the module source text.",
        geometry: { x: 0, y: 0, width: 4, height: 4 },
        presentation: { biome: "keep", lighting: "torchlit", ambienceTags: ["stone", "echoes"] },
        narrative: {
          readAloud: "You stand at the threshold of an ancient subterranean structure.",
          playerFacingDescription: "A imposing archway opens into a damp stone hall.",
          gmNotes: ["Starting entry room."],
        },
        exits: [
          { id: "exit-entry-to-inner", label: "Archway", direction: "north", target: "imported-inner" },
        ],
        interactables: [],
        secrets: [],
      },
      {
        id: "imported-inner",
        label: "Inner Chamber",
        description: "A central hall filled with ancient carvings.",
        geometry: { x: 0, y: 5, width: 4, height: 4 },
        presentation: { biome: "crypt", lighting: "torchlit", ambienceTags: ["runes", "magic"] },
        narrative: {
          readAloud: "Ancient runes pulse with faint magical luminescence along the stone pillars.",
          playerFacingDescription: "The air hums with faint residual magic in this chamber.",
          gmNotes: ["Inner sanctum."],
        },
        exits: [
          { id: "exit-inner-to-entry", label: "Archway Back", direction: "south", target: "imported-entry" },
        ],
        interactables: [],
        secrets: [],
      }
    );
  }


  const startId = locations[0]?.id || "imported-entry";

  const result = {
    schemaVersion: "0.1",
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      importedBy: "extractor",
    },
    adventure: {
      id: "ai-extracted-adventure",
      title: "Extracted D&D Module",
      systemProfile: "classic-dungeon",
      summary: "D&D Adventure converted into playable IR format via AI Pipeline.",
      start: startId,
      items: [],
      npcs: [],
      monsters: [],
      quests: [],
      locations,
    },
  };


  return JSON.stringify(result, null, 2);
}

