import React, { useState, useMemo, useCallback } from "react";
import { useToast } from "./ToastProvider";
import { useKeyboardShortcuts, ShortcutBinding } from "./useKeyboardShortcuts";
import { VersionedAdventure, Location } from "@grimoire3d/ir";
import { validateAdventure } from "@grimoire3d/validator";
import { serpentAltarAdventure, serpentAltarWalkthrough, b2KeepOnTheBorderlands, b1InSearchOfTheUnknown, a1SlavePitsOfTheUndercity } from "@grimoire3d/fixtures";
import {
  AdventureGraphView,
  LocationInspector,
  ProvenanceInspector,
  ValidationPanel,
  GridMapView,
  PlaytestSimulatorView,
  ExplorationView2D,
  ProceduralGeneratorModal,
  VisualLogicEditorView,
  ToolsInspectorView,
  ModuleImporterView,
  AiDirectorPanel,
  TacticalCombatView,
} from "@grimoire3d/ui-editor";
import { CampaignHubView } from "@grimoire3d/ui-campaign";
import { greywatchCampaign, b2Campaign } from "@grimoire3d/fixtures-campaign";
import { CampaignSession } from "@grimoire3d/campaign-simulator";
import { ErrorBoundary } from "./ErrorBoundary";
import {
  Castle,
  Sparkles,
  Compass,
  LayoutGrid,
  Play,
  Gamepad2,
  ShieldCheck,
  ShieldAlert,
  Download,
  AlertCircle,
  RefreshCw,
  BookOpen,
  Dices,
  Zap,
  Wand2,
  FileText,
  Boxes,
  Bot,
  Swords,
} from "lucide-react";

