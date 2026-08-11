import React, { useState } from "react";
import { EventGraph, EventGraphCompiler, CompiledEventScript } from "@grimoire3d/visual-logic";
import { Zap, CheckCircle2, AlertTriangle, Layers, Plus } from "lucide-react";

export const VisualLogicEditorView: React.FC = () => {
  const [graph, setGraph] = useState<EventGraph>({
    id: "graph-chest-lock",
    name: "Chest Unlock Sequence",
    description: "Grants key when inspecting chest with disarmed trap flag",
    nodes: [
      {
        id: "node-trigger-1",
        type: "trigger",
        kind: "onInteract",
        title: "On Inspect Wooden Chest",
        position: { x: 40, y: 50 },
        data: { targetId: "wooden-chest" },
      },
      {
        id: "node-cond-1",
        type: "condition",
        kind: "checkFlag",
        title: "Check Trap Disarmed",
        position: { x: 300, y: 50 },
        data: { flag: "trap-disarmed", equals: true },
      },
      {
        id: "node-action-1",
        type: "action",
        kind: "grantItem",
        title: "Grant Sun Key",
        position: { x: 560, y: 50 },
        data: { itemId: "sun-key" },
      },
    ],
    edges: [
      { id: "edge-1", fromNodeId: "node-trigger-1", fromPort: "out", toNodeId: "node-cond-1", toPort: "in" },
      { id: "edge-2", fromNodeId: "node-cond-1", fromPort: "out", toNodeId: "node-action-1", toPort: "in" },
    ],
  });

  const [compiledScripts, setCompiledScripts] = useState<CompiledEventScript[]>(() =>
    EventGraphCompiler.compile(graph)
  );

  const handleCompile = () => {
    const res = EventGraphCompiler.compile(graph);
    setCompiledScripts(res);
  };

  return (
    <div className="w-full h-full bg-slate-950 text-slate-100 p-6 flex flex-col gap-6 overflow-y-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-950 border border-emerald-800 flex items-center justify-center">
            <Zap className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Visual Event Logic Node Graph (@grimoire3d/visual-logic)
            </h2>
            <p className="text-xs text-slate-400">BTCS & FRUA Chained Event Triggers, Conditions & Action Effects</p>
          </div>
        </div>

        <button
          onClick={handleCompile}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs shadow-lg shadow-emerald-950 flex items-center gap-1.5 transition-all"
        >
          <Zap className="w-4 h-4" /> Compile Graph
        </button>
      </div>

      {/* Main Canvas & Compiled Output */}
      <div className="grid grid-cols-12 gap-6 flex-1 min-h-[450px]">
        {/* Left: Node Canvas */}
        <div className="col-span-8 bg-slate-900/60 border border-slate-800 rounded-xl p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-semibold text-slate-400">Node Logic Canvas ({graph.nodes.length} Nodes, {graph.edges.length} Edges)</span>
            <span className="text-[11px] text-emerald-400 font-mono">Graph ID: {graph.id}</span>
          </div>

          {/* Render Nodes */}
          <div className="grid grid-cols-3 gap-4 my-auto">
            {graph.nodes.map((node) => (
              <div
                key={node.id}
                className={`p-4 rounded-xl border shadow-lg flex flex-col gap-2 ${
                  node.type === "trigger"
                    ? "bg-indigo-950/60 border-indigo-700 text-indigo-200"
                    : node.type === "condition"
                    ? "bg-amber-950/60 border-amber-700 text-amber-200"
                    : "bg-emerald-950/60 border-emerald-700 text-emerald-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-mono tracking-wider opacity-75">{node.type}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900/80">{node.kind}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-100">{node.title}</h4>
                <div className="text-[11px] font-mono bg-slate-950/80 p-2 rounded border border-slate-800/80 truncate">
                  {JSON.stringify(node.data)}
                </div>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-slate-500 italic mt-4 text-center">
            Click 'Compile Graph' to validate and produce IR-ready Condition and Effect arrays.
          </div>
        </div>

        {/* Right: Compiled Inspection Panel */}
        <div className="col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
          <h3 className="text-xs font-bold text-slate-100 flex items-center gap-2">
            Compiled IR Event Script Output
          </h3>

          {compiledScripts.map((script, idx) => (
            <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-3 font-mono text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status:</span>
                {script.valid ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Valid IR Script
                  </span>
                ) : (
                  <span className="text-red-400 flex items-center gap-1 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5" /> {script.errors.length} Errors
                  </span>
                )}
              </div>

              <div>
                <span className="text-slate-500 block text-[10px]">Compiled Conditions:</span>
                <pre className="text-amber-300 text-[10px] bg-slate-900 p-2 rounded mt-1 overflow-x-auto">
                  {JSON.stringify(script.conditions, null, 2)}
                </pre>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px]">Compiled Action Effects:</span>
                <pre className="text-emerald-300 text-[10px] bg-slate-900 p-2 rounded mt-1 overflow-x-auto">
                  {JSON.stringify(script.effects, null, 2)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
