import React from "react";
import { VersionedAdventure } from "@grimoire3d/ir";
import { LayoutGrid, Lock, Eye, Box, Sparkles, Flame, DoorClosed } from "lucide-react";
import { DungeonTileSvgPatterns, get2dAssetSpec } from "./AssetLibrary";

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
          <h3 className="font-semibold text-slate-100 text-sm tracking-wide">2D Grid & Asset Layout</h3>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Start</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-sky-400" /> Selected</span>
          <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700 font-mono">1 cell = 5ft</span>
        </div>
      </div>

      <div className="flex-1 relative overflow-auto p-6 flex justify-center items-center bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
        <svg className="w-full h-full bg-slate-900/90 rounded-lg border border-slate-800 shadow-inner" viewBox="0 0 850 650">
          <DungeonTileSvgPatterns />

          {/* Render Room Boundaries with Textured Patterns & Recognizable 2D Assets */}
          {locations.map((loc) => {
            const isSelected = loc.id === selectedLocationId;
            const isActivePlayer = loc.id === activePlaytestLocationId;
            const isStart = loc.id === vAdventure.adventure.start;

            const x = loc.geometry.x * gridSize + 30;
            const y = loc.geometry.y * gridSize + 30;
            const width = loc.geometry.width * gridSize;
            const height = loc.geometry.height * gridSize;

            const biome = loc.presentation?.biome || "crypt";
            const assetSpec = get2dAssetSpec(biome, "biome");

            let stroke = assetSpec.secondaryColor;
            let fill = `url(#${assetSpec.patternId || "pattern-crypt-tiles"})`;

            if (isSelected) stroke = "#38bdf8";
            else if (isActivePlayer) stroke = "#34d399";
            else if (isStart) stroke = "#f59e0b";

            return (
              <g
                key={`grid-room-${loc.id}`}
                transform={`translate(${x}, ${y})`}
                onClick={() => onSelectLocation(loc.id)}
                className="cursor-pointer group"
              >
                {/* Room Floor Texture */}
                <rect
                  width={width}
                  height={height}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSelected || isActivePlayer ? "2.5" : "1.5"}
                  rx="4"
                  className="transition-all duration-200 group-hover:stroke-sky-400"
                />

                {/* Room Label Header */}
                <rect
                  x="2"
                  y="2"
                  width={Math.max(60, width - 4)}
                  height="16"
                  fill="#020617"
                  fillOpacity="0.8"
                  rx="2"
                />
                <text
                  x={width / 2}
                  y="13"
                  fill={isSelected ? "#38bdf8" : "#e2e8f0"}
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                  className="select-none pointer-events-none"
                >
                  {loc.label}
                </text>

                {/* 2D Assets inside Room */}
                <g transform="translate(6, 22)">
                  {loc.interactables.map((inter, idx) => {
                    const objSpec = get2dAssetSpec(inter.label || inter.id, "interactable");
                    return (
                      <circle
                        key={inter.id}
                        cx={idx * 14 + 6}
                        cy="6"
                        r="5"
                        fill={objSpec.primaryColor}
                        stroke="#ffffff"
                        strokeWidth="0.8"
                      />
                    );
                  })}
                </g>

                {/* Player Token */}
                {isActivePlayer && (
                  <g transform={`translate(${width / 2}, ${height / 2 + 10})`}>
                    <circle r="9" fill="#10b981" className="animate-ping opacity-75" />
                    <circle r="8" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
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
