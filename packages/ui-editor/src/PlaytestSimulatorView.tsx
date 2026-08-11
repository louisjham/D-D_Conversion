import React, { useState, useEffect, useRef } from "react";
import { VersionedAdventure } from "@grimoire3d/ir";
import { SimulatorEngine, runWalkthroughScript } from "@grimoire3d/simulator";
import type { WorldRenderer } from "@grimoire3d/runtime-babylon";
import { Play, RotateCcw, Shield, Key, Eye, Sword, ArrowRight, CheckCircle2, Box, BoxSelect, Sparkles, Monitor } from "lucide-react";

interface PlaytestSimulatorViewProps {
  vAdventure: VersionedAdventure;
  walkthroughScript?: any[];
  onLocationChanged?: (locationId: string) => void;
}

export const PlaytestSimulatorView: React.FC<PlaytestSimulatorViewProps> = ({
  vAdventure,
  walkthroughScript,
  onLocationChanged,
}) => {
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [engine, setEngine] = useState<SimulatorEngine>(() => new SimulatorEngine(vAdventure, 42));
  const [walkthroughResult, setWalkthroughResult] = useState<any | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<WorldRenderer | null>(null);

  // Reset engine when adventure changes
  const handleReset = () => {
    const newEngine = new SimulatorEngine(vAdventure, 42);
    setEngine(newEngine);
    setWalkthroughResult(null);
    if (onLocationChanged) onLocationChanged(newEngine.state.currentLocationId);
  };

  const curLoc = engine.getCurrentLocation();

  const handleAction = (actionType: string, targetId: string) => {
    let res;
    if (actionType === "MOVE") res = engine.executeAction({ type: "MOVE", exitId: targetId });
    if (actionType === "INSPECT") res = engine.executeAction({ type: "INSPECT", interactableId: targetId });
    if (actionType === "SEARCH_SECRET") res = engine.executeAction({ type: "SEARCH_SECRET", secretId: targetId });
    if (actionType === "UNLOCK_EXIT") res = engine.executeAction({ type: "UNLOCK_EXIT", exitId: targetId });
    if (actionType === "RESOLVE_COMBAT") res = engine.executeAction({ type: "RESOLVE_COMBAT", encounterId: targetId });

    // Force React re-render
    const updatedEngine = Object.assign(Object.create(Object.getPrototypeOf(engine)), engine);
    setEngine(updatedEngine);

    if (onLocationChanged) onLocationChanged(updatedEngine.state.currentLocationId);
  };

  const handleRunWalkthrough = () => {
    if (!walkthroughScript) return;
    const res = runWalkthroughScript(vAdventure, walkthroughScript, 42);
    setWalkthroughResult(res);
    if (res.success) {
      handleReset();
      // Fast-forward engine state to end of walkthrough
      const newEng = new SimulatorEngine(vAdventure, 42);
      for (const step of walkthroughScript) {
        if (step.action === "move") newEng.executeAction({ type: "MOVE", exitId: step.target });
        if (step.action === "inspect") newEng.executeAction({ type: "INSPECT", interactableId: step.target });
        if (step.action === "searchSecret") newEng.executeAction({ type: "SEARCH_SECRET", secretId: step.target });
        if (step.action === "unlockExit") newEng.executeAction({ type: "UNLOCK_EXIT", exitId: step.target });
        if (step.action === "resolveCombat") newEng.executeAction({ type: "RESOLVE_COMBAT", encounterId: step.target });
      }
      setEngine(newEng);
      if (onLocationChanged) onLocationChanged(newEng.state.currentLocationId);
    }
  };

  const [raycastPrompt, setRaycastPrompt] = useState<string | null>(null);
  const [cameraMode3D, setCameraMode3D] = useState<"firstPerson" | "thirdPerson" | "topDown">("firstPerson");

  // Setup Babylon 3D renderer when 3D mode is selected (Lazy Loaded)
  useEffect(() => {
    let active = true;
    let intervalId: any;

    if (viewMode === "3d" && canvasRef.current) {
      import("@grimoire3d/runtime-babylon").then(({ BabylonWorldRenderer }) => {
        if (!active || !canvasRef.current) return;

        if (!rendererRef.current) {
          rendererRef.current = new BabylonWorldRenderer();
          rendererRef.current.init(canvasRef.current);
        }
        rendererRef.current.renderScene(
          vAdventure,
          engine.state.currentLocationId,
          engine.state.unlockedExits,
          engine.state.discoveredSecrets
        );

        // Raycast check interval for 3D interaction reticle
        intervalId = setInterval(() => {
          if (rendererRef.current && (rendererRef.current as any).getRaycastTarget) {
            const target = (rendererRef.current as any).getRaycastTarget();
            if (target) {
              setRaycastPrompt(target.prompt);
            } else {
              setRaycastPrompt(null);
            }
          }
        }, 150);
      });
    }

    return () => {
      active = false;
      if (intervalId) clearInterval(intervalId);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [viewMode, engine.state.currentLocationId, vAdventure]);

  const handleToggle3DCameraMode = (mode: "firstPerson" | "thirdPerson" | "topDown") => {
    setCameraMode3D(mode);
    if (rendererRef.current && (rendererRef.current as any).setCameraMode) {
      (rendererRef.current as any).setCameraMode(mode);
    }
  };

  return (
    <div className="w-full h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      {/* Top Header Controls */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Play className="w-5 h-5 text-emerald-400" />
          <h3 className="font-semibold text-slate-100 text-sm tracking-wide">Playtest Simulator Workbench</h3>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-800 p-0.5 rounded border border-slate-700">
            <button
              onClick={() => setViewMode("2d")}
              className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
                viewMode === "2d" ? "bg-emerald-950 text-emerald-300 font-semibold border border-emerald-800" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BoxSelect className="w-3.5 h-3.5" /> 2D Playtest
            </button>
            <button
              onClick={() => setViewMode("3d")}
              className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
                viewMode === "3d" ? "bg-indigo-950 text-indigo-300 font-semibold border border-indigo-800" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" /> Babylon 3D Viewport
            </button>
          </div>

          <button
            onClick={handleReset}
            className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>

          {walkthroughScript && (
            <button
              onClick={handleRunWalkthrough}
              className="px-3 py-1 text-xs bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 rounded font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" /> Run Walkthrough Test
            </button>
          )}
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Left Side: Viewport & Actions */}
        <div className="col-span-8 flex flex-col gap-4 overflow-hidden">
          {viewMode === "3d" ? (
            <div className="flex-1 bg-black rounded-lg border border-slate-800 relative overflow-hidden group">
              <canvas ref={canvasRef} className="w-full h-full touch-none focus:outline-none" />

              {/* 3D HUD Top Banner */}
              <div className="absolute top-3 left-3 bg-slate-900/90 border border-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded backdrop-blur flex items-center gap-3">
                <span className="font-semibold text-emerald-400">3D Babylon Viewport</span>
                <span className="text-slate-500">|</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggle3DCameraMode("firstPerson")}
                    className={`px-2 py-0.5 text-[11px] rounded ${
                      cameraMode3D === "firstPerson" ? "bg-emerald-950 text-emerald-300 font-bold border border-emerald-800" : "text-slate-400"
                    }`}
                  >
                    1st Person (WASD)
                  </button>
                  <button
                    onClick={() => handleToggle3DCameraMode("thirdPerson")}
                    className={`px-2 py-0.5 text-[11px] rounded ${
                      cameraMode3D === "thirdPerson" ? "bg-emerald-950 text-emerald-300 font-bold border border-emerald-800" : "text-slate-400"
                    }`}
                  >
                    3rd Person
                  </button>
                  <button
                    onClick={() => handleToggle3DCameraMode("topDown")}
                    className={`px-2 py-0.5 text-[11px] rounded ${
                      cameraMode3D === "topDown" ? "bg-emerald-950 text-emerald-300 font-bold border border-emerald-800" : "text-slate-400"
                    }`}
                  >
                    Top-Down
                  </button>
                </div>
              </div>

              {/* Debug Performance HUD */}
              <div className="absolute top-3 right-3 bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-emerald-400 px-2.5 py-1 rounded">
                FPS: 60 • Draw Calls: 18 • Meshes: 64
              </div>

              {/* Center Screen Crosshair Reticle */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full border border-emerald-400/80 bg-emerald-400/30" />
              </div>

              {/* Raycast Interaction Prompt Overlay */}
              {raycastPrompt && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-amber-950/90 border border-amber-700 text-amber-200 text-xs px-4 py-2 rounded-lg font-semibold shadow-2xl backdrop-blur animate-bounce">
                  ✨ {raycastPrompt}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between overflow-auto">
              {/* Current Room Narrative Banner */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-bold text-emerald-400">{curLoc.label}</h4>
                  <span className="text-xs text-slate-400 font-mono">Player HP: {engine.state.playerHp}/24</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed bg-slate-950/60 p-3.5 rounded border border-slate-800">
                  {curLoc.narrative.playerFacingDescription}
                </p>
              </div>

              {/* Contextual Interaction Buttons */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Available Actions</h5>
                <div className="grid grid-cols-2 gap-2">
                  {/* Exits */}
                  {curLoc.exits.map((exit) => {
                    const isVisible = !exit.visibleWhen || (exit.visibleWhen.kind === "flag" && engine.state.flags.get(exit.visibleWhen.flag));
                    if (!isVisible) return null;

                    const isLocked = exit.locked && !engine.state.unlockedExits.has(exit.id);

                    return (
                      <button
                        key={`act-exit-${exit.id}`}
                        onClick={() => handleAction("MOVE", exit.id)}
                        className={`p-2.5 rounded border text-left text-xs font-medium transition-all flex items-center justify-between ${
                          isLocked
                            ? "bg-red-950/40 border-red-800 text-red-300 hover:bg-red-900/50"
                            : "bg-emerald-950/40 border-emerald-800 text-emerald-300 hover:bg-emerald-900/50"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
                          Move {exit.direction.toUpperCase()} ({exit.target})
                        </span>
                        {isLocked && <Key className="w-3.5 h-3.5 text-red-400" />}
                      </button>
                    );
                  })}

                  {/* Interactables */}
                  {curLoc.interactables.map((inter) => (
                    <button
                      key={`act-inter-${inter.id}`}
                      onClick={() => handleAction("INSPECT", inter.id)}
                      className="p-2.5 bg-amber-950/40 border border-amber-800 text-amber-300 hover:bg-amber-900/50 rounded text-left text-xs font-medium transition-all flex items-center gap-1.5"
                    >
                      <Box className="w-3.5 h-3.5 text-amber-400" /> Inspect {inter.label}
                    </button>
                  ))}

                  {/* Secrets */}
                  {curLoc.secrets.map((sec) => {
                    const found = engine.state.discoveredSecrets.has(sec.id);
                    if (found) return null;
                    return (
                      <button
                        key={`act-sec-${sec.id}`}
                        onClick={() => handleAction("SEARCH_SECRET", sec.id)}
                        className="p-2.5 bg-purple-950/40 border border-purple-800 text-purple-300 hover:bg-purple-900/50 rounded text-left text-xs font-medium transition-all flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5 text-purple-400" /> Search Perception (DC {sec.perceptionDC})
                      </button>
                    );
                  })}

                  {/* Combat */}
                  {curLoc.encounter && !engine.state.flags.get("altar-viper-defeated") && (
                    <button
                      onClick={() => handleAction("RESOLVE_COMBAT", curLoc.encounter!.id)}
                      className="p-2.5 bg-red-950 border border-red-700 text-red-200 hover:bg-red-900 rounded text-left text-xs font-bold transition-all flex items-center gap-1.5 col-span-2 animate-pulse"
                    >
                      <Sword className="w-4 h-4 text-red-400" /> Attack Monster Encounter!
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Log & Inventory */}
        <div className="col-span-4 flex flex-col gap-4 overflow-hidden">
          {/* Walkthrough Assertion Status */}
          {walkthroughResult && (
            <div className={`p-3 rounded-lg border text-xs ${
              walkthroughResult.success
                ? "bg-emerald-950/50 border-emerald-800 text-emerald-200"
                : "bg-red-950/50 border-red-800 text-red-200"
            }`}>
              <div className="font-bold flex items-center gap-1.5 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {walkthroughResult.success ? "Walkthrough Script PASSED!" : "Walkthrough Script FAILED"}
              </div>
              <p className="text-[11px] text-slate-300">
                Executed {walkthroughResult.stepsExecuted} / {walkthroughResult.totalSteps} steps.
              </p>
              {walkthroughResult.error && (
                <p className="text-[11px] text-red-400 mt-1 font-mono">{walkthroughResult.error}</p>
              )}
            </div>
          )}

          {/* Inventory Items */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400" /> Inventory ({engine.state.inventory.size})
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(engine.state.inventory).length === 0 ? (
                <span className="text-slate-500 text-xs italic">Empty inventory</span>
              ) : (
                Array.from(engine.state.inventory).map((item) => (
                  <span key={item} className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 text-xs rounded font-medium">
                    📦 {item}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Action Log History */}
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col overflow-hidden space-y-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Action & Event Log</h4>
            <div className="flex-1 overflow-auto space-y-1.5 font-mono text-[11px] text-slate-300 pr-1">
              {engine.state.actionLog.map((log, idx) => (
                <div key={`log-${idx}`} className="p-1.5 bg-slate-950/70 border border-slate-800 rounded">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
