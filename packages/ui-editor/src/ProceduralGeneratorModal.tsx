import React, { useState } from "react";
import { VersionedAdventure } from "@grimoire3d/ir";
import { ProceduralGenerator, DungeonTheme } from "@grimoire3d/procedural-generator";
import { Sparkles, Dices, Layers, ShieldCheck, X } from "lucide-react";

export interface ProceduralGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdventureGenerated: (vAdv: VersionedAdventure) => void;
}

export const ProceduralGeneratorModal: React.FC<ProceduralGeneratorModalProps> = ({
  isOpen,
  onClose,
  onAdventureGenerated,
}) => {
  const [title, setTitle] = useState("The Caverns of Chaos");
  const [seed, setSeed] = useState(42);
  const [theme, setTheme] = useState<DungeonTheme>("cavern-complex");
  const [roomCount, setRoomCount] = useState(12);
  const [partyLevel, setPartyLevel] = useState(3);
  const [includeBossRoom, setIncludeBossRoom] = useState(true);
  const [includeKeyLockPuzzle, setIncludeKeyLockPuzzle] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        const vAdv = ProceduralGenerator.generateAdventure({
          seed,
          title,
          theme,
          roomCount,
          targetPartyLevel: partyLevel,
          includeBossRoom,
          includeKeyLockPuzzle,
        });
        onAdventureGenerated(vAdv);
        onClose();
      } catch (err: any) {
        alert(`Generation Error: ${err.message}`);
      } finally {
        setIsGenerating(false);
      }
    }, 100);
  };

  const handleRandomizeSeed = () => {
    setSeed(Math.floor(Math.random() * 90000) + 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-950 border border-emerald-800 flex items-center justify-center">
              <Dices className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Procedural Dungeon Generator
              </h2>
              <p className="text-[11px] text-slate-400">
                1-Click Algorithmic Dungeon, Encounter & Key-Lock Generator
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 text-xs text-slate-300 overflow-y-auto max-h-[75vh]">
          {/* Dungeon Title */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Dungeon Module Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Seed Randomizer */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Random Seed</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(Number(e.target.value))}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-slate-100 text-xs font-mono focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={handleRandomizeSeed}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <Dices className="w-3.5 h-3.5 text-amber-400" /> Randomize
              </button>
            </div>
          </div>

          {/* Theme Biome */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Dungeon Theme & Biome</label>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as DungeonTheme)}
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-slate-100 text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="cavern-complex">Cavern Complex (Cave & Tunnels)</option>
              <option value="classic-dungeon">Classic Dungeon (Stone Flagstones)</option>
              <option value="ancient-crypt">Ancient Crypt (Tombs & Sarcophagi)</option>
              <option value="keep-fortress">Keep Fortress (Masonry & Armory)</option>
            </select>
          </div>

          {/* Sliders: Room Count & Party Level */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between text-[11px] font-semibold text-slate-400 mb-1">
                <span>Room Count</span>
                <span className="text-emerald-400 font-mono">{roomCount} Chambers</span>
              </div>
              <input
                type="range"
                min={4}
                max={25}
                value={roomCount}
                onChange={(e) => setRoomCount(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-semibold text-slate-400 mb-1">
                <span>Party Level</span>
                <span className="text-amber-400 font-mono">Level {partyLevel}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={partyLevel}
                onChange={(e) => setPartyLevel(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={includeBossRoom}
                onChange={(e) => setIncludeBossRoom(e.target.checked)}
                className="rounded accent-emerald-500"
              />
              <span>Generate Overlord Boss Room & Escape Tunnel</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={includeKeyLockPuzzle}
                onChange={(e) => setIncludeKeyLockPuzzle(e.target.checked)}
                className="rounded accent-emerald-500"
              />
              <span>Generate Key-Lock Puzzle & Hidden Chest</span>
            </label>
          </div>

          {/* Validation Guarantee Badge */}
          <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-lg flex items-center gap-2 text-[11px] text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Guaranteed 100% Solvable & Schema Validated via @grimoire3d/validator</span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-xs font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-4 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold rounded-md text-xs shadow-lg shadow-emerald-950 flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-4 h-4" />
            {isGenerating ? "Generating..." : "✨ Generate & Load Dungeon"}
          </button>
        </div>
      </div>
    </div>
  );
};