export function App() {
  const [vAdventure, setVAdventure] = useState<VersionedAdventure>(() => b2KeepOnTheBorderlands as VersionedAdventure);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("keep-main-gate");
  const [activeTab, setActiveTab] = useState<
    "import" | "rooms" | "objects" | "logic" | "combat" | "explore" | "playtest" | "campaign" | "tools"
  >("import");
  const [campaignSession, setCampaignSession] = useState<CampaignSession>(() => new CampaignSession(b2Campaign, 42));
  const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);
  const [isAiDirectorOpen, setIsAiDirectorOpen] = useState(false);
  const { addToast } = useToast();

  const handleSelectModule = (modKey: "a1" | "b1" | "b2" | "serpent") => {
    if (modKey === "a1") {
      setVAdventure(a1SlavePitsOfTheUndercity as VersionedAdventure);
      setSelectedLocationId("a1-secret-entrance");
      setCampaignSession(new CampaignSession(greywatchCampaign, 42));
    } else if (modKey === "b1") {
      setVAdventure(b1InSearchOfTheUnknown as VersionedAdventure);
      setSelectedLocationId("b1-entrance-alcoves");
      setCampaignSession(new CampaignSession(greywatchCampaign, 42));
    } else if (modKey === "b2") {
      setVAdventure(b2KeepOnTheBorderlands as VersionedAdventure);
      setSelectedLocationId("keep-main-gate");
      setCampaignSession(new CampaignSession(b2Campaign, 42));
    } else {
      setVAdventure(serpentAltarAdventure as VersionedAdventure);
      setSelectedLocationId("entry-hall");
      setCampaignSession(new CampaignSession(greywatchCampaign, 42));
    }
  };

  // Validate adventure live on every state change
  const validationResult = useMemo(() => validateAdventure(vAdventure), [vAdventure]);

  const selectedLocation = useMemo(
    () => vAdventure.adventure.locations.find((l) => l.id === selectedLocationId) || vAdventure.adventure.locations[0],
    [vAdventure, selectedLocationId]
  );

  const handleUpdateLocation = (updatedLoc: Location) => {
    setVAdventure((prev) => ({
      ...prev,
      adventure: {
        ...prev.adventure,
        locations: prev.adventure.locations.map((l) => (l.id === updatedLoc.id ? updatedLoc : l)),
      },
    }));
  };

  const handleUpdateReviewStatus = (status: "unreviewed" | "accepted" | "edited" | "rejected") => {
    if (!selectedLocation || !selectedLocation.provenance) return;
    const updatedLoc: Location = {
      ...selectedLocation,
      provenance: {
        ...selectedLocation.provenance,
        review: {
          ...selectedLocation.provenance.review,
          status,
          reviewedAt: new Date().toISOString(),
        },
      },
    };
    handleUpdateLocation(updatedLoc);
  };

  const handleResetFixture = () => {
    setVAdventure(serpentAltarAdventure as VersionedAdventure);
    setSelectedLocationId("entry-hall");
  };

  const handleInjectError = () => {
    // Intentionally inject a broken exit and missing key to demonstrate deterministic validator state-space solver
    setVAdventure((prev) => ({
      ...prev,
      adventure: {
        ...prev.adventure,
        locations: prev.adventure.locations.map((l) => {
          if (l.id === "trap-room") {
            return {
              ...l,
              exits: l.exits.map((e) => {
                if (e.id === "exit-trap-to-altar") {
                  return {
                    ...e,
                    target: "non-existent-room-999", // Dangling target
                    locked: { keyItemId: "unobtainable-ghost-key" }, // Missing & unreachable key
                  };
                }
                return e;
              }),
            };
          }
          return l;
        }),
      },
    }));
  };

  const handleExportJson = useCallback(() => {
    const jsonStr = JSON.stringify(vAdventure, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${vAdventure.adventure.id}.v0.1.json`;
    a.click();
    addToast({ type: 'success', title: 'Adventure Exported', message: `${vAdventure.adventure.id}.v0.1.json downloaded` });
  }, [vAdventure, addToast]);

  // Keyboard shortcuts
  const tabKeys = ['import', 'rooms', 'objects', 'logic', 'combat', 'explore', 'playtest'] as const;
  useKeyboardShortcuts([
    { key: 's', ctrl: true, handler: handleExportJson, description: 'Export adventure JSON' },
    ...tabKeys.map((tab, i): ShortcutBinding => ({
      key: String(i + 1), handler: () => setActiveTab(tab), description: `Switch to ${tab} tab`,
    })),
  ]);

  const handleFocusEntity = (entityId: string, entityType: string) => {
    if (entityType === "location" || entityType === "exit" || entityType === "secret") {
      const loc = vAdventure.adventure.locations.find(
        (l) => l.id === entityId || l.exits.some((e) => e.id === entityId) || l.secrets.some((s) => s.id === entityId)
      );
      if (loc) setSelectedLocationId(loc.id);
    }
  };

  return (
    <div className="w-screen h-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* Top Navbar */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0 shadow-md">
        <div className="flex items-center gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-500 via-teal-600 to-indigo-600 p-0.5 shadow-lg shadow-emerald-950">
              <div className="w-full h-full bg-slate-950 rounded-[6px] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
                Grimoire3D <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.5 rounded font-mono font-normal">STUDIO v0.2</span>
              </h1>
            </div>
          </div>

          {/* Module Title Dropdown */}
          <div className="hidden md:flex items-center gap-2 text-xs bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={
                vAdventure.adventure.id === "a1-slave-pits-of-the-undercity"
                  ? "a1"
                  : vAdventure.adventure.id === "b1-in-search-of-the-unknown"
                  ? "b1"
                  : vAdventure.adventure.id === "b2-keep-on-the-borderlands"
                  ? "b2"
                  : "serpent"
              }
              onChange={(e) => handleSelectModule(e.target.value as "a1" | "b1" | "b2" | "serpent")}
              className="bg-transparent text-slate-100 font-medium text-xs focus:outline-none cursor-pointer"
            >
              <option value="a1" className="bg-slate-900 text-slate-100">A1: Slave Pits of the Undercity (Ruined Temple & Sewers)</option>
              <option value="b1" className="bg-slate-900 text-slate-100">B1: In Search of the Unknown (Quasqueton Stronghold)</option>
              <option value="b2" className="bg-slate-900 text-slate-100">B2: The Keep on the Borderlands (PDF Imported)</option>
              <option value="serpent" className="bg-slate-900 text-slate-100">The Serpent Altar Crypt (10-Room Dungeon)</option>
            </select>
            <span className="text-slate-500 font-mono text-[11px]">({vAdventure.adventure.locations.length} Locations)</span>
          </div>
        </div>

        {/* Intuitive 6-Step Workflow Tab Switcher */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab("import")}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all flex items-center gap-1.5 ${
              activeTab === "import"
                ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-950"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> 1. Import Module
          </button>

          <button
            onClick={() => setActiveTab("rooms")}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all flex items-center gap-1.5 ${
              activeTab === "rooms"
                ? "bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-950"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Compass className="w-3.5 h-3.5" /> 2. Rooms & Map
          </button>

          <button
            onClick={() => setActiveTab("objects")}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all flex items-center gap-1.5 ${
              activeTab === "objects"
                ? "bg-sky-500 text-slate-950 font-bold shadow-md shadow-sky-950"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Boxes className="w-3.5 h-3.5" /> 3. Objects & Secrets
          </button>

          <button
            onClick={() => setActiveTab("logic")}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all flex items-center gap-1.5 ${
              activeTab === "logic"
                ? "bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-950"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> 4. Logic & Triggers
          </button>

          <button
            onClick={() => setActiveTab("combat")}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all flex items-center gap-1.5 ${
              activeTab === "combat"
                ? "bg-red-500 text-slate-950 font-bold shadow-md shadow-red-950"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Swords className="w-3.5 h-3.5" /> 5. Tactical Combat Grid
          </button>

          <button
            onClick={() => setActiveTab("explore")}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all flex items-center gap-1.5 ${
              activeTab === "explore"
                ? "bg-indigo-500 text-slate-950 font-bold shadow-md shadow-indigo-950"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Gamepad2 className="w-3.5 h-3.5" /> 6. Play Game (2D/3D)
          </button>

          <button
            onClick={() => setActiveTab("playtest")}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all flex items-center gap-1.5 ${
              activeTab === "playtest"
                ? "bg-purple-500 text-slate-950 font-bold shadow-md shadow-purple-950"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Play className="w-3.5 h-3.5" /> Playtest Workbench
          </button>

          <span className="w-px h-5 bg-slate-700 mx-1" />

          <button
            onClick={() => setActiveTab("campaign")}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all flex items-center gap-1.5 ${
              activeTab === "campaign"
                ? "bg-amber-600 text-slate-950 font-bold shadow-md shadow-amber-950"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Castle className="w-3.5 h-3.5" /> Campaign
          </button>

          <button
            onClick={() => setActiveTab("tools")}
            className={`px-3 py-1.5 text-xs rounded-md font-medium transition-all flex items-center gap-1.5 ${
              activeTab === "tools"
                ? "bg-slate-500 text-slate-950 font-bold shadow-md shadow-slate-950"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" /> Tools
          </button>
        </div>

        {/* Action Buttons & AI Director Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAiDirectorOpen((prev) => !prev)}
            title="Toggle AI Director Drawer (Gemini / OpenRouter Assistant)"
            className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer ${
              isAiDirectorOpen
                ? "bg-amber-400 text-slate-950 shadow-amber-950"
                : "bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700"
            }`}
          >
            <Bot className="w-4 h-4 text-amber-400" /> AI Director
          </button>

          <button
            onClick={() => setIsGeneratorModalOpen(true)}
            title="Open 1-Click Procedural Dungeon Generator"
            className="px-2.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-slate-950 font-extrabold rounded-md text-xs flex items-center gap-1 shadow-md transition-all cursor-pointer"
          >
            <Dices className="w-3.5 h-3.5" /> Procedural
          </button>

          <button
            onClick={handleExportJson}
            title="Export Versioned Adventure IR JSON"
            className="px-2.5 py-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded-md text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export IR
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="flex-1 p-4 overflow-hidden relative flex">
        <div className="flex-1 h-full overflow-hidden">
          <ErrorBoundary onReset={handleResetFixture}>
            {activeTab === "import" && (
            <ModuleImporterView
              onImportComplete={(importedAdv) => {
                setVAdventure(importedAdv);
                setSelectedLocationId(importedAdv.adventure.start);
                setActiveTab("rooms");
              }}
            />
          )}

          {activeTab === "rooms" && (
            <div className="w-full h-full grid grid-cols-12 gap-4 overflow-hidden">
              {/* Left 7 cols: Topology Graph */}
              <div className="col-span-7 h-full">
                <AdventureGraphView
                  vAdventure={vAdventure}
                  selectedLocationId={selectedLocationId}
                  onSelectLocation={setSelectedLocationId}
                  issues={validationResult.issues}
                />
              </div>

              {/* Right 5 cols: 2D Grid Layout */}
              <div className="col-span-5 h-full">
                <GridMapView
                  vAdventure={vAdventure}
                  selectedLocationId={selectedLocationId}
                  onSelectLocation={setSelectedLocationId}
                />
              </div>
            </div>
          )}

          {activeTab === "objects" && (
            <div className="w-full h-full grid grid-cols-12 gap-4 overflow-hidden">
              <div className="col-span-7 h-full">
                <LocationInspector
                  vAdventure={vAdventure}
                  locationId={selectedLocationId}
                  onUpdateLocation={handleUpdateLocation}
                />
              </div>
              <div className="col-span-5 h-full flex flex-col gap-4">
                <ProvenanceInspector
                  provenance={selectedLocation?.provenance}
                  onUpdateReviewStatus={handleUpdateReviewStatus}
                />
                <ValidationPanel
                  validationResult={validationResult}
                  onFocusEntity={handleFocusEntity}
                />
              </div>
            </div>
          )}

          {activeTab === "logic" && (
            <div className="w-full h-full">
              <VisualLogicEditorView />
            </div>
          )}

          {activeTab === "combat" && (
            <div className="w-full h-full">
              <TacticalCombatView />
            </div>
          )}

          {activeTab === "explore" && (
            <div className="w-full h-full">
              <ExplorationView2D
                vAdventure={vAdventure}
                onLocationChanged={setSelectedLocationId}
              />
            </div>
          )}

          {activeTab === "playtest" && (
            <div className="w-full h-full">
              <PlaytestSimulatorView
                vAdventure={vAdventure}
                walkthroughScript={serpentAltarWalkthrough}
                onLocationChanged={setSelectedLocationId}
              />
            </div>
          )}

          {activeTab === "campaign" && (
            <div className="w-full h-full">
              <CampaignHubView
                vCampaign={vAdventure.adventure.id === "b2-keep-on-the-borderlands" ? b2Campaign : greywatchCampaign}
                session={campaignSession}
                onDispatchAction={(action) => {
                  campaignSession.executeAction(action);
                  setCampaignSession(Object.assign(Object.create(Object.getPrototypeOf(campaignSession)), campaignSession));
                }}
                onEnterDungeonView={() => setActiveTab("explore")}
              />
            </div>
          )}

          {activeTab === "tools" && (
            <div className="w-full h-full">
              <ToolsInspectorView />
            </div>
          )}
          </ErrorBoundary>
        </div>

        {/* AI Director Drawer */}
        {isAiDirectorOpen && (
          <AiDirectorPanel
            vAdventure={vAdventure}
            selectedLocationId={selectedLocationId}
            onUpdateAdventure={setVAdventure}
            onClose={() => setIsAiDirectorOpen(false)}
          />
        )}
      </main>

      {/* Procedural Generator Wizard Modal */}
      <ProceduralGeneratorModal
        isOpen={isGeneratorModalOpen}
        onClose={() => setIsGeneratorModalOpen(false)}
        onAdventureGenerated={(newAdv) => {
          setVAdventure(newAdv);
          setSelectedLocationId(newAdv.adventure.start);
          setActiveTab("explore");
        }}
      />

      {/* Status Footer */}
      <footer className="h-8 bg-slate-900 border-t border-slate-800 px-6 flex items-center justify-between text-xs text-slate-400 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            {validationResult.valid ? (
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" /> Graph State: Validated
              </span>
            ) : (
              <span className="flex items-center gap-1 text-red-400 font-medium">
                <ShieldAlert className="w-3.5 h-3.5" /> Graph State: {validationResult.issues.length} Issues Found
              </span>
            )}
          </div>
          <span className="text-slate-600">|</span>
          <span>Start: <code className="text-amber-300 font-mono">{vAdventure.adventure.start}</code></span>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-slate-500">
          <span>AI Engine: {localStorage.getItem("grimoire_ai_provider") || "Google Gemini"}</span>
          <span>•</span>
          <span>Tactical D&D 5e Combat System</span>
          <span>•</span>
          <span>D&D SRD 5.1 CC-BY Compliant IR</span>
        </div>
      </footer>
    </div>
  );
}
