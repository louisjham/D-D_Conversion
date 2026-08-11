import React from "react";
import { Location, VersionedAdventure } from "@grimoire3d/ir";
import { ValidationIssue } from "@grimoire3d/validator";
import { Compass, ShieldAlert, Key, Eye, Play } from "lucide-react";

interface AdventureGraphViewProps {
  vAdventure: VersionedAdventure;
  selectedLocationId: string;
  onSelectLocation: (id: string) => void;
  issues: ValidationIssue[];
}

export const AdventureGraphView: React.FC<AdventureGraphViewProps> = ({
  vAdventure,
  selectedLocationId,
  onSelectLocation,
  issues,
}) => {
  const locations = vAdventure.adventure.locations;
  const startId = vAdventure.adventure.start;

  // Auto-layout node positions in SVG canvas
  const nodeMap = new Map<string, { x: number; y: number; loc: Location }>();
  locations.forEach((loc, index) => {
    // Use geometry coordinates or calculate radial grid layout
    const x = (loc.geometry.x || (index % 4) * 5) * 28 + 60;
    const y = (loc.geometry.y || Math.floor(index / 4) * 5) * 24 + 60;
    nodeMap.set(loc.id, { x, y, loc });
  });

  return (
    <div className="relative w-full h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-emerald-400" />
          <h3 className="font-semibold text-slate-100 text-sm tracking-wide">Adventure Graph Topology</h3>
        </div>
        <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full border border-slate-700">
          {locations.length} Locations • {vAdventure.adventure.systemProfile}
        </span>
      </div>

      <div className="flex-1 relative overflow-auto p-4 flex justify-center items-center">
        <svg className="w-[1000px] h-[700px] bg-slate-950/80 rounded-lg">
          <defs>
            <marker id="arrow-normal" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
            </marker>
            <marker id="arrow-locked" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
            </marker>
            <marker id="arrow-secret" viewBox="0 0 10 10" refX="24" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#a855f7" />
            </marker>
          </defs>

          {/* Render Exits (Edges) */}
          {locations.flatMap((loc) => {
            const sourcePos = nodeMap.get(loc.id);
            if (!sourcePos) return [];

            return loc.exits.map((exit) => {
              const targetPos = nodeMap.get(exit.target);
              if (!targetPos) return null;

              const isLocked = !!exit.locked;
              const isSecret = !!exit.visibleWhen;

              let stroke = "#64748b";
              let marker = "url(#arrow-normal)";
              let strokeDash = undefined;

              if (isLocked) {
                stroke = "#ef4444";
                marker = "url(#arrow-locked)";
              } else if (isSecret) {
                stroke = "#a855f7";
                strokeDash = "4 4";
                marker = "url(#arrow-secret)";
              }

              return (
                <g key={`edge-${exit.id}`}>
                  <line
                    x1={sourcePos.x}
                    y1={sourcePos.y}
                    x2={targetPos.x}
                    y2={targetPos.y}
                    stroke={stroke}
                    strokeWidth={isLocked || isSecret ? "2.5" : "1.8"}
                    strokeDasharray={strokeDash}
                    markerEnd={marker}
                    className="transition-all duration-300 opacity-75 hover:opacity-100"
                  />
                  <text
                    x={(sourcePos.x + targetPos.x) / 2}
                    y={(sourcePos.y + targetPos.y) / 2 - 4}
                    fill={stroke}
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                    className="select-none bg-slate-900 px-1"
                  >
                    {exit.direction.toUpperCase()} {isLocked ? "🔒" : isSecret ? "👁️" : ""}
                  </text>
                </g>
              );
            });
          })}

          {/* Render Location Nodes */}
          {Array.from(nodeMap.entries()).map(([id, { x, y, loc }]) => {
            const isSelected = id === selectedLocationId;
            const isStart = id === startId;
            const locIssues = issues.filter((i) => i.entityId === id);
            const hasError = locIssues.some((i) => i.severity === "error");
            const hasWarning = locIssues.some((i) => i.severity === "warning");

            let nodeBorder = "stroke-slate-700";
            let nodeFill = "#0f172a";

            if (isSelected) {
              nodeBorder = "stroke-emerald-400 stroke-[3px]";
              nodeFill = "#1e293b";
            } else if (hasError) {
              nodeBorder = "stroke-red-500 stroke-2";
              nodeFill = "#2a1215";
            } else if (isStart) {
              nodeBorder = "stroke-amber-400 stroke-2";
              nodeFill = "#1c1917";
            }

            return (
              <g
                key={`node-${id}`}
                transform={`translate(${x}, ${y})`}
                onClick={() => onSelectLocation(id)}
                className="cursor-pointer group"
              >
                <circle
                  r="24"
                  fill={nodeFill}
                  className={`transition-all duration-200 ${nodeBorder} group-hover:scale-110`}
                />
                {isStart && (
                  <circle r="27" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 3" />
                )}

                <text
                  y="4"
                  fill={isSelected ? "#34d399" : "#f1f5f9"}
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                  className="select-none pointer-events-none"
                >
                  {loc.label.split(".")[0] || loc.id.slice(0, 3)}
                </text>

                <text
                  y="38"
                  fill="#94a3b8"
                  fontSize="11"
                  fontWeight="500"
                  textAnchor="middle"
                  className="select-none pointer-events-none font-sans"
                >
                  {loc.label}
                </text>

                {/* Status Icons */}
                {hasError && (
                  <circle cx="16" cy="-16" r="6" fill="#ef4444" className="animate-pulse" />
                )}
                {hasWarning && !hasError && (
                  <circle cx="16" cy="-16" r="6" fill="#f59e0b" />
                )}
                {isStart && (
                  <rect x="-18" y="-30" width="36" height="12" rx="3" fill="#f59e0b" />
                )}
                {isStart && (
                  <text y="-21" fill="#000" fontSize="8" fontWeight="extrabold" textAnchor="middle">
                    START
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
