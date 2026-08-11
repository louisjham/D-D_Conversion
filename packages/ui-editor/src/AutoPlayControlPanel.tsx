import React, { useState, useEffect, useRef } from "react";
import { SimulatorEngine, AutoPlayAgent, AutoPlayStepResult } from "@grimoire3d/simulator";
import { Bot, Play, Pause, StepForward, RotateCcw, Activity } from "lucide-react";

export interface AutoPlayControlPanelProps {
  engine: SimulatorEngine;
  onStateUpdated: () => void;
}

export const AutoPlayControlPanel: React.FC<AutoPlayControlPanelProps> = ({ engine, onStateUpdated }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [stepLog, setStepLog] = useState<AutoPlayStepResult[]>([]);
  const agentRef = useRef<AutoPlayAgent | null>(null);

  useEffect(() => {
    agentRef.current = new AutoPlayAgent(engine, 200);
    setStepLog([]);
    setIsRunning(false);
  }, [engine]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRunning && agentRef.current) {
      interval = setInterval(() => {
        if (!agentRef.current || engine.state.gameEnded) {
          setIsRunning(false);
          return;
        }

        const res = agentRef.current.step();
        setStepLog((prev) => [...prev.slice(-15), res]);
        onStateUpdated();

        if (res.completed) {
          setIsRunning(false);
        }
      }, 400); // 400ms per turn step for clean live viewing
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, engine, onStateUpdated]);

  const handleStepOnce = () => {
    if (!agentRef.current) return;
    const res = agentRef.current.step();
    setStepLog((prev) => [...prev.slice(-15), res]);
    onStateUpdated();
  };

  const handleTogglePlay = () => {
    if (engine.state.gameEnded) return;
    setIsRunning(!isRunning);
  };

  const handleResetAgent = () => {
    setIsRunning(false);
    agentRef.current = new AutoPlayAgent(engine, 200);
    setStepLog([]);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col gap-3">
      {/* Panel Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-950 border border-indigo-800 flex items-center justify-center">
            <Bot className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
              Autonomous Auto-Play Agent
              {isRunning && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950 border border-emerald-800 px-1.5 py-0.2 rounded animate-pulse">
                  <Activity className="w-3 h-3" /> Running
                </span>
              )}
            </h3>
            <p className="text-[10px] text-slate-400">Heuristic Pathfinder & Tactical Combat AI</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleTogglePlay}
            disabled={engine.state.gameEnded}
            className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
              isRunning
                ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                : "bg-indigo-600 hover:bg-indigo-500 text-white"
            } disabled:opacity-50`}
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5" /> Pause
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" /> Run Auto-Play
              </>
            )}
          </button>

          <button
            onClick={handleStepOnce}
            disabled={isRunning || engine.state.gameEnded}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
            title="Execute 1 Auto-Play Action"
          >
            <StepForward className="w-3.5 h-3.5 text-sky-400" /> Step
          </button>

          <button
            onClick={handleResetAgent}
            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 rounded-md transition-colors"
            title="Reset Agent State"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Decision Log View */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 h-32 overflow-y-auto font-mono text-[11px] space-y-1">
        {stepLog.length === 0 ? (
          <div className="text-slate-500 italic text-[10px] h-full flex items-center justify-center">
            Click 'Run Auto-Play' or 'Step' to watch the AI agent play autonomously.
          </div>
        ) : (
          stepLog.map((log, idx) => (
            <div key={idx} className="flex items-start gap-2 text-slate-300">
              <span className="text-indigo-400 shrink-0">#{idx + 1}</span>
              <span className="text-amber-300 shrink-0 font-bold">
                [{("kind" in log.action ? log.action.kind : (log.action as any).type)}]
              </span>
              <span className="truncate">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
