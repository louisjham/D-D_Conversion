import React, { useState } from "react";
import { VersionedAdventure, Location } from "@grimoire3d/ir";
import { validateAdventure } from "@grimoire3d/validator";
import {
  AiClientConfig,
  generateAiCompletion,
  DEFAULT_AI_CONFIGS,
  AiModuleParser,
} from "@grimoire3d/importers";
import {
  Sparkles,
  Wand2,
  Swords,
  ShieldCheck,
  ShieldAlert,
  Send,
  RefreshCw,
  X,
  Bot,
  Zap,
  Eye,
  EyeOff,
  Wrench,
  BookOpen,
} from "lucide-react";

interface AiDirectorPanelProps {
  vAdventure: VersionedAdventure;
  selectedLocationId: string;
  onUpdateAdventure: (updated: VersionedAdventure) => void;
  onClose: () => void;
}

export const AiDirectorPanel: React.FC<AiDirectorPanelProps> = ({
  vAdventure,
  selectedLocationId,
  onUpdateAdventure,
  onClose,
}) => {
  const [provider] = useState<"google-gemini" | "openrouter" | "offline-heuristic">(
    () => (localStorage.getItem("grimoire_ai_provider") as any) || "google-gemini"
  );
  const [apiKey] = useState<string>(
    () => localStorage.getItem(`grimoire_ai_key_${provider}`) || ""
  );
  const [modelName] = useState<string>(
    () => localStorage.getItem(`grimoire_ai_model_${provider}`) || DEFAULT_AI_CONFIGS[provider].modelName
  );

  const [promptInput, setPromptInput] = useState("");
  const [customRepairInstructions, setCustomRepairInstructions] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [viewKnowledgeMode, setViewKnowledgeMode] = useState<"player" | "dm">("player");
  const [chatLog, setChatLog] = useState<Array<{ sender: "user" | "ai"; message: string }>>([
    {
      sender: "ai",
      message:
        "Hello! I am your AI Dungeon Master Assistant. I partition DM secrets vs player read-aloud flavor text, ensure game loop solvability, and can re-compile broken modules.",
    },
  ]);

  const selectedLocation =
    vAdventure.adventure.locations.find((l) => l.id === selectedLocationId) ||
    vAdventure.adventure.locations[0];

  const validationResult = validateAdventure(vAdventure);

  const getAiConfig = (): AiClientConfig => ({
    provider,
    apiKey,
    modelName,
  });

  const handleRecompileAndFix = async () => {
    setIsBusy(true);
    setChatLog((prev) => [
      ...prev,
      { sender: "ai", message: "🔄 Re-invoking AI Doctor to repair, balance, and re-compile module..." },
    ]);

    try {
      const res = await AiModuleParser.recompileAndFixAdventure(
        vAdventure,
        getAiConfig(),
        customRepairInstructions
      );

      if (res.versionedAdventure) {
        onUpdateAdventure(res.versionedAdventure);
        setChatLog((prev) => [
          ...prev,
          {
            sender: "ai",
            message: res.validation.valid
              ? "✅ Re-compilation complete! Module is 100% playable and validated."
              : `⚠️ Re-compilation complete with ${res.validation.issues.length} minor issue(s) remaining.`,
          },
        ]);
      }
    } catch (err: any) {
      setChatLog((prev) => [
        ...prev,
        { sender: "ai", message: `❌ Re-compilation failed: ${err?.message || err}` },
      ]);
    } finally {
      setIsBusy(false);
    }
  };

  const handleEnhanceFlavor = async () => {
    if (!selectedLocation) return;
    setIsBusy(true);
    const systemPrompt = `You are a legendary D&D Dungeon Master. Enhance the description for a room. Partition into playerFacingDescription and gmNotes. Output valid JSON in format: {"playerFacingDescription": "string", "readAloud": "string", "gmNotes": ["string"]}`;
    const userPrompt = `Enhance room flavor for location '${selectedLocation.label}' (ID: ${selectedLocation.id}). Current text: ${selectedLocation.narrative?.playerFacingDescription || "A dark stone chamber."}`;

    try {
      const resultRaw = await generateAiCompletion(userPrompt, getAiConfig(), systemPrompt);
      let parsed: any = {};
      try {
        parsed = JSON.parse(resultRaw);
      } catch {
        parsed = { playerFacingDescription: resultRaw, gmNotes: ["Enhanced via AI Director."] };
      }

      const updatedLoc: Location = {
        ...selectedLocation,
        narrative: {
          ...selectedLocation.narrative,
          playerFacingDescription: parsed.playerFacingDescription || selectedLocation.narrative?.playerFacingDescription || "",
          gmNotes: Array.isArray(parsed.gmNotes) ? parsed.gmNotes : (selectedLocation.narrative?.gmNotes || []),
        },

      };

      const updatedAdv: VersionedAdventure = {
        ...vAdventure,
        adventure: {
          ...vAdventure.adventure,
          locations: vAdventure.adventure.locations.map((l) => (l.id === updatedLoc.id ? updatedLoc : l)),
        },
      };

      onUpdateAdventure(updatedAdv);
      setChatLog((prev) => [
        ...prev,
        { sender: "ai", message: `✨ Enhanced flavor and DM secrets for location '${selectedLocation.label}'!` },
      ]);
    } catch (err: any) {
      setChatLog((prev) => [
        ...prev,
        { sender: "ai", message: `❌ Failed to enhance flavor text: ${err?.message || err}` },
      ]);
    } finally {
      setIsBusy(false);
    }
  };

  const handleAddEncounter = async () => {
    if (!selectedLocation) return;
    setIsBusy(true);
    const systemPrompt = `You are a D&D 5e encounter balance generator. Output valid JSON: {"interactableLabel": "Ambush Trigger", "monsterName": "Goblin Scout", "hp": 12, "ac": 13, "attackBonus": 4, "damageRoll": "1d6+2"}`;
    const userPrompt = `Generate a balanced low-level monster encounter for location '${selectedLocation.label}'.`;

    try {
      const resultRaw = await generateAiCompletion(userPrompt, getAiConfig(), systemPrompt);
      let parsed: any = {};
      try {
        parsed = JSON.parse(resultRaw);
      } catch {
        parsed = { interactableLabel: "Hostile Ambush", monsterName: "Skeleton Guard", hp: 13, ac: 13, attackBonus: 4, damageRoll: "1d6+2" };
      }

      const newInteractable = {
        id: `encounter-trigger-${Date.now()}`,
        label: parsed.interactableLabel || `Ambush: ${parsed.monsterName}`,
        description: `A hostile threat lurks in ${selectedLocation.label}!`,
        actionType: "INSPECT",
      };

      const updatedLoc: Location = {
        ...selectedLocation,
        interactables: [...selectedLocation.interactables, newInteractable],
      };

      const updatedAdv: VersionedAdventure = {
        ...vAdventure,
        adventure: {
          ...vAdventure.adventure,
          locations: vAdventure.adventure.locations.map((l) => (l.id === updatedLoc.id ? updatedLoc : l)),
        },
      };

      onUpdateAdventure(updatedAdv);
      setChatLog((prev) => [
        ...prev,
        { sender: "ai", message: `⚔️ Added encounter trigger '${newInteractable.label}' to location '${selectedLocation.label}'!` },
      ]);
    } catch (err: any) {
      setChatLog((prev) => [
        ...prev,
        { sender: "ai", message: `❌ Failed to generate encounter: ${err?.message || err}` },
      ]);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSendChatMessage = async () => {
    if (!promptInput.trim() || isBusy) return;
    const userMsg = promptInput;
    setPromptInput("");
    setChatLog((prev) => [...prev, { sender: "user", message: userMsg }]);
    setIsBusy(true);

    try {
      const systemPrompt = `You are Grimoire3D AI Dungeon Master assistant. Help the user design their D&D adventure. Keep answers concise and helpful.`;
      const response = await generateAiCompletion(userMsg, getAiConfig(), systemPrompt);
      setChatLog((prev) => [...prev, { sender: "ai", message: response }]);
    } catch (err: any) {
      setChatLog((prev) => [...prev, { sender: "ai", message: `Error: ${err?.message || err}` }]);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-slate-900 border-l border-slate-800 shadow-2xl z-50 flex flex-col">
      {/* Drawer Header */}
      <div className="h-14 px-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-sm text-white">AI Director & DM Assistant</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* DM vs Player Knowledge View Switcher */}
      <div className="p-3 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-sky-400" /> DM vs Player Perspective
          </span>
          <div className="flex items-center bg-slate-900 p-0.5 rounded border border-slate-800 text-[10px]">
            <button
              onClick={() => setViewKnowledgeMode("player")}
              className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                viewKnowledgeMode === "player"
                  ? "bg-emerald-600 text-white font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Eye className="w-3 h-3" /> Player View
            </button>
            <button
              onClick={() => setViewKnowledgeMode("dm")}
              className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                viewKnowledgeMode === "dm"
                  ? "bg-amber-600 text-white font-bold"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <EyeOff className="w-3 h-3" /> DM Secrets
            </button>
          </div>
        </div>

        {/* Selected Location Narrative Preview */}
        {selectedLocation && (
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-mono">
            {viewKnowledgeMode === "player" ? (
              <div className="text-emerald-300">
                <span className="text-slate-500 block text-[10px]">READ ALOUD (PLAYER VISIBLE):</span>
                "{selectedLocation.narrative?.playerFacingDescription || "No flavor text."}"
              </div>
            ) : (
              <div className="text-amber-300 space-y-1">
                <span className="text-slate-500 block text-[10px]">DM SECRETS & TACTICS:</span>
                {selectedLocation.narrative?.gmNotes && selectedLocation.narrative.gmNotes.length > 0 ? (
                  selectedLocation.narrative.gmNotes.map((note, idx) => (
                    <div key={idx}>• {note}</div>
                  ))
                ) : (
                  <div>• No DM secrets defined for this location.</div>
                )}
                {selectedLocation.secrets.length > 0 && (
                  <div className="text-sky-300 font-bold mt-1">
                    • Hidden Secrets: {selectedLocation.secrets.map((s) => `${s.label} (DC ${s.perceptionDC})`).join(", ")}
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>

      {/* Quick Action & Re-Invoke AI Section */}
      <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex flex-col gap-2">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5 text-amber-400" /> Re-invoke AI Module Doctor
        </div>

        <input
          type="text"
          value={customRepairInstructions}
          onChange={(e) => setCustomRepairInstructions(e.target.value)}
          placeholder="Custom DM instructions (e.g. 'Fix locked exits, add DM secrets...')"
          className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-md px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
        />

        <button
          onClick={handleRecompileAndFix}
          disabled={isBusy}
          className="w-full py-1.5 bg-gradient-to-r from-amber-600 to-emerald-600 hover:from-amber-500 hover:to-emerald-500 text-slate-950 font-bold text-xs rounded-md flex items-center justify-center gap-1.5 transition-all shadow cursor-pointer"
        >
          {isBusy ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Wand2 className="w-3.5 h-3.5" />
          )}
          Re-invoke AI to Repair & Balance Module
        </button>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            onClick={handleEnhanceFlavor}
            disabled={isBusy}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" /> Enhance Flavor
          </button>
          <button
            onClick={handleAddEncounter}
            disabled={isBusy}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Swords className="w-3.5 h-3.5" /> Add Encounter
          </button>
        </div>
      </div>

      {/* Chat Log Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 font-sans text-xs">
        {chatLog.map((chat, idx) => (
          <div
            key={idx}
            className={`flex gap-2.5 ${chat.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            {chat.sender === "ai" && (
              <div className="w-6 h-6 rounded-full bg-emerald-950 border border-emerald-800 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            )}
            <div
              className={`p-3 rounded-xl max-w-[85%] leading-relaxed ${
                chat.sender === "user"
                  ? "bg-emerald-600 text-slate-950 font-medium rounded-br-none"
                  : "bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none"
              }`}
            >
              {chat.message}
            </div>
          </div>
        ))}

        {isBusy && (
          <div className="flex gap-2.5 items-center text-slate-400 font-mono text-[11px]">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" /> AI Director thinking...
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
        <input
          type="text"
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendChatMessage()}
          placeholder="Ask AI DM or request rule edits..."
          className="flex-1 bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-md px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
        />
        <button
          onClick={handleSendChatMessage}
          disabled={isBusy || !promptInput.trim()}
          className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-slate-950 rounded-md transition-colors cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
