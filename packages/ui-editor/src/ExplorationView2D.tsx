import React, { useState, useEffect } from "react";
import { VersionedAdventure } from "@grimoire3d/ir";
import { SimulatorEngine, GameAction, DomainEvent } from "@grimoire3d/simulator";
import { WorldCompiler, WorldLayout } from "@grimoire3d/world-compiler";
import { createSaveGameEnvelope, SaveGameEnvelope } from "@grimoire3d/save-format";
import { shouldIgnoreKeyboardGameInput } from "./inputFocusGuard";
import { AutoPlayControlPanel } from "./AutoPlayControlPanel";
import {
  Compass,
  Key,
  Eye,
  ShieldAlert,
  Sparkles,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Shield,
  Box,
  Sword,
  BookOpen,
  Save,
  Upload,
  Trophy,
  RotateCcw,
  Heart,
  Skull,
} from "lucide-react";

interface ExplorationView2DProps {
  vAdventure: VersionedAdventure;
  onLocationChanged?: (locationId: string) => void;
}

export const ExplorationView2D: React.FC<ExplorationView2DProps> = ({
  vAdventure,
  onLocationChanged,
}) => {
  const [worldLayout] = useState<WorldLayout>(() => WorldCompiler.compile(vAdventure));
  const [engine, setEngine] = useState<SimulatorEngine>(() => new SimulatorEngine(vAdventure, 42));
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveEnvelopeJson, setSaveEnvelopeJson] = useState<string>("");

  const curLoc = engine.getCurrentLocation();

  const handleAction = (action: GameAction) => {
    engine.executeAction(action);
    const updated = Object.assign(Object.create(Object.getPrototypeOf(engine)), engine);
    setEngine(updated);
    if (onLocationChanged) onLocationChanged(updated.state.currentLocationId);
  };

  const handleReset = () => {
    const newEng = new SimulatorEngine(vAdventure, 42);
    setEngine(newEng);
    if (onLocationChanged) onLocationChanged(newEng.state.currentLocationId);
  };

  const handleSaveGame = () => {
    const env = createSaveGameEnvelope(vAdventure.adventure.id, engine.state.seed, {
      currentLocationId: engine.state.currentLocationId,
      playerGridPos: { x: curLoc.geometry.x, y: curLoc.geometry.y },
      inventory: Array.from(engine.state.inventory),
      flags: Array.from(engine.state.flags.entries()),
      playerHp: engine.state.playerHp,
      playerMaxHp: engine.state.playerMaxHp,
      playerAc: engine.state.playerAc,
      discoveredSecrets: Array.from(engine.state.discoveredSecrets),
      unlockedExits: Array.from(engine.state.unlockedExits),
      discoveredRooms: Array.from(engine.state.discoveredRooms),
      actionLogHistory: engine.state.actionLog,
      inCombat: engine.state.inCombat,
    });

    const jsonStr = JSON.stringify(env, null, 2);
    setSaveEnvelopeJson(jsonStr);
    localStorage.setItem(`grimoire3d_save_${vAdventure.adventure.id}`, jsonStr);
    setShowSaveModal(true);
  };

  const handleLoadGame = () => {
    const saved = localStorage.getItem(`grimoire3d_save_${vAdventure.adventure.id}`);
    if (saved) {
      try {
        const parsed: SaveGameEnvelope = JSON.parse(saved);
        const newEng = new SimulatorEngine(vAdventure, parsed.seed);
        newEng.state.currentLocationId = parsed.sessionState.currentLocationId;
        newEng.state.inventory = new Set(parsed.sessionState.inventory);
        newEng.state.flags = new Map(parsed.sessionState.flags);
        newEng.state.playerHp = parsed.sessionState.playerHp;
        newEng.state.discoveredSecrets = new Set(parsed.sessionState.discoveredSecrets);
        newEng.state.unlockedExits = new Set(parsed.sessionState.unlockedExits);
        newEng.state.discoveredRooms = new Set(parsed.sessionState.discoveredRooms);
        newEng.state.actionLog = parsed.sessionState.actionLogHistory;
        setEngine(newEng);
        if (onLocationChanged) onLocationChanged(newEng.state.currentLocationId);
      } catch (e) {
        alert("Failed to restore save game.");
      }
    } else {
      alert("No save game found in local storage.");
    }
  };

  // Keyboard Navigation Hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreKeyboardGameInput(document.activeElement, showSaveModal)) {
        return; // Ignore WASD navigation while editing text or when modal is open
      }

      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
        handleAction({ kind: "move", direction: "north" });
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
        handleAction({ kind: "move", direction: "south" });
      } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        handleAction({ kind: "move", direction: "east" });
      } else if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        handleAction({ kind: "move", direction: "west" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [engine]);

  return (
    <div className="w-full h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      {/* Top Header */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Compass className="w-5 h-5 text-emerald-400" />
          <h3 className="font-semibold text-slate-100 text-sm tracking-wide">2D Playable Dungeon Exploration</h3>
          <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded border border-slate-700 font-mono">
            {curLoc.label}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-950/60 border border-red-800 rounded text-red-300 text-xs font-bold font-mono">
            <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" /> {engine.state.playerHp} / {engine.state.playerMaxHp} HP
          </div>

          <button
            onClick={handleSaveGame}
            className="px-2.5 py-1 text-xs bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded flex items-center gap-1 font-medium transition-colors"
          >
            <Save className="w-3.5 h-3.5" /> Save Game
          </button>
          <button
            onClick={handleLoadGame}
            className="px-2.5 py-1 text-xs bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800 rounded flex items-center gap-1 font-medium transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Load Game
          </button>
          <button
            onClick={handleReset}
            className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>

      {/* Main Grid Viewport & Exploration HUD */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Left Side: 2D Grid Canvas & Movement */}
        <div className="col-span-8 flex flex-col gap-4 overflow-hidden relative">
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg relative overflow-auto flex items-center justify-center p-6 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
            <svg className="w-[750px] h-[550px] bg-slate-950/90 rounded-lg border border-slate-800">
              {worldLayout.rooms.map((room) => {
                const isDiscovered = engine.state.discoveredRooms.has(room.id);
                const isCurrent = room.id === engine.state.currentLocationId;
                const g = room.bounds;

                const x = g.x * 20 + 20;
                const y = g.y * 20 + 20;
                const width = g.width * 20;
                const height = g.height * 20;

                if (!isDiscovered) {
                  return (
                    <rect
                      key={`fog-${room.id}`}
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill="#020617"
                      stroke="#0f172a"
                      strokeDasharray="2 2"
                      rx="3"
                    />
                  );
                }

                return (
                  <g key={`room-${room.id}`} transform={`translate(${x}, ${y})`}>
                    <rect
                      width={width}
                      height={height}
                      fill={isCurrent ? "#064e3b" : "#0f172a"}
                      stroke={isCurrent ? "#34d399" : "#334155"}
                      strokeWidth={isCurrent ? "2.5" : "1.5"}
                      rx="4"
                    />
                    <text
                      x={width / 2}
                      y={height / 2}
                      fill={isCurrent ? "#34d399" : "#94a3b8"}
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {room.label.split(".")[0] || room.id}
                    </text>

                    {/* Player Position Token */}
                    {isCurrent && (
                      <g transform={`translate(${width / 2}, ${height / 2 + 12})`}>
                        <circle r="7" fill="#10b981" className="animate-ping opacity-75" />
                        <circle r="6" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* D-Pad Controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Use WASD / Arrow Keys or D-Pad to Navigate Grid</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleAction({ kind: "move", direction: "west" })}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => handleAction({ kind: "move", direction: "north" })}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleAction({ kind: "move", direction: "south" })}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => handleAction({ kind: "move", direction: "east" })}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Narrative, Context Actions, Journal */}
        <div className="col-span-4 flex flex-col gap-4 overflow-hidden">
          {/* Victory / Defeat Modal */}
          {engine.state.gameEnded && (
            <div className={`p-4 rounded-lg border text-xs shadow-xl ${
              engine.state.gameOutcome === "victory"
                ? "bg-emerald-950 border-emerald-700 text-emerald-200"
                : "bg-red-950 border-red-700 text-red-200"
            }`}>
              <div className="font-extrabold text-sm flex items-center gap-2 mb-1">
                {engine.state.gameOutcome === "victory" ? (
                  <>
                    <Trophy className="w-5 h-5 text-amber-400" /> Quest Completed! Escaped Crypt!
                  </>
                ) : (
                  <>
                    <Skull className="w-5 h-5 text-red-400" /> Defeated in Dungeon!
                  </>
                )}
              </div>
              <p className="text-[11px] text-slate-300">
                {engine.state.gameOutcome === "victory"
                  ? "Congratulations! You navigated through the Serpent Altar Crypt and reached daylight."
                  : "You fell in battle. Reset or reload save game to try again."}
              </p>
            </div>
          )}

          {/* Current Room Description */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 space-y-2">
            <h4 className="font-bold text-emerald-400 text-sm">{curLoc.label}</h4>
            <p className="text-xs text-slate-200 leading-relaxed bg-slate-950/60 p-3 rounded border border-slate-800">
              {curLoc.narrative.playerFacingDescription}
            </p>
          </div>

          {/* Contextual Action Buttons */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2">
            <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Room Interactions</h5>
            <div className="space-y-1.5">
              {curLoc.interactables.map((inter) => (
                <button
                  key={inter.id}
                  onClick={() => handleAction({ kind: "inspect", targetId: inter.id })}
                  className="w-full p-2 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800 text-amber-300 rounded text-left text-xs font-medium flex items-center gap-2 transition-all"
                >
                  <Box className="w-3.5 h-3.5 text-amber-400" /> Inspect {inter.label}
                </button>
              ))}

              {curLoc.secrets.map((sec) => {
                const found = engine.state.discoveredSecrets.has(sec.id);
                if (found) return null;
                return (
                  <button
                    key={sec.id}
                    onClick={() => handleAction({ kind: "search", targetId: sec.id })}
                    className="w-full p-2 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800 text-purple-300 rounded text-left text-xs font-medium flex items-center gap-2 transition-all"
                  >
                    <Eye className="w-3.5 h-3.5 text-purple-400" /> Search Secret (DC {sec.perceptionDC})
                  </button>
                );
              })}

              {curLoc.encounter && !engine.state.flags.get("altar-viper-defeated") && (
                <button
                  onClick={() => handleAction({ type: "RESOLVE_COMBAT", encounterId: curLoc.encounter!.id })}
                  className="w-full p-2.5 bg-red-950 hover:bg-red-900 border border-red-700 text-red-200 font-bold rounded text-xs flex items-center justify-center gap-2 transition-all animate-pulse"
                >
                  <Sword className="w-4 h-4 text-red-400" /> Fight Monster Encounter!
                </button>
              )}

              <button
                onClick={() => handleAction({ kind: "rest" })}
                className="w-full p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-left text-xs font-medium flex items-center gap-2 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Rest & Recover HP
              </button>
            </div>
          </div>

          {/* Auto-Play Control Panel */}
          <AutoPlayControlPanel
            engine={engine}
            onStateUpdated={() => {
              const updated = Object.assign(Object.create(Object.getPrototypeOf(engine)), engine);
              setEngine(updated);
              if (onLocationChanged) onLocationChanged(updated.state.currentLocationId);
            }}
          />

          {/* Quest Journal & Inventory */}
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col space-y-2 overflow-hidden">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" /> Quest Journal & Inventory
              </h5>
            </div>

            <div className="flex-1 overflow-auto space-y-2 pr-1">
              <div className="p-2 bg-indigo-950/30 border border-indigo-800/60 rounded text-xs">
                <div className="font-semibold text-indigo-300">Escape the Serpent Crypt</div>
                <p className="text-[11px] text-slate-400">Reach the escape tunnel to win.</p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] text-slate-400 font-medium">Inventory Items ({engine.state.inventory.size}):</span>
                <div className="flex flex-wrap gap-1">
                  {Array.from(engine.state.inventory).map((item) => (
                    <span key={item} className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 text-[11px] rounded">
                      📦 {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Event Log:</span>
                <div className="space-y-1 font-mono text-[10px] text-slate-300">
                  {engine.state.actionLog.slice(-5).map((log, idx) => (
                    <div key={`log-${idx}`} className="p-1 bg-slate-950 rounded border border-slate-800">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
