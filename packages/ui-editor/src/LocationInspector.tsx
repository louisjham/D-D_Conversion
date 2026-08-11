import React, { useState } from "react";
import { Location, VersionedAdventure } from "@grimoire3d/ir";
import { MapPin, Key, Eye, ShieldAlert, Sparkles, Code2, Edit3 } from "lucide-react";

interface LocationInspectorProps {
  vAdventure: VersionedAdventure;
  locationId: string;
  onUpdateLocation: (updatedLoc: Location) => void;
}

export const LocationInspector: React.FC<LocationInspectorProps> = ({
  vAdventure,
  locationId,
  onUpdateLocation,
}) => {
  const [showJsonRaw, setShowJsonRaw] = useState(false);
  const location = vAdventure.adventure.locations.find((l) => l.id === locationId);

  if (!location) {
    return (
      <div className="w-full h-full bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-400 flex items-center justify-center">
        Select a room node in the graph to inspect properties.
      </div>
    );
  }

  const handleDescriptionChange = (newDesc: string) => {
    const updated = {
      ...location,
      narrative: {
        ...location.narrative,
        playerFacingDescription: newDesc,
      },
    };
    onUpdateLocation(updated);
  };

  const handleRawJsonSave = (rawJsonStr: string) => {
    try {
      const parsed = JSON.parse(rawJsonStr);
      onUpdateLocation(parsed);
    } catch (e) {
      alert("Invalid JSON format");
    }
  };

  return (
    <div className="w-full h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      {/* Panel Header */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-emerald-400" />
          <h3 className="font-semibold text-slate-100 text-sm tracking-wide">{location.label}</h3>
        </div>
        <button
          onClick={() => setShowJsonRaw(!showJsonRaw)}
          className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center gap-1.5 transition-colors"
        >
          <Code2 className="w-3.5 h-3.5" />
          {showJsonRaw ? "Form View" : "Raw JSON"}
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-5 text-sm text-slate-200">
        {showJsonRaw ? (
          <div className="h-full flex flex-col">
            <textarea
              defaultValue={JSON.stringify(location, null, 2)}
              onBlur={(e) => handleRawJsonSave(e.target.value)}
              className="w-full flex-1 bg-slate-900 border border-slate-800 rounded p-3 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500"
            />
            <span className="text-[11px] text-slate-400 mt-2">Edit JSON directly and blur textarea to apply.</span>
          </div>
        ) : (
          <>
            {/* Presentation Badges */}
            <div className="flex flex-wrap gap-2">
              <span className="px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs font-medium">
                Biome: {location.presentation.biome}
              </span>
              <span className="px-2.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 text-xs font-medium">
                Lighting: {location.presentation.lighting}
              </span>
              {location.presentation.ambienceTags.map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs">
                  #{tag}
                </span>
              ))}
            </div>

            {/* Narrative Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Edit3 className="w-3.5 h-3.5 text-slate-400" /> Player-Facing Description
              </label>
              <textarea
                value={location.narrative.playerFacingDescription}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                className="w-full h-24 bg-slate-900 border border-slate-800 rounded p-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Exits List */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Exits ({location.exits.length})</h4>
              <div className="space-y-1.5">
                {location.exits.map((exit) => (
                  <div key={exit.id} className="p-2.5 bg-slate-900 border border-slate-800 rounded flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-emerald-400 uppercase mr-2">{exit.direction}:</span>
                      <span className="text-slate-300">to location <code className="text-amber-300">{exit.target}</code></span>
                    </div>
                    {exit.locked && (
                      <span className="px-2 py-0.5 bg-red-950 text-red-400 border border-red-800 text-[11px] rounded flex items-center gap-1">
                        <Key className="w-3 h-3" /> Locked ({exit.locked.keyItemId || "pickable"})
                      </span>
                    )}
                    {exit.visibleWhen && (
                      <span className="px-2 py-0.5 bg-purple-950 text-purple-400 border border-purple-800 text-[11px] rounded flex items-center gap-1">
                        <Eye className="w-3 h-3" /> Secret
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Secrets & Traps */}
            {location.secrets.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Secrets ({location.secrets.length})</h4>
                {location.secrets.map((sec) => (
                  <div key={sec.id} className="p-2.5 bg-purple-950/40 border border-purple-800/60 rounded flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-purple-300">{sec.label}</span>
                      <p className="text-xs text-slate-400">Perception DC {sec.perceptionDC}</p>
                    </div>
                    <span className="text-xs font-mono text-purple-400">Reveals {sec.revealsExitId || "Item"}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Interactables & Loot */}
            {location.interactables.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Interactables & Loot</h4>
                {location.interactables.map((inter) => (
                  <div key={inter.id} className="p-2.5 bg-slate-900 border border-slate-800 rounded">
                    <div className="font-medium text-amber-300">{inter.label}</div>
                    <p className="text-xs text-slate-400 mt-0.5">{inter.description}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Monsters Encounter */}
            {location.encounter && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" /> Encounter
                </h4>
                <div className="p-2.5 bg-red-950/30 border border-red-800/60 rounded">
                  <div className="font-semibold text-red-300">
                    {location.encounter.enemies.map((e) => `${e.count}x ${e.monsterTemplateId}`).join(", ")}
                  </div>
                  {location.encounter.tactics && (
                    <p className="text-xs text-slate-400 mt-1">{location.encounter.tactics}</p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
