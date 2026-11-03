export type AiProviderType = "google-gemini" | "openrouter" | "offline-heuristic";

export interface AiClientConfig {
  provider: AiProviderType;
  apiKey: string;
  modelName: string;
  baseUrl?: string;
}

export interface AiModelOption {
  id: string;
  name: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
}

export const DEFAULT_AI_CONFIGS: Record<AiProviderType, AiClientConfig> = {
  "google-gemini": {
    provider: "google-gemini",
    apiKey: "",
    modelName: "gemini-2.0-flash",
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

export const AVAILABLE_MODELS: Record<AiProviderType, AiModelOption[]> = {
  "google-gemini": [
    { id: "gemini-2.0-flash", name: "Google Gemini 2.0 Flash (Fast & Modern)" },
    { id: "gemini-2.0-flash-exp", name: "Google Gemini 2.0 Flash Experimental" },
    { id: "gemini-1.5-pro", name: "Google Gemini 1.5 Pro (High Accuracy)" },
    { id: "gemini-1.5-flash", name: "Google Gemini 1.5 Flash (Fast)" },
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
 * Queries Google Gemini's models endpoint to discover all available models supporting content generation.
 */
export async function fetchAvailableGeminiModels(apiKey: string): Promise<AiModelOption[]> {
  const cleanKey = apiKey ? apiKey.trim() : "";
  if (!cleanKey) {
    throw new Error("Gemini API key is required to refresh available models.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Gemini API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data || !Array.isArray(data.models)) {
    throw new Error("Invalid response from Gemini API: missing models list");
  }

  // Filter for models supporting content generation (excluding embeddings-only or specialized non-text models)
  const contentModels = data.models.filter((m: any) => {
    const methods: string[] = m.supportedGenerationMethods || [];
    const isGenerateContent = methods.includes("generateContent");
    const name: string = m.name || "";
    const isExcluded = name.includes("embedding") || name.includes("aqa") || name.includes("imagen");
    return isGenerateContent && !isExcluded;
  });

  const formatted: AiModelOption[] = contentModels.map((m: any) => {
    const rawId: string = m.name || "";
    const cleanId = rawId.replace(/^models\//, "");
    const displayName = m.displayName ? `${m.displayName} (${cleanId})` : cleanId;
    return {
      id: cleanId,
      name: displayName,
      description: m.description,
      inputTokenLimit: m.inputTokenLimit,
      outputTokenLimit: m.outputTokenLimit,
    };
  });

  if (formatted.length === 0) {
    return AVAILABLE_MODELS["google-gemini"];
  }

  // Sort: prioritize 2.5 > 2.0 > 1.5, with flash first for speed
  formatted.sort((a, b) => {
    const getScore = (id: string) => {
      let score = 0;
      if (id.includes("2.5")) score += 40;
      else if (id.includes("2.0")) score += 30;
      else if (id.includes("1.5")) score += 20;

      if (id.includes("flash")) score += 5;
      else if (id.includes("pro")) score += 3;
      return score;
    };
    return getScore(b.id) - getScore(a.id);
  });

  return formatted;
}

/**
 * Discovers available models for a given AI provider.
 */
export async function fetchAvailableAiModels(
  provider: AiProviderType,
  apiKey: string
): Promise<AiModelOption[]> {
  if (provider === "google-gemini") {
    return fetchAvailableGeminiModels(apiKey);
  }
  if (provider === "openrouter") {
    return AVAILABLE_MODELS.openrouter;
  }
  return AVAILABLE_MODELS["offline-heuristic"];
}

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
  const rawModel = config.modelName || "gemini-2.0-flash";
  const model = rawModel.replace(/^models\//, "");
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
  // Extract module text from prompt wrapper if present
  let moduleText = prompt;
  const startMarker = "=== MODULE TEXT START ===";
  const endMarker = "=== MODULE TEXT END ===";
  if (prompt.includes(startMarker)) {
    const startIdx = prompt.indexOf(startMarker) + startMarker.length;
    const endIdx = prompt.includes(endMarker) ? prompt.indexOf(endMarker) : prompt.length;
    moduleText = prompt.slice(startIdx, endIdx).trim();
  }

  interface DetectedArea {
    num: string;
    title: string;
    startIndex: number;
    headerLength: number;
  }

  const detectedAreas: DetectedArea[] = [];

  // Strategy 1: Standard numbered D&D room headers (e.g., "1. MAIN GATE:", "Area 1: Crypt", "Room 2 - Armory", "3. Stables.")
  const numberedHeaderRegex = /(?:^|\n)\s*(?:#{1,4}\s*)?(?:\*\*)?(?:(?:Area|Room|Chamber|Location|Section|Level)\s+)?(\d{1,3}|[A-Z])[\.\:\)\-]\s+([^\n\r\:]{2,60})(?:\*\*)?(?:[:\.\-]|\n|$)/gi;
  let match: RegExpExecArray | null;

  while ((match = numberedHeaderRegex.exec(moduleText)) !== null) {
    const num = match[1];
    const rawTitle = match[2].trim();
    // Exclude false positives like bullet points "1. You see..."
    if (rawTitle.length > 1 && !rawTitle.toLowerCase().startsWith("you ") && !rawTitle.toLowerCase().startsWith("the ")) {
      detectedAreas.push({
        num,
        title: rawTitle,
        startIndex: match.index,
        headerLength: match[0].length,
      });
    }
  }

  // Strategy 2: If Strategy 1 found < 2 rooms, try ALL-CAPS standalone lines with colon (e.g., "MAIN GATE:", "FLANKING TOWERS:")
  if (detectedAreas.length < 2) {
    detectedAreas.length = 0;
    const allCapsRegex = /(?:^|\n)\s*(?:\*\*)?([A-Z0-9\s'\-&/]{3,40})(?:\*\*)?:\s*(?:\n|$)/g;
    let capIdx = 1;
    while ((match = allCapsRegex.exec(moduleText)) !== null) {
      const rawTitle = match[1].trim();
      const lower = rawTitle.toLowerCase();
      // Filter non-room labels
      if (!lower.includes("module text") && !lower.includes("system") && !lower.includes("schema") && !lower.includes("prompt")) {
        detectedAreas.push({
          num: String(capIdx++),
          title: rawTitle,
          startIndex: match.index,
          headerLength: match[0].length,
        });
      }
    }
  }

  // Strategy 3: If still < 2 rooms, split into paragraphs if multi-paragraph text is provided
  if (detectedAreas.length < 2) {
    detectedAreas.length = 0;
    const paragraphs = moduleText
      .split(/\n\s*\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 35 && !p.startsWith("===") && !p.startsWith("Convert the following"));

    if (paragraphs.length >= 2) {
      for (let i = 0; i < Math.min(paragraphs.length, 25); i++) {
        const para = paragraphs[i];
        // Generate a concise title from the first words
        const firstLine = para.split("\n")[0].slice(0, 35).replace(/[.:-]/g, "").trim();
        detectedAreas.push({
          num: String(i + 1),
          title: firstLine || `Chamber ${i + 1}`,
          startIndex: moduleText.indexOf(para),
          headerLength: 0,
        });
      }
    }
  }

  // Fallback default: If nothing could be extracted at all, provide 3 foundational rooms
  if (detectedAreas.length === 0) {
    detectedAreas.push(
      { num: "1", title: "Entrance Hall", startIndex: 0, headerLength: 0 },
      { num: "2", title: "Great Hall", startIndex: 0, headerLength: 0 },
      { num: "3", title: "Inner Sanctum", startIndex: 0, headerLength: 0 }
    );
  }

  const locations = [];
  const adventureItems: Array<{ id: string; name: string; type: string; description: string }> = [];
  const adventureMonsters: Array<{ id: string; name: string; hp: number; ac: number; attackBonus: number; damageRoll: string; xpValue: number }> = [];

  let keyGenerated = false;

  for (let i = 0; i < detectedAreas.length; i++) {
    const area = detectedAreas[i];
    const num = area.num;
    const titleName = area.title.replace(/[.:-]$/, "").trim();
    const slugName = titleName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const id = `area-${num}-${slugName || "room"}`;

    // Extract room body text between this header and the next header
    const nextArea = detectedAreas[i + 1];
    const bodyStart = area.startIndex + area.headerLength;
    const bodyEnd = nextArea ? nextArea.startIndex : moduleText.length;
    const rawBody = moduleText.slice(bodyStart, bodyEnd).trim();

    // Clean player-facing description
    const cleanedBody = rawBody
      .replace(/^[:\.\-\s]+/, "")
      .replace(/\n\s*\n+/g, " ")
      .trim();

    const firstSentence = cleanedBody.split(/(?<=[.?!])\s+/)[0] || "";
    const playerFacingDesc = cleanedBody.length > 10
      ? cleanedBody.slice(0, 320) + (cleanedBody.length > 320 ? "..." : "")
      : `The area of ${titleName} stretches out before you, illuminated by dim torchlight.`;

    const readAloud = `You enter ${titleName}. ${firstSentence || "Dust hangs thick in the cool air."}`;

    // Generate connected exits (adjacent rooms connected bidirectionally)
    const exits = [];
    if (nextArea) {
      const nextTitle = nextArea.title.replace(/[.:-]$/, "").trim();
      const nextSlug = nextTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const nextId = `area-${nextArea.num}-${nextSlug || "room"}`;

      // Check if this room has a locked door leading forward
      const isLocked = !keyGenerated && i > 1 && (cleanedBody.toLowerCase().includes("lock") || cleanedBody.toLowerCase().includes("gate") || cleanedBody.toLowerCase().includes("portcullis"));
      if (isLocked) {
        keyGenerated = true;
      }

      exits.push({
        id: `exit-${id}-to-${nextId}`,
        label: `Passage to ${nextTitle}`,
        direction: i % 2 === 0 ? "north" : "east",
        target: nextId,
        locked: isLocked ? { keyItemId: "iron-key", pickable: true, lockpickDC: 15 } : undefined,
      });
    }

    if (i > 0) {
      const prevArea = detectedAreas[i - 1];
      const prevTitle = prevArea.title.replace(/[.:-]$/, "").trim();
      const prevSlug = prevTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const prevId = `area-${prevArea.num}-${prevSlug || "room"}`;

      exits.push({
        id: `exit-${id}-to-${prevId}`,
        label: `Passage back to ${prevTitle}`,
        direction: (i - 1) % 2 === 0 ? "south" : "west",
        target: prevId,
      });
    }

    // Detect interactables, chests, and keys
    const interactables: any[] = [];
    const lowerBody = cleanedBody.toLowerCase();

    if (lowerBody.includes("chest") || lowerBody.includes("box") || lowerBody.includes("key") || lowerBody.includes("urn")) {
      const hasKey = lowerBody.includes("key") || i === 1;
      const itemId = hasKey ? "iron-key" : undefined;

      if (hasKey && !adventureItems.some((it) => it.id === "iron-key")) {
        adventureItems.push({
          id: "iron-key",
          name: "Heavy Iron Key",
          type: "key",
          description: "An ornate wrought iron key found inside the dungeon.",
        });
      }

      interactables.push({
        id: `chest-${id}`,
        label: hasKey ? "Iron Chest (Contains Key)" : "Sturdy Wooden Chest",
        description: `A reinforced chest resting in ${titleName}.`,
        actionType: "INSPECT",
        grantsItemId: itemId,
        onInspectEffects: hasKey ? [{ kind: "grantItem", itemId: "iron-key" }] : undefined,
      });
    } else {
      interactables.push({
        id: `inspect-${id}`,
        label: `Examine ${titleName}`,
        description: `A detailed inspection of the masonry and contents of ${titleName}.`,
        actionType: "INSPECT",
      });
    }

    // Detect monsters and tactical combat encounters
    const monsterMatch = lowerBody.match(/(guard|crossbowm[ae]n|orc|goblin|ogre|skeleton|zombie|bandit|spider|rat|wolf|viper|snake|lizard|ghoul|wight|dragon|boss|men-at-arms)/i);
    if (monsterMatch) {
      const monsterName = monsterMatch[1].charAt(0).toUpperCase() + monsterMatch[1].slice(1).toLowerCase();
      const monsterId = `monster-${id}-${monsterMatch[1].toLowerCase()}`;

      // Extract HP/AC if present (e.g. "AC 3, F 1, hp 5" or "hp 12")
      const hpMatch = lowerBody.match(/hp\s*[:=]?\s*(\d+)/i);
      const acMatch = lowerBody.match(/ac\s*[:=]?\s*(\d+)/i);
      const hp = hpMatch ? parseInt(hpMatch[1], 10) : 10;
      const ac = acMatch ? parseInt(acMatch[1], 10) : 12;

      adventureMonsters.push({
        id: monsterId,
        name: monsterName,
        hp,
        ac,
        attackBonus: 3,
        damageRoll: "1d6+1",
        xpValue: 50,
      });

      interactables.push({
        id: `encounter-${id}`,
        label: `Hostile ${monsterName} Encounter`,
        description: `Tactical combat encounter against hostile ${monsterName}.`,
        actionType: "INTERACT",
      });
    }

    // Detect secrets
    const secrets: any[] = [];
    if (lowerBody.includes("secret") || lowerBody.includes("hidden") || lowerBody.includes("concealed")) {
      secrets.push({
        id: `secret-${id}`,
        label: "Hidden Compartment",
        description: `A cleverly concealed stone latch discovered in ${titleName}.`,
        perceptionDC: 12,
      });
    }

    locations.push({
      id,
      label: `${num}. ${titleName}`,
      description: cleanedBody || `Tactical area for ${titleName}.`,
      geometry: { x: (i % 6) * 4, y: Math.floor(i / 6) * 4, width: 3, height: 3 },
      presentation: {
        biome: i === 0 ? "keep" : i % 2 === 0 ? "cavern" : "crypt",
        lighting: "torchlit",
        ambienceTags: ["stone", "dark", "dungeon"],
      },
      narrative: {
        readAloud,
        playerFacingDescription: playerFacingDesc,
        gmNotes: [`Area ${num} DM notes: ${cleanedBody.slice(0, 150) || "Tactical positioning area."}`],
      },
      exits,
      interactables,
      secrets,
    });
  }

  const startId = locations[0]?.id || "area-1-room";

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
      summary: `D&D Adventure with ${locations.length} converted locations mapped to Grimoire3D IR.`,
      start: startId,
      items: adventureItems,
      npcs: [],
      monsters: adventureMonsters,
      quests: [],
      locations,
    },
  };

  return JSON.stringify(result, null, 2);
}

