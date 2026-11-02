import React, { useState } from "react";
import { CampaignSession, CampaignAction } from "@grimoire3d/campaign-simulator";
import { VersionedCampaign } from "@grimoire3d/campaign-ir";
import { EconomyEngine } from "@grimoire3d/economy-core";
import {
  Castle,
  Bed,
  ShoppingBag,
  MessageSquare,
  Compass,
  MapPin,
  Clock,
  Coins,
  Shield,
  BookOpen,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  FileSearch,
} from "lucide-react";

interface CampaignHubViewProps {
  vCampaign: VersionedCampaign;
  session: CampaignSession;
  onDispatchAction: (action: CampaignAction) => void;
  onEnterDungeonView: () => void;
}

export const CampaignHubView: React.FC<CampaignHubViewProps> = ({
  vCampaign,
  session,
  onDispatchAction,
  onEnterDungeonView,
}) => {
  const [activeTab, setActiveTab] = useState<"services" | "rumors" | "travel" | "factions" | "log">("services");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("wayfarer-inn");

  const region = vCampaign.campaign.regions.find((r) => r.id === session.state.currentRegionId) || vCampaign.campaign.regions[0];
  const isHub = session.state.currentRegionId === "greywatch-keep";

  return (
    <div className="w-full h-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      {/* Top Header */}
      <div className="px-6 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Castle className="w-5 h-5 text-amber-400" />
          <h3 className="font-extrabold text-slate-100 text-sm tracking-wide">Greywatch Campaign Studio</h3>
          <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded border border-slate-700 font-mono">
            Day {session.state.worldTime.day}, {session.state.worldTime.hour.toString().padStart(2, "0")}:00
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-950/60 border border-amber-800 rounded text-amber-300 text-xs font-extrabold font-mono">
            <Coins className="w-3.5 h-3.5 text-amber-400" /> {session.state.currency.gold} GP
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300 text-xs font-mono">
            📦 {session.state.inventory.length} Items
          </div>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 grid grid-cols-12 gap-4 p-4 overflow-hidden">
        {/* Left Side: Navigation Tabs & Main Display */}
        <div className="col-span-8 flex flex-col gap-4 overflow-hidden">
          {/* Sub Navigation */}
          <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800 gap-2">
            <button
              onClick={() => setActiveTab("services")}
              className={`px-3.5 py-1.5 text-xs rounded font-medium flex items-center gap-1.5 transition-all ${
                activeTab === "services" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Castle className="w-3.5 h-3.5" /> Hub Services
            </button>
            <button
              onClick={() => setActiveTab("rumors")}
              className={`px-3.5 py-1.5 text-xs rounded font-medium flex items-center gap-1.5 transition-all ${
                activeTab === "rumors" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" /> Rumor Journal
            </button>
            <button
              onClick={() => setActiveTab("travel")}
              className={`px-3.5 py-1.5 text-xs rounded font-medium flex items-center gap-1.5 transition-all ${
                activeTab === "travel" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Compass className="w-3.5 h-3.5" /> Travel & Route Board
            </button>
            <button
              onClick={() => setActiveTab("factions")}
              className={`px-3.5 py-1.5 text-xs rounded font-medium flex items-center gap-1.5 transition-all ${
                activeTab === "factions" ? "bg-amber-500 text-slate-950 font-bold" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Shield className="w-3.5 h-3.5" /> Faction Clocks
            </button>
          </div>

          {/* Active Tab Panel Content */}
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-4 overflow-auto space-y-4">
            {isHub && (
              <div className="relative h-28 rounded-lg overflow-hidden border border-amber-800/40 shadow-lg">
                <img
                  src="/assets/scenes/greywatch_keep.png"
                  alt="Greywatch Keep"
                  className="w-full h-full object-cover object-center filter brightness-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex items-end p-3">
                  <div>
                    <h4 className="text-sm font-bold text-amber-300 drop-shadow">
                      Greywatch Keep Fortress Hub
                    </h4>
                    <p className="text-[11px] text-slate-200 drop-shadow">
                      A lonely stone fortress garrison on the cliffs overlooking the wilderness of Broken Ravine.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "services" && (
              <div className="space-y-4">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Castle className="w-4 h-4 text-amber-400" /> Greywatch Keep Services
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {region.services.map((svc) => (
                    <div
                      key={svc.id}
                      onClick={() => setSelectedServiceId(svc.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedServiceId === svc.id ? "bg-amber-950/40 border-amber-700" : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="font-semibold text-xs text-amber-300 flex items-center justify-between">
                        <span>{svc.name}</span>
                        <span className="text-[10px] text-slate-500 uppercase">{svc.kind}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{svc.description}</p>
                    </div>
                  ))}
                </div>

                {/* Service Interactions */}
                {selectedServiceId === "wayfarer-inn" && (
                  <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2">
                    <h5 className="font-bold text-xs text-emerald-400">Wayfarer Inn Rest</h5>
                    <p className="text-xs text-slate-300">Rest 8 hours at the inn to recover party HP and advance world time.</p>
                    <button
                      onClick={() => onDispatchAction({ type: "REST_AT_HUB", hours: 8 })}
                      className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-xs font-bold rounded flex items-center gap-1.5"
                    >
                      <Bed className="w-3.5 h-3.5" /> Rest 8 Hours (Advance Time)
                    </button>
                  </div>
                )}

                {selectedServiceId === "border-provisioner" && (
                  <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2">
                    <h5 className="font-bold text-xs text-amber-400">Border Provisioner Shop</h5>
                    <div className="space-y-1.5">
                      {EconomyEngine.INITIAL_ITEMS.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 bg-slate-900 rounded border border-slate-800 text-xs">
                          <span className="text-slate-200 font-medium">{item.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-amber-400 font-mono">{item.costGold} GP</span>
                            <button
                              onClick={() => onDispatchAction({ type: "BUY_ITEM", itemId: item.id, costGold: item.costGold })}
                              className="px-2.5 py-0.5 bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-300 text-[11px] rounded"
                            >
                              Buy
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedServiceId === "broken-shield-tavern" && (
                  <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2">
                    <h5 className="font-bold text-xs text-indigo-400">Broken Shield Tavern</h5>
                    <p className="text-xs text-slate-300">Gather rumors and news from passing travelers.</p>
                    <button
                      onClick={() => onDispatchAction({ type: "HEAR_RUMOR", rumorId: "rumor-viper-talisman" })}
                      className="px-3 py-1.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 text-xs font-bold rounded flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Listen for Rumors
                    </button>
                  </div>
                )}

                {selectedServiceId === "captain-office" && (
                  <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-2">
                    <h5 className="font-bold text-xs text-rose-400">Captain Vane's Bounty Office</h5>
                    <p className="text-xs text-slate-300">Accept quest objective to recover the Sun Talisman from the Broken Ravine.</p>
                    <button
                      onClick={() => onDispatchAction({ type: "ACCEPT_QUEST", questId: "quest-sun-talisman" })}
                      className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-bold rounded flex items-center gap-1.5"
                    >
                      <Shield className="w-3.5 h-3.5" /> Accept Sun Talisman Quest (100 GP Reward)
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "rumors" && (
              <div className="space-y-3">
                <h4 className="font-bold text-slate-200 text-sm">Rumor & Intelligence Journal</h4>
                {region.rumors.map((r) => {
                  const st = session.state.knownRumors[r.id] || "unheard";
                  return (
                    <div key={r.id} className="p-3 bg-slate-950 rounded border border-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-amber-300">{r.title}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                          st === "confirmed" ? "bg-emerald-950 text-emerald-300 border border-emerald-800" :
                          st === "heard" ? "bg-amber-950 text-amber-300 border border-amber-800" : "text-slate-500"
                        }`}>
                          {st.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">{st === "unheard" ? "?? [Unheard rumor]" : r.text}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "travel" && (
              <div className="space-y-4">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Compass className="w-4 h-4 text-sky-400" /> Overland Route Selection
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => onDispatchAction({ type: "CHOOSE_ROUTE", routeId: "north-road" })}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      session.state.activeRouteId === "north-road" ? "bg-sky-950/40 border-sky-600" : "bg-slate-950 border-slate-800"
                    }`}
                  >
                    <div className="font-bold text-xs text-sky-300">North Road</div>
                    <div className="text-[11px] text-slate-400 mt-1">Duration: 4 Hours • High Risk (Ambush)</div>
                  </div>

                  <div
                    onClick={() => onDispatchAction({ type: "CHOOSE_ROUTE", routeId: "fen-path" })}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      session.state.activeRouteId === "fen-path" ? "bg-sky-950/40 border-sky-600" : "bg-slate-950 border-slate-800"
                    }`}
                  >
                    <div className="font-bold text-xs text-sky-300">Fen Path</div>
                    <div className="text-[11px] text-slate-400 mt-1">Duration: 8 Hours • Low Risk (Environmental)</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      onDispatchAction({ type: "BEGIN_TRAVEL" });
                      onDispatchAction({ type: "RESOLVE_TRAVEL" });
                      onDispatchAction({ type: "ENTER_DUNGEON" });
                    }}
                    className="px-4 py-2 bg-emerald-950 hover:bg-emerald-900 border border-emerald-700 text-emerald-200 font-bold rounded text-xs flex items-center gap-2"
                  >
                    <ArrowRight className="w-4 h-4 text-emerald-400" /> Begin Travel to Broken Ravine
                  </button>
                  {session.state.currentRegionId === "broken-ravine" && (
                    <button
                      onClick={onEnterDungeonView}
                      className="px-4 py-2 bg-indigo-950 hover:bg-indigo-900 border border-indigo-700 text-indigo-200 font-bold rounded text-xs flex items-center gap-2"
                    >
                      🎮 Launch 2D/3D Dungeon Expedition
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeTab === "factions" && (
              <div className="space-y-3">
                <h4 className="font-bold text-slate-200 text-sm">Faction Clocks & Regional Power</h4>
                {Object.values(session.state.factionStates).map((f) => (
                  <div key={f.factionId} className="p-3 bg-slate-950 rounded border border-slate-800 space-y-1 text-xs">
                    <div className="font-bold text-amber-300 flex items-center justify-between">
                      <span>{f.factionId.toUpperCase()}</span>
                      <span className="text-[10px] text-slate-400">Alert Level: {f.alert} / 10</span>
                    </div>
                    <div className="text-slate-400">Strength: {f.strength} • Territory: {f.territory.join(", ")}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Campaign Status & Event Log */}
        <div className="col-span-4 flex flex-col gap-4 overflow-hidden">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2">
            <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Quests & Party Status</h5>
            <div className="space-y-1.5">
              {Object.entries(session.state.questStates).map(([qId, status]) => (
                <div key={qId} className="p-2 bg-slate-950 rounded border border-slate-800 text-xs">
                  <div className="font-semibold text-rose-300">{qId}</div>
                  <div className="text-[10px] text-slate-400">Status: {status.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-col space-y-2 overflow-hidden">
            <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> Campaign Event Log
            </h5>
            <div className="flex-1 overflow-auto space-y-1 font-mono text-[10px] text-slate-300 pr-1">
              {session.state.emittedEvents.slice(-8).map((ev, idx) => (
                <div key={`ev-${idx}`} className="p-1.5 bg-slate-950 rounded border border-slate-800">
                  <span className="text-amber-400 font-bold">[{ev.type}]</span> {JSON.stringify(ev.payload)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
