import React, { useState, useMemo } from "react";
import {
  TacticalCombatManager,
  TacticalCombatant,
  GridPos,
} from "@grimoire3d/rules-core";
import {
  Swords,
  Shield,
  Heart,
  Zap,
  Target,
  ChevronRight,
  Sparkles,
  RotateCcw,
  Trophy,
  Skull,
  User,
  Activity,
  Award,
  CircleDot,
  FlaskConical,
  Footprints,
} from "lucide-react";

interface TacticalCombatViewProps {
  initialPlayerStats?: {
    name: string;
    hp: number;
    maxHp: number;
    ac: number;
    attackBonus: number;
    damageBonus: number;
  };
  monsters?: { template: any; count: number }[];
  onCombatEnd?: (victory: boolean) => void;
}

export const TacticalCombatView: React.FC<TacticalCombatViewProps> = ({
  initialPlayerStats = {
    name: "Hero Fighter",
    hp: 24,
    maxHp: 24,
    ac: 16,
    attackBonus: 5,
    damageBonus: 3,
  },
  monsters = [
    {
      template: { id: "goblin-scout", name: "Goblin Scout", hp: 12, ac: 13, attackBonus: 4, damageDice: "1d6+2", xpValue: 50 },
      count: 2,
    },
    {
      template: { id: "bugbear-chief", name: "Bugbear Chieftain", hp: 27, ac: 15, attackBonus: 5, damageDice: "2d8+3", xpValue: 200 },
      count: 1,
    },
  ],
  onCombatEnd,
}) => {
  const [manager, setManager] = useState<TacticalCombatManager>(
    () => new TacticalCombatManager(initialPlayerStats, monsters, 42)
  );

  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [selectedSpellId, setSelectedSpellId] = useState<string | null>(null);
  const [isSpellMenuOpen, setIsSpellMenuOpen] = useState(false);

  // Force re-render helper
  const updateState = () => {
    setManager(Object.assign(Object.create(Object.getPrototypeOf(manager)), manager));
  };

  const active = manager.getActiveCombatant();
  const combatState = manager.state;

  const player = useMemo(
    () => combatState.combatants.find((c) => c.isPlayer) || combatState.combatants[0],
    [combatState]
  );

  const handleTileClick = (x: number, y: number) => {
    if (combatState.combatEnded || !active.isPlayer) return;

    const clickedCombatant = combatState.combatants.find((c) => c.hp > 0 && c.gridPos.x === x && c.gridPos.y === y);

    if (clickedCombatant && !clickedCombatant.isPlayer) {
      // Select monster target
      setSelectedTargetId(clickedCombatant.id);
    } else if (!clickedCombatant) {
      // Move to tile if reachable
      const dist = TacticalCombatManager.calculateDistance(active.gridPos, { x, y });
      if (dist <= active.movementRemaining) {
        manager.moveActiveCombatant({ x, y });
        updateState();
      }
    }
  };

  const handleAttack = (attackId: string) => {
    if (!selectedTargetId) {
      const firstMonster = combatState.combatants.find((c) => !c.isPlayer && c.hp > 0);
      if (firstMonster) {
        manager.executeAttack(attackId, firstMonster.id);
      }
    } else {
      manager.executeAttack(attackId, selectedTargetId);
    }
    updateState();
  };

  const handleCastSpell = (spellId: string) => {
    manager.executeCastSpell(spellId, selectedTargetId || undefined);
    setIsSpellMenuOpen(false);
    updateState();
  };

  const handleUsePotion = () => {
    manager.executeUsePotion();
    updateState();
  };

  const handleDodge = () => {
    manager.executeDodge();
    updateState();
  };

  const handleEndTurn = () => {
    manager.endTurn();
    updateState();
  };

  const handleResetCombat = () => {
    setManager(new TacticalCombatManager(initialPlayerStats, monsters, Math.floor(Math.random() * 10000)));
    setSelectedTargetId(null);
  };

  return (
    <div className="w-full h-full bg-slate-950 text-slate-100 flex flex-col p-4 overflow-hidden select-none">
      {/* Top Header: Initiative Order & Round Counter */}
      <header className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-3 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-mono font-bold text-amber-300">
              ROUND {combatState.round}
            </span>
          </div>

          {/* Initiative Timeline Bar */}
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mr-1">Initiative:</span>
            {combatState.combatants.map((c, idx) => {
              const isActive = idx === combatState.turnIndex;
              const isDead = c.hp <= 0;
              return (
                <div
                  key={c.id}
                  onClick={() => !c.isPlayer && setSelectedTargetId(c.id)}
                  className={`flex items-center gap-2 px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-all ${
                    isDead
                      ? "bg-slate-950 border-slate-900 text-slate-600 line-through opacity-50"
                      : isActive
                      ? "bg-emerald-950 border-emerald-500 text-white font-bold ring-2 ring-emerald-500/50 shadow-lg shadow-emerald-950"
                      : selectedTargetId === c.id
                      ? "bg-red-950 border-red-500 text-red-200"
                      : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: c.color }}
                  />
                  <span>{c.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">({c.hp}/{c.maxHp} HP)</span>
                  <span className="text-[9px] bg-slate-800 text-amber-400 font-mono px-1 rounded">
                    d20:{c.initiative}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={handleResetCombat}
          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md text-xs text-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Restart Combat
        </button>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 grid grid-cols-12 gap-4 overflow-hidden">
        {/* Left Column: Tactical Battle Grid (7 cols) */}
        <div className="col-span-12 lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-md relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-400" /> 2D Tactical Battle Grid (10x9 Tiles)
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Active Position: ({active.gridPos.x}, {active.gridPos.y})
            </span>
          </div>

          {/* Grid Render Canvas */}
          <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2 flex items-center justify-center overflow-auto">
            <div className="grid grid-cols-10 gap-1 bg-slate-900 p-2 rounded-md border border-slate-800/80 shadow-inner">
              {Array.from({ length: combatState.gridHeight }).map((_, y) =>
                Array.from({ length: combatState.gridWidth }).map((_, x) => {
                  const combatantHere = combatState.combatants.find(
                    (c) => c.hp > 0 && c.gridPos.x === x && c.gridPos.y === y
                  );

                  const isActiveHere = active.gridPos.x === x && active.gridPos.y === y;
                  const isSelectedTarget = combatantHere && combatantHere.id === selectedTargetId;
                  const distFromActive = TacticalCombatManager.calculateDistance(active.gridPos, { x, y });
                  const isReachableMove = active.isPlayer && !combatantHere && distFromActive > 0 && distFromActive <= active.movementRemaining;

                  return (
                    <button
                      key={`${x}-${y}`}
                      onClick={() => handleTileClick(x, y)}
                      className={`w-10 h-10 rounded flex flex-col items-center justify-center relative transition-all text-xs font-mono border ${
                        isActiveHere
                          ? "bg-emerald-950 border-emerald-400 text-emerald-300 ring-2 ring-emerald-400 animate-pulse shadow-lg"
                          : isSelectedTarget
                          ? "bg-red-950 border-red-500 text-red-300 ring-2 ring-red-500 shadow-lg"
                          : combatantHere
                          ? combatantHere.isPlayer
                            ? "bg-emerald-950/60 border-emerald-800 text-emerald-400"
                            : "bg-red-950/60 border-red-800 text-red-400"
                          : isReachableMove
                          ? "bg-sky-950/40 border-sky-800/60 hover:bg-sky-900/60 hover:border-sky-500 cursor-pointer"
                          : "bg-slate-950/80 border-slate-800/50 hover:bg-slate-900 text-slate-700"
                      }`}
                    >
                      {combatantHere ? (
                        <div className="flex flex-col items-center justify-center">
                          {combatantHere.isPlayer ? (
                            <div className="w-5 h-5 rounded-full bg-emerald-950 border border-emerald-400 flex items-center justify-center shadow">
                              <User className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                            </div>
                          ) : combatantHere.name.toLowerCase().includes("viper") || combatantHere.name.toLowerCase().includes("serpent") ? (
                            <img
                              src="/assets/tokens/viper.png"
                              alt="Viper"
                              className="w-5 h-5 rounded-full object-cover border border-red-500 shadow"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-red-950 border border-red-500 flex items-center justify-center shadow">
                              <Skull className="w-3 h-3 text-red-300 shrink-0" />
                            </div>
                          )}
                          <span className="text-[8px] leading-none font-bold mt-0.5 max-w-[34px] truncate">
                            {combatantHere.name.split(" ")[0]}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[8px] text-slate-800">{x},{y}</span>
                      )}

                      {/* Reachable move indicator dot */}
                      {isReachableMove && (
                        <div className="w-1.5 h-1.5 rounded-full bg-sky-400 absolute bottom-1" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Victory / Defeat Modal Overlay */}
          {combatState.combatEnded && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 z-20">
              {combatState.outcome === "victory" ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-950 border-2 border-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-emerald-950 animate-bounce">
                    <Trophy className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-white">VICTORY ACHIEVED!</h2>
                  <p className="text-xs text-slate-300 max-w-sm mx-auto">
                    All hostile threats defeated in {combatState.round} rounds. Hero HP remaining: {player.hp}/{player.maxHp}.
                  </p>
                  <div className="flex items-center justify-center gap-3 font-mono text-xs text-amber-400 bg-slate-900 border border-slate-800 p-3 rounded-lg">
                    <Award className="w-4 h-4 text-amber-400" /> XP Earned: +300 XP | Loot: 45 GP, Iron Key
                  </div>
                  <button
                    onClick={() => {
                      if (onCombatEnd) onCombatEnd(true);
                      else handleResetCombat();
                    }}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-bold rounded-lg text-xs shadow-lg cursor-pointer transition-all"
                  >
                    Continue Exploration
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-red-950 border-2 border-red-500 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-red-950">
                    <Skull className="w-8 h-8 text-red-400" />
                  </div>
                  <h2 className="text-2xl font-extrabold text-red-400">DEFEAT!</h2>
                  <p className="text-xs text-slate-300 max-w-sm mx-auto">
                    Your character was overcome in combat.
                  </p>
                  <button
                    onClick={handleResetCombat}
                    className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-xs shadow-lg cursor-pointer transition-all"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Action Economy & Log (5 cols) */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">
          {/* Card 1: Active Turn Action Budget */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: active.color }}
                />
                <span className="text-sm font-bold text-white">{active.name}'s Turn</span>
              </div>
              <span className="text-xs font-mono text-emerald-400 font-semibold">
                HP: {active.hp}/{active.maxHp} | AC: {active.ac}
              </span>
            </div>

            {/* Action Economy Badges */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className={`p-2 rounded-lg border text-center font-mono ${active.movementRemaining > 0 ? "bg-sky-950/60 border-sky-800 text-sky-300" : "bg-slate-950 border-slate-800 text-slate-600"}`}>
                <div className="text-[10px] text-slate-400 uppercase flex items-center justify-center gap-1">
                  <Footprints className="w-3 h-3 text-sky-400" /> Movement
                </div>
                <div className="text-xs font-bold mt-0.5">{active.movementRemaining * 5}ft</div>
              </div>

              <div className={`p-2 rounded-lg border text-center font-mono ${active.hasAction ? "bg-emerald-950/60 border-emerald-800 text-emerald-300" : "bg-slate-950 border-slate-800 text-slate-600"}`}>
                <div className="text-[10px] text-slate-400 uppercase flex items-center justify-center gap-1">
                  <Swords className="w-3 h-3 text-emerald-400" /> Action
                </div>
                <div className="text-xs font-bold mt-0.5">{active.hasAction ? "READY" : "USED"}</div>
              </div>

              <div className={`p-2 rounded-lg border text-center font-mono ${active.hasBonusAction ? "bg-amber-950/60 border-amber-800 text-amber-300" : "bg-slate-950 border-slate-800 text-slate-600"}`}>
                <div className="text-[10px] text-slate-400 uppercase flex items-center justify-center gap-1">
                  <Shield className="w-3 h-3 text-amber-400" /> Bonus
                </div>
                <div className="text-xs font-bold mt-0.5">{active.hasBonusAction ? "READY" : "USED"}</div>
              </div>
            </div>

            {/* Action Dock Buttons */}
            {active.isPlayer && !combatState.combatEnded ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {active.attacks.map((att) => (
                    <button
                      key={att.id}
                      onClick={() => handleAttack(att.id)}
                      disabled={!active.hasAction}
                      className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
                        active.hasAction
                          ? "bg-emerald-600 hover:bg-emerald-500 text-slate-950 border-emerald-500 shadow-md cursor-pointer"
                          : "bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed"
                      }`}
                    >
                      <Swords className="w-3.5 h-3.5" /> {att.name}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setIsSpellMenuOpen((prev) => !prev)}
                    disabled={!active.hasAction}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all border ${
                      active.hasAction
                        ? "bg-indigo-950/80 hover:bg-indigo-900 border-indigo-700 text-indigo-200 cursor-pointer"
                        : "bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Spells
                  </button>

                  <button
                    onClick={handleUsePotion}
                    disabled={!active.hasBonusAction}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all border ${
                      active.hasBonusAction
                        ? "bg-amber-950/80 hover:bg-amber-900 border-amber-700 text-amber-200 cursor-pointer"
                        : "bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    <FlaskConical className="w-3.5 h-3.5 text-amber-400" /> Potion
                  </button>

                  <button
                    onClick={handleDodge}
                    disabled={!active.hasAction}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all border ${
                      active.hasAction
                        ? "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 cursor-pointer"
                        : "bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 text-slate-400" /> Dodge
                  </button>
                </div>

                {/* Spell Selector Dropdown */}
                {isSpellMenuOpen && active.spells && (
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 space-y-1">
                    <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-1">
                      Available Spells (Mana: {active.casterState?.currentMana}/{active.casterState?.maxMana})
                    </div>
                    {active.spells.map((sp) => (
                      <button
                        key={sp.id}
                        onClick={() => handleCastSpell(sp.id)}
                        className="w-full px-2.5 py-1.5 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-800 rounded-md text-xs text-indigo-200 font-medium flex items-center justify-between cursor-pointer"
                      >
                        <span>{sp.name} ({sp.diceFormula})</span>
                        <span className="text-[10px] font-mono text-indigo-400">{sp.manaCost} Mana</span>
                      </button>
                    ))}
                  </div>
                )}

                <button
                  onClick={handleEndTurn}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-2"
                >
                  End Turn <ChevronRight className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
            ) : (
              <div className="py-4 text-center text-xs text-slate-400 font-mono italic">
                Monster AI turn executing...
              </div>
            )}
          </div>

          {/* Card 2: Combat Log Feed */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex-1 flex flex-col min-h-48">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-indigo-400" /> Tactical Event Log
            </h4>
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-y-auto font-mono text-[11px] space-y-1.5 text-slate-300 max-h-56">
              {combatState.log.map((entry) => (
                <div
                  key={entry.id}
                  className={`leading-relaxed border-b border-slate-900/80 pb-1 ${
                    entry.rollDetails?.isCritical
                      ? "text-amber-300 font-bold"
                      : entry.rollDetails?.isHit
                      ? "text-emerald-300"
                      : entry.actionType === "CAST_SPELL"
                      ? "text-indigo-300"
                      : "text-slate-400"
                  }`}
                >
                  <span className="text-slate-600 font-normal">[{entry.timestamp}]</span> {entry.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
