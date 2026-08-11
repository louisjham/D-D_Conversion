import React from "react";
import { VersionedAdventure, Location } from "@grimoire3d/ir";
import { LayoutGrid, DoorClosed, Lock, Eye, Sparkles } from "lucide-react";

interface GridMapViewProps {
  vAdventure: VersionedAdventure;
  selectedLocationId: string;
  onSelectLocation: (id: string) => void;
  activePlaytestLocationId?: string;
}

export const GridMapView: React.FC<GridMapViewProps> = ({
  vAdventure,
  selectedLocationId,
  onSelectLocation,
  activePlaytestLocationId,
}) => {
  const locations = vAdventure.adventure.locations;
  const gridSize = 24;

  return (
    <div className="w-full h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-5 h-5 text-sky-400" />
          <h3 className="font-semibold text-slate-100 text-sm tracking-wide">2D Grid Tile Layout</h3>
        </div>
        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded border border-slate-700">
          Scale: 1 cell = 5ft
        </span>
      </div>

      <div className="flex-1 relative overflow-auto p-6 flex justify-center items-center bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
        <svg className="w-[850px] h-[650px] bg-slate-900/90 rounded-lg border border-slate-800 shadow-inner">
          {/* Render Room Boundaries */}
          {locations.map((loc) => {
            const isSelected = loc.id === selectedLocationId;
            const isActivePlayer = loc.id === activePlaytestLocationId;
            const isStart = loc.id === vAdventure.adventure.start;

            const x = loc.geometry.x * gridSize + 30;
            const y = loc.geometry.y * gridSize + 30;
            const width = loc.geometry.width * gridSize;
            const height = loc.geometry.height * gridSize;

            let stroke = "#334155";
            let fill = "#0f172a";

            if (isSelected) {
              stroke = "#38bdf8";
              fill = "#0369a122";
            } else if (isActivePlayer) {
              stroke = "#34d399";
              fill = "#05966922";
            } else if (isStart) {
              stroke = "#f59e0b";
              fill = "#b4530922";
            }

            return (
              <g
                key={`grid-room-${loc.id}`}
                transform={`translate(${x}, ${y})`}
                onClick={() => onSelectLocation(loc.id)}
                className="cursor-pointer group"
              >
                <rect
                  width={width}
                  height={height}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSelected || isActivePlayer ? "2.5" : "1.5"}
                  rx="4"
                  className="transition-all duration-200 group-hover:stroke-sky-400"
                />

                <text
                  x={width / 2}
                  y={height / 2}
                  fill={isSelected ? "#38bdf8" : "#94a3b8"}
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                  className="select-none pointer-events-none"
                >
                  {loc.label}
                </text>

                {/* Player Token */}
                {isActivePlayer && (
                  <g transform={`translate(${width / 2}, ${height / 2 + 14})`}>
                    <circle r="8" fill="#10b981" className="animate-ping opacity-75" />
                    <circle r="7" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
                    <text y="3.5" fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle">
                      P
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
