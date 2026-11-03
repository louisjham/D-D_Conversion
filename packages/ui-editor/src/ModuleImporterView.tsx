import React, { useState, useEffect } from "react";
import { VersionedAdventure } from "@grimoire3d/ir";
import {
  AiClientConfig,
  DEFAULT_AI_CONFIGS,
  AVAILABLE_MODELS,
  AiModelOption,
  fetchAvailableGeminiModels,
  AiModuleParser,
  AiImportResult,
  PdfTextExtractor,
} from "@grimoire3d/importers";
import {
  Sparkles,
  Key,
  FileText,
  Upload,
  Cpu,
  ShieldCheck,
  ShieldAlert,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  ArrowRight,
  BookOpen,
  Download,
  ScrollText,
  Copy,
} from "lucide-react";

interface ModuleImporterViewProps {
  onImportComplete: (vAdv: VersionedAdventure) => void;
  onCancel?: () => void;
}

export const ModuleImporterView: React.FC<ModuleImporterViewProps> = ({
  onImportComplete,
  onCancel,
}) => {
  const [provider, setProvider] = useState<"google-gemini" | "openrouter" | "offline-heuristic">(
    () => (localStorage.getItem("grimoire_ai_provider") as any) || "google-gemini"
  );
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem(`grimoire_ai_key_${provider}`) || ""
  );
  const [modelName, setModelName] = useState<string>(
    () => localStorage.getItem(`grimoire_ai_model_${provider}`) || DEFAULT_AI_CONFIGS[provider].modelName
  );

  const [rawText, setRawText] = useState<string>("");
  const [sourceName, setSourceName] = useState<string>("Manual Paste");
  const [fileName, setFileName] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressLogs, setProgressLogs] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<AiImportResult | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "report" | "log">("summary");

  const [geminiModels, setGeminiModels] = useState<AiModelOption[]>(() => {
    try {
      const saved = localStorage.getItem("grimoire_available_models_google-gemini");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return AVAILABLE_MODELS["google-gemini"];
  });

  const [isRefreshingModels, setIsRefreshingModels] = useState<boolean>(false);
  const [modelRefreshFeedback, setModelRefreshFeedback] = useState<string | null>(null);

  const handleRefreshGeminiModels = async (keyToUse?: string) => {
    const key = (keyToUse !== undefined ? keyToUse : apiKey).trim();
    if (!key) {
      setModelRefreshFeedback("⚠️ Please enter a Google Gemini API key first.");
      setTimeout(() => setModelRefreshFeedback(null), 4000);
      return;
    }

    setIsRefreshingModels(true);
    setModelRefreshFeedback("Connecting to Google Gemini API...");
    try {
      const liveModels = await fetchAvailableGeminiModels(key);
      setGeminiModels(liveModels);
      localStorage.setItem("grimoire_available_models_google-gemini", JSON.stringify(liveModels));

      // If current model is not among live models, switch to top recommended
      if (!liveModels.some((m) => m.id === modelName) && liveModels.length > 0) {
        setModelName(liveModels[0].id);
      }
      setModelRefreshFeedback(`✅ Loaded ${liveModels.length} Gemini models`);
      setTimeout(() => setModelRefreshFeedback(null), 4000);
    } catch (err: any) {
      setModelRefreshFeedback(`❌ ${err?.message || "Failed to load models"}`);
      setTimeout(() => setModelRefreshFeedback(null), 6000);
    } finally {
      setIsRefreshingModels(false);
    }
  };

  useEffect(() => {
    if (provider === "google-gemini" && apiKey.trim().length > 15 && !localStorage.getItem("grimoire_available_models_google-gemini")) {
      handleRefreshGeminiModels(apiKey);
    }
  }, []);

  // Save AI preferences to localStorage
  useEffect(() => {
    localStorage.setItem("grimoire_ai_provider", provider);
  }, [provider]);

  useEffect(() => {
    localStorage.setItem(`grimoire_ai_key_${provider}`, apiKey);
  }, [provider, apiKey]);

  useEffect(() => {
    localStorage.setItem(`grimoire_ai_model_${provider}`, modelName);
  }, [provider, modelName]);

  const handleProviderChange = (newProvider: "google-gemini" | "openrouter" | "offline-heuristic") => {
    setProvider(newProvider);
    const savedKey = localStorage.getItem(`grimoire_ai_key_${newProvider}`) || "";
    const savedModel = localStorage.getItem(`grimoire_ai_model_${newProvider}`) || DEFAULT_AI_CONFIGS[newProvider].modelName;
    setApiKey(savedKey);
    setModelName(savedModel);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await PdfTextExtractor.extractFromFile(file);
      setRawText(res.text);
      setSourceName(res.sourceName);
    } catch (err: any) {
      alert(`Error reading file: ${err?.message || err}`);
    }
  };

  const handleLoadB2Sample = () => {
    setRawText(`AREAS OF THE KEEP
1. MAIN GATE: Two towers 30' high with battlements, flank a gatehouse 20' high. All have holes for bow and crossbow fire. A deep crevice in front of the place is spanned by a drawbridge (usually up). There is a portcullis at the entry and large gates at the far end of the passage. Two men-at-arms (AC 3, F 1, hp 5) approach when the drawbridge is lowered.
2. FLANKING TOWERS: Atop each tower are four crossbowmen with crossbows cocked and ready to fire. Inside each tower are 12 other men-at-arms. Inside is a locked chest containing an iron key.
3. ENTRY YARD: This narrow place is paved. All entrants save those of the garrison will be required to dismount. Corporal of the watch is here with a +1 magic sword.
4. STABLES: Large wooden stable holding 20 horses. Hayloft above contains a secret hidden compartment.
5. COMMON STABLES: Stable boys and drovers attend horses of traveling merchants and adventurers. A suspicious chest sits behind the hay bales.
6. INNER GATEHOUSE & COURTYARD: A fortified gateway connects to the upper bailey. Two guards stand vigilant with halberds.
7. BARRACKS & GUARD ROOM: Thirty guards dwell here in off-duty shifts. Weapon racks hold longswords, spears, and heavy crossbows.
8. KEEP TOWER & CAPTAIN'S QUARTERS: The high stone citadel of the Castellan. An iron gate stands locked, protecting the war room and treasure vault.`);
    setSourceName("B2: Keep on the Borderlands (Sample Extract)");
  };

  const handleRunAiImport = async () => {
    if (!rawText.trim()) {
      alert("Please paste or upload module text first.");
      return;
    }

    let activeProvider = provider;
    if (activeProvider !== "offline-heuristic" && !apiKey.trim()) {
      const confirmOffline = window.confirm(
        `No API key provided for ${activeProvider === "google-gemini" ? "Google Gemini" : "OpenRouter"}.\n\nWould you like to convert using the built-in Offline Rules Engine instead?`
      );
      if (confirmOffline) {
        activeProvider = "offline-heuristic";
        setProvider("offline-heuristic");
      } else {
        return;
      }
    }

    setIsProcessing(true);
    setProgressLogs([]);
    setImportResult(null);

    const config: AiClientConfig = {
      provider: activeProvider,
      apiKey: activeProvider === "offline-heuristic" ? "" : apiKey,
      modelName,
    };

    try {
      const res = await AiModuleParser.parseModuleTextToIR(rawText, config, (log) => {
        setProgressLogs((prev) => [...prev, log]);
      });
      setImportResult(res);
    } catch (err: any) {
      setProgressLogs((prev) => [...prev, `[ERROR] Unexpected import crash: ${err?.message || err}`]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full h-full bg-slate-950 text-slate-100 flex flex-col p-6 overflow-y-auto">
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-emerald-500 to-indigo-600 p-0.5 shadow-lg shadow-emerald-950">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              AI Module Importer & Ingestion Hub
            </h2>
            <p className="text-xs text-slate-400">
              Convert raw D&D PDFs, text files, and modules into validated Grimoire3D playable IR using Google Gemini or OpenRouter.
            </p>
          </div>
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-medium transition-colors"
          >
            Close Importer
          </button>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Column: AI Config & Source Upload (5 cols) */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-5">
          {/* Card 1: Provider & Model Config */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-400 mb-4">
              <Cpu className="w-4 h-4" /> 1. Select AI Engine & Model
            </div>

            {/* Provider Selector Tabs */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800 mb-4">
              <button
                onClick={() => handleProviderChange("google-gemini")}
                className={`py-1.5 text-xs rounded-md font-medium transition-all ${
                  provider === "google-gemini"
                    ? "bg-emerald-600 text-white font-bold shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Google Gemini
              </button>
              <button
                onClick={() => handleProviderChange("openrouter")}
                className={`py-1.5 text-xs rounded-md font-medium transition-all ${
                  provider === "openrouter"
                    ? "bg-indigo-600 text-white font-bold shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                OpenRouter (Free)
              </button>
              <button
                onClick={() => handleProviderChange("offline-heuristic")}
                className={`py-1.5 text-xs rounded-md font-medium transition-all ${
                  provider === "offline-heuristic"
                    ? "bg-amber-600 text-white font-bold shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Offline Rules Engine
              </button>
            </div>

            {/* API Key Input (if applicable) */}
            {provider !== "offline-heuristic" && (
              <div className="mb-4">
                <label className="block text-xs text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  {provider === "google-gemini" ? "Google Gemini API Key" : "OpenRouter API Key (Optional for free models)"}
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  onBlur={() => {
                    if (provider === "google-gemini" && apiKey.trim().length > 15 && !isRefreshingModels) {
                      handleRefreshGeminiModels(apiKey);
                    }
                  }}
                  placeholder={provider === "google-gemini" ? "AIzaSy..." : "sk-or-v1-..."}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-md px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Saved securely in your local browser storage (`localStorage`).
                </p>
              </div>
            )}

            {/* Model Selector */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-300 font-medium">
                  Target Model
                </label>
                {provider === "google-gemini" && (
                  <button
                    type="button"
                    onClick={() => handleRefreshGeminiModels()}
                    disabled={isRefreshingModels}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                    title="Refresh available models from Google Gemini API"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshingModels ? "animate-spin text-amber-400" : ""}`} />
                    {isRefreshingModels ? "Fetching..." : "Refresh Models"}
                  </button>
                )}
              </div>

              {modelRefreshFeedback && (
                <div
                  className={`text-[11px] mb-1.5 px-2 py-0.5 rounded font-mono ${
                    modelRefreshFeedback.startsWith("❌")
                      ? "text-red-400 bg-red-950/60 border border-red-900"
                      : modelRefreshFeedback.startsWith("⚠️")
                      ? "text-amber-400 bg-amber-950/60 border border-amber-900"
                      : "text-emerald-400 bg-emerald-950/60 border border-emerald-900"
                  }`}
                >
                  {modelRefreshFeedback}
                </div>
              )}

              <select
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-md px-3 py-2 text-xs text-slate-100 focus:outline-none cursor-pointer"
              >
                {(provider === "google-gemini" ? geminiModels : AVAILABLE_MODELS[provider]).map((m) => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-slate-100">
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Card 2: Source Text Input */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                <FileText className="w-4 h-4" /> 2. Module Source Document
              </div>
              <button
                onClick={handleLoadB2Sample}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium underline flex items-center gap-1 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" /> Load B2 Sample
              </button>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <label className="flex-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-xs text-slate-200 font-medium cursor-pointer flex items-center justify-center gap-2 transition-colors">
                <Upload className="w-3.5 h-3.5 text-emerald-400" /> Upload PDF / TXT File
                <input type="file" accept=".pdf,.txt" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste raw module text here or upload a file..."
              className="w-full h-44 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-md p-3 text-xs text-slate-200 font-mono resize-none focus:outline-none placeholder-slate-600"
            />

            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Source: {sourceName}</span>
              <span>{rawText.length} Chars ({rawText.split("\n").length} Lines)</span>
            </div>

            <button
              onClick={handleRunAiImport}
              disabled={isProcessing || !rawText.trim()}
              className={`w-full mt-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md ${
                isProcessing || !rawText.trim()
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-slate-950 shadow-emerald-950 cursor-pointer"
              }`}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Processing AI Extraction & Repair Pass...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-slate-950" /> Convert Module to IR via AI
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Execution Log & Verification Result (7 cols) */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-5">
          {/* Card 3: Live Progress Console */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-col h-64">
            <h3 className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" /> Pipeline Execution Console
            </h3>
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-y-auto font-mono text-[11px] space-y-1 text-slate-300">
              {progressLogs.length === 0 ? (
                <div className="text-slate-600 italic">Ready to run AI conversion pipeline.</div>
              ) : (
                progressLogs.map((log, idx) => (
                  <div key={idx} className={log.includes("[ERROR]") ? "text-red-400 font-bold" : log.includes("✅") ? "text-emerald-400 font-bold" : "text-slate-300"}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Card 4: Import Verification Result & Conversion Report */}
          {importResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex-1 flex flex-col justify-between">
              <div>
                {/* Result Tab Navigation */}
                <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button
                      onClick={() => setActiveTab("summary")}
                      className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                        activeTab === "summary"
                          ? "bg-slate-800 text-white font-bold shadow"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      Summary & Solver Status
                    </button>
                    <button
                      onClick={() => setActiveTab("report")}
                      className={`px-3 py-1 text-xs rounded-md font-medium transition-all flex items-center gap-1.5 ${
                        activeTab === "report"
                          ? "bg-emerald-600 text-white font-bold shadow"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <ScrollText className="w-3.5 h-3.5" /> AI Conversion Report & Game Loop
                    </button>
                    <button
                      onClick={() => setActiveTab("log")}
                      className={`px-3 py-1 text-xs rounded-md font-medium transition-all flex items-center gap-1.5 ${
                        activeTab === "log"
                          ? "bg-indigo-600 text-white font-bold shadow"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" /> Full Extraction Log
                    </button>
                  </div>

                  <span className="text-xs text-slate-400 font-mono">
                    Passes: {importResult.repairPassesRun}
                  </span>
                </div>

                {/* TAB 1: SUMMARY */}
                {activeTab === "summary" ? (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      {importResult.validation.valid ? (
                        <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm bg-emerald-950 border border-emerald-800 px-3 py-1 rounded-full">
                          <ShieldCheck className="w-4 h-4" /> State-Space Solver: Validated
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-amber-400 font-bold text-sm bg-amber-950 border border-amber-800 px-3 py-1 rounded-full">
                          <ShieldAlert className="w-4 h-4" /> Solver Status: {importResult.validation.issues.length} Issues Found
                        </span>
                      )}
                    </div>

                    {importResult.versionedAdventure && (
                      <div className="grid grid-cols-4 gap-3 mb-4">
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                          <div className="text-lg font-bold text-emerald-400">
                            {importResult.versionedAdventure.adventure.locations.length}
                          </div>
                          <div className="text-[10px] text-slate-400 uppercase font-mono">Locations</div>
                        </div>
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                          <div className="text-lg font-bold text-amber-400">
                            {importResult.versionedAdventure.adventure.locations.reduce(
                              (acc, l) => acc + l.exits.length,
                              0
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 uppercase font-mono">Exits / Connections</div>
                        </div>
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                          <div className="text-lg font-bold text-sky-400">
                            {importResult.versionedAdventure.adventure.locations.reduce(
                              (acc, l) => acc + l.interactables.length,
                              0
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 uppercase font-mono">Interactables</div>
                        </div>
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-center">
                          <div className="text-lg font-bold text-indigo-400">
                            {importResult.versionedAdventure.adventure.start}
                          </div>
                          <div className="text-[10px] text-slate-400 uppercase font-mono">Start Room ID</div>
                        </div>
                      </div>
                    )}

                    {importResult.validation.issues.length > 0 && (
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-36 overflow-y-auto mb-4">
                        <h4 className="text-xs font-semibold text-slate-300 mb-2">Validator Reports:</h4>
                        <div className="space-y-1 font-mono text-[11px]">
                          {importResult.validation.issues.map((iss, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-amber-300">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                              <span>[{iss.code}] {iss.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : activeTab === "report" ? (
                  /* TAB 2: FULL REPORT & GAME LOOP AUDIT */
                  <div className="flex flex-col gap-3 max-h-80 overflow-y-auto pr-1">
                    {importResult.report ? (
                      <div className="space-y-4 text-xs font-sans">
                        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                          <h4 className="font-bold text-emerald-400 mb-1 text-sm">
                            {importResult.report.moduleTitle} Overview
                          </h4>
                          <p className="text-slate-300 leading-relaxed">
                            {importResult.report.gameLoopDescription}
                          </p>
                        </div>

                        {/* Location Catalog Table */}
                        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                          <h5 className="font-semibold text-slate-200 mb-2 flex items-center gap-1.5">
                            <BookOpen className="w-3.5 h-3.5 text-sky-400" /> Converted Locations ({importResult.report.locationsConverted.length})
                          </h5>
                          <div className="space-y-1 font-mono text-[11px]">
                            {importResult.report.locationsConverted.map((loc) => (
                              <div key={loc.id} className="flex justify-between border-b border-slate-900 pb-1">
                                <span className="text-slate-200 font-bold">{loc.label}</span>
                                <span className="text-slate-500">Exits: {loc.exitsCount} | Biome: {loc.biome}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Download Report Button */}
                        <button
                          onClick={() => {
                            if (!importResult.report) return;
                            const blob = new Blob([importResult.report.markdownReport], { type: "text/markdown" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `${importResult.report.moduleTitle.toLowerCase().replace(/\s+/g, "-")}-conversion-report.md`;
                            a.click();
                          }}
                          className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                        >
                          <Download className="w-4 h-4" /> Download Full Markdown Report (.md)
                        </button>
                      </div>
                    ) : (
                      <div className="text-slate-500 italic">No conversion report generated yet.</div>
                    )}
                  </div>
                ) : (
                  /* TAB 3: FULL EXTRACTION LOG */
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-mono">
                        {importResult.extractionLog.length} log lines recorded
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const fullLog = importResult.fullTextLog || importResult.extractionLog.join("\n");
                            navigator.clipboard.writeText(fullLog);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copy Full Log
                        </button>
                        <button
                          onClick={() => {
                            const fullLog = importResult.fullTextLog || importResult.extractionLog.join("\n");
                            const blob = new Blob([fullLog], { type: "text/plain" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `extraction-log-${Date.now()}.txt`;
                            a.click();
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded text-xs font-medium cursor-pointer flex items-center gap-1.5 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" /> Download Log
                        </button>
                      </div>
                    </div>
                    <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-80 overflow-y-auto font-mono text-[11px] text-slate-300 whitespace-pre-wrap select-text leading-relaxed">
                      {importResult.fullTextLog || importResult.extractionLog.join("\n")}
                    </pre>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {importResult.versionedAdventure && (
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800 mt-3">
                  <button
                    onClick={async () => {
                      if (!importResult.versionedAdventure) return;
                      setIsProcessing(true);
                      const res = await AiModuleParser.recompileAndFixAdventure(
                        importResult.versionedAdventure,
                        { provider, apiKey, modelName },
                        undefined,
                        (log) => setProgressLogs((prev) => [...prev, log])
                      );
                      setImportResult(res);
                      setIsProcessing(false);
                    }}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-amber-950/80 hover:bg-amber-900 border border-amber-800 text-amber-300 font-semibold text-xs rounded-lg flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? "animate-spin" : ""}`} /> Re-invoke AI Doctor
                  </button>

                  <button
                    onClick={() => onImportComplete(importResult.versionedAdventure!)}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-2 shadow-lg cursor-pointer transition-all"
                  >
                    Load into Studio Workspace <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
