import { describe, it, expect } from "vitest";
import { DialogueTree, DialogueTreeSchema, DialogueEngineSession } from "./index";
import { SimulatorEngine } from "@grimoire3d/simulator";
import { serpentAltarAdventure } from "@grimoire3d/fixtures";
import { VersionedAdventure } from "@grimoire3d/ir";

describe("@grimoire3d/dialogue-engine — Branching Dialogue Tree Engine Suite", () => {
  const castellanDialogueTree: DialogueTree = {
    id: "tree-castellan-audience",
    npcId: "castellan",
    startNodeId: "node-intro",
    nodes: [
      {
        id: "node-intro",
        speakerName: "The Castellan",
        text: "Welcome adventurer. The Caves of Chaos threaten the Borderlands. Will you aid the Keep?",
        choices: [
          {
            id: "choice-accept",
            text: "I accept the task. What is the reward?",
            nextNodeId: "node-reward",
          },
          {
            id: "choice-persuade-advance",
            text: "[Persuasion DC 12] Pay us an advance in gold and we will clear the caves twice as fast.",
            nextNodeId: "node-intro", // Fallback
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
        onEnterEffects: [{ kind: "grantItem", itemId: "gold-goblet" }],
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

  it("1. Validates DialogueTree Zod Schema parsing", () => {
    const res = DialogueTreeSchema.safeParse(castellanDialogueTree);
    expect(res.success).toBe(true);
  });

  it("2. Evaluates branching choices and transitions between nodes", () => {
    const engine = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, 42);
    const session = new DialogueEngineSession(castellanDialogueTree);

    expect(session.getCurrentNode()?.id).toBe("node-intro");
    const choices = session.getAvailableChoices(engine);
    expect(choices).toHaveLength(2);

    const res = session.selectChoice("choice-accept", engine);
    expect(res.success).toBe(true);
    expect(session.getCurrentNode()?.id).toBe("node-reward");
  });

  it("3. Resolves skill check choices and routes to success/failure branches", () => {
    const engine = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, 42);
    const session = new DialogueEngineSession(castellanDialogueTree);

    const res = session.selectChoice("choice-persuade-advance", engine);
    expect(res.success).toBe(true);
    expect(session.state.lastCheckResult).toBeDefined();

    const targetNodeId = session.state.lastCheckResult?.success ? "node-advance-granted" : "node-advance-refused";
    expect(session.getCurrentNode()?.id).toBe(targetNodeId);
  });

  it("4. Filters choices by condition flags", () => {
    const conditionalTree: DialogueTree = {
      id: "tree-guard",
      npcId: "corporal-gate",
      startNodeId: "node-gate",
      nodes: [
        {
          id: "node-gate",
          speakerName: "Corporal of the Guard",
          text: "Halt! State your business.",
          choices: [
            { id: "choice-normal", text: "Just passing through.", nextNodeId: null },
            {
              id: "choice-secret-pass",
              text: "Show Castellan Pass Writ",
              nextNodeId: null,
              visibleWhen: { kind: "hasItem", itemId: "iron-gate-key" },
            },
          ],
        },
      ],
    };

    const engine = new SimulatorEngine(serpentAltarAdventure as VersionedAdventure, 42);
    const session = new DialogueEngineSession(conditionalTree);

    // Initially without iron-gate-key
    let available = session.getAvailableChoices(engine);
    expect(available).toHaveLength(1);

    // Grant iron-gate-key
    engine.state.inventory.add("iron-gate-key");
    available = session.getAvailableChoices(engine);
    expect(available).toHaveLength(2);
  });
});
