import React, { useState } from "react";
import { Spell, SpellEvaluator, CasterState } from "@grimoire3d/spell-core";
import { DialogueTree, DialogueEngineSession } from "@grimoire3d/dialogue-engine";
import { SeededRNG } from "@grimoire3d/rules-core";
import { SimulatorEngine } from "@grimoire3d/simulator";
import { serpentAltarAdventure } from "@grimoire3d/fixtures";
import { VersionedAdventure } from "@grimoire3d/ir";
import { Wand2, MessageSquare, Dices, ShieldAlert, Sparkles, CheckCircle2 } from "lucide-react";

export const ToolsInspectorView: React.FC = () => {
  // 1. Spell State
  const [spell, setSpell] = useState<Spell>({
    id: "spell-fireball",
    name: "Fireball",
    school: "evocation",
    level: 3,
    manaCost: 15,
    kind: "damage",
    targetType: "allEnemies",
    diceFormula: "1d6",
    scaleWithCasterLevel: true,
    allowedClasses: ["mage", "wizard"],
    range: { value: 150, unit: "feet" },
    duration: { value: 0, unit: "instantaneous" },
    castingTime: { value: 1, unit: "action" },
    components: { verbal: true, somatic: true, material: "a tiny ball of bat guano and sulfur" },
    description: "Flames burst forth dealing 1d6 fire damage per caster level.",
  });

  const [caster, setCaster] = useState<CasterState>({
    characterName: "Melf the Archmage",
    characterClass: "mage",
    level: 5,
    currentMana: 50,
    maxMana: 50,
    activeStatusEffects: [],
  });

  const [spellCastLog, setSpellCastLog] = useState<string[]>([]);

  const handleCastSpell = () => {
    const rng = new SeededRNG(Math.floor(Math.random() * 10000));
    const res = SpellEvaluator.castSpell(spell, caster, rng);
    setCaster(res.newCasterState);
    setSpellCastLog((prev) => [res.message, ...prev]);
  };

  // 2. Dialogue State
  const castellanTree: DialogueTree = {
    id: "tree-castellan",
    npcId: "castellan",
    startNodeId: "node-intro",
    nodes: [
      {
        id: "node-intro",
        speakerName: "The Castellan",
        text: "Welcome adventurer. The Caves of Chaos threaten the Borderlands. Will you aid the Keep?",
        choices: [
          { id: "choice-accept", text: "I accept the task. What is the reward?", nextNodeId: "node-reward" },
          {
            id: "choice-persuade-advance",
            text: "[Persuasion DC 12] Pay us an advance in gold and we will clear the caves twice as fast.",
            nextNodeId: "node-intro",
            check: {
              ability: "persuasion",
              dc: 12,
              successNextNodeId: "node-advance-granted",
              failureNextNodeId: "node-advance-refused",
            },
          },
        ],
      },
      {
        id: "node-advance-granted",
        speakerName: "The Castellan",
        text: "Spoken like a true leader. Take these 100 gold coins and secure the ravine!",
        choices: [{ id: "choice-leave", text: "Thank you, My Lord.", nextNodeId: null }],
      },
      {
        id: "node-advance-refused",
        speakerName: "The Castellan",
        text: "The Realm does not pay advances to mercenaries! Prove your worth first.",
        choices: [{ id: "choice-leave-refused", text: "Understood.", nextNodeId: null }],
      },
      {
        id: "node-reward",
        speakerName: "The Castellan",
        text: "Clear the caves and you shall receive the Ring of Protection +1.",
        choices: [{ id: "choice-finish", text: "I depart at once.", nextNodeId: null }],
      },
    ],
  };

  const [engine] = useState(() => new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, 42));
  const [dialogueSession, setDialogueSession] = useState(() => new DialogueEngineSession(castellanTree));

  const handleSelectChoice = (choiceId: string) => {
    dialogueSession.selectChoice(choiceId, engine);
    setDialogueSession(Object.assign(Object.create(Object.getPrototypeOf(dialogueSession)), dialogueSession));
  };

  const handleResetDialogue = () => {
    setDialogueSession(new DialogueEngineSession(castellanTree));
  };

  return (
    <div className="w-full h-full bg-slate-950 text-slate-100 p-6 grid grid-cols-12 gap-6 overflow-y-auto">
      {/* Left Column: Custom Spell Engine Inspector */}
      <div className="col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-xl">
        <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
          <div className="w-8 h-8 rounded-lg bg-amber-950 border border-amber-800 flex items-center justify-center">
            <Wand2 className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100">Custom Spell & Skill Engine (@grimoire3d/spell-core)</h3>
            <p className="text-[10px] text-slate-400">BTCS Spell Creator, Scaling Dice Rolls & Status Effects</p>
          </div>
        </div>

        {/* Caster Stats */}
        <div className="grid grid-cols-3 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 block text-[10px]">Caster Name</span>
            <span className="font-bold text-slate-200">{caster.characterName}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Class & Level</span>
            <span className="font-bold text-amber-400 font-mono">{caster.characterClass} (Lvl {caster.level})</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Mana Pool</span>
            <span className="font-bold text-sky-400 font-mono">{caster.currentMana} / {caster.maxMana} MP</span>
          </div>
        </div>

        {/* Cast Spell Button */}
        <button
          onClick={handleCastSpell}
          className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold rounded-lg text-xs shadow-lg shadow-amber-950 flex items-center justify-center gap-2 transition-all"
        >
          <Sparkles className="w-4 h-4" /> Cast {spell.name} ({spell.diceFormula} per Lvl, Cost: {spell.manaCost} MP)
        </button>

        {/* Spell Cast Output Log */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 h-48 overflow-y-auto font-mono text-[11px] space-y-1.5">
          {spellCastLog.length === 0 ? (
            <div className="text-slate-500 italic text-[10px]">Click 'Cast' to test dynamic spell damage calculation.</div>
          ) : (
            spellCastLog.map((msg, i) => (
              <div key={i} className="text-amber-300 border-b border-slate-900 pb-1">
                {msg}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Column: Branching Dialogue Tree Engine */}
      <div className="col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-800 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-100">Branching Dialogue Engine (@grimoire3d/dialogue-engine)</h3>
              <p className="text-[10px] text-slate-400">Solasta & NWN Conversation Trees & Skill Checks</p>
            </div>
          </div>

          <button
            onClick={handleResetDialogue}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-medium transition-colors"
          >
            Restart Conversation
          </button>
        </div>

        {/* Dialogue Active Node Box */}
        {dialogueSession.state.dialogueEnded ? (
          <div className="p-6 bg-slate-950 border border-slate-800 rounded-lg text-center text-xs text-emerald-400 font-bold flex flex-col items-center gap-2">
            <CheckCircle2 className="w-6 h-6" /> Conversation Completed.
          </div>
        ) : (
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-4">
            <div>
              <span className="text-[10px] text-indigo-400 font-mono uppercase tracking-wider font-bold">
                {dialogueSession.getCurrentNode()?.speakerName}
              </span>
              <p className="text-xs text-slate-200 mt-1 font-serif leading-relaxed italic">
                "{dialogueSession.getCurrentNode()?.text}"
              </p>
            </div>

            {/* Available Choices */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-[10px] text-slate-400 font-semibold block">Select Player Response:</span>
              {dialogueSession.getAvailableChoices(engine).map((choice) => (
                <button
                  key={choice.id}
                  onClick={() => handleSelectChoice(choice.id)}
                  className="w-full text-left p-2.5 bg-slate-900 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-700 rounded-md text-xs text-slate-200 hover:text-indigo-200 transition-all"
                >
                  {choice.text}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
