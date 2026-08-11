import { evaluateCondition, resolveCheck } from "@grimoire3d/rules-core";
import { SimulatorEngine } from "@grimoire3d/simulator";
import { DialogueTree, DialogueNode, DialogueChoice, DialogueState } from "./types";

export class DialogueEngineSession {
  public tree: DialogueTree;
  public state: DialogueState;
  private nodeMap: Map<string, DialogueNode>;

  constructor(tree: DialogueTree) {
    this.tree = tree;
    this.nodeMap = new Map(tree.nodes.map((n) => [n.id, n]));

    this.state = {
      treeId: tree.id,
      npcId: tree.npcId,
      currentNodeId: tree.startNodeId,
      dialogueEnded: false,
      historyNodeIds: [tree.startNodeId],
    };
  }

  public getCurrentNode(): DialogueNode | null {
    if (this.state.dialogueEnded || !this.state.currentNodeId) return null;
    return this.nodeMap.get(this.state.currentNodeId) || null;
  }

  public getAvailableChoices(engine: SimulatorEngine): DialogueChoice[] {
    const currentNode = this.getCurrentNode();
    if (!currentNode) return [];

    return currentNode.choices.filter((choice) => {
      if (!choice.visibleWhen) return true;
      return evaluateCondition(choice.visibleWhen, engine.state.flags, engine.state.inventory);
    });
  }

  public selectChoice(
    choiceId: string,
    engine: SimulatorEngine
  ): { success: boolean; message: string; state: DialogueState } {
    const currentNode = this.getCurrentNode();
    if (!currentNode) {
      return { success: false, message: "Dialogue is not active.", state: this.state };
    }

    const choice = currentNode.choices.find((c) => c.id === choiceId);
    if (!choice) {
      return { success: false, message: `Choice '${choiceId}' not found.`, state: this.state };
    }

    // Process Choice Effects
    if (choice.effects) {
      for (const eff of choice.effects) {
        if (eff.kind === "grantItem") {
          engine.state.inventory.add(eff.itemId);
          engine.emit({ type: "ITEM_GRANTED", itemId: eff.itemId, source: `dialogue-${choice.id}` });
        } else if (eff.kind === "setFlag") {
          engine.state.flags.set(eff.flag, eff.value);
        } else if (eff.kind === "revealSecret") {
          engine.state.discoveredSecrets.add(eff.secretId);
        } else if (eff.kind === "openExit") {
          engine.state.unlockedExits.add(eff.exitId);
        }
      }
    }

    // Process Skill Check or Direct Transition
    let targetNextNodeId: string | null = choice.nextNodeId;

    if (choice.check) {
      const checkRes = resolveCheck(choice.check.dc, 3, engine.rng);
      this.state.lastCheckResult = {
        ability: choice.check.ability,
        dc: choice.check.dc,
        roll: checkRes.roll,
        success: checkRes.success,
      };

      targetNextNodeId = checkRes.success ? choice.check.successNextNodeId : choice.check.failureNextNodeId;
    }

    if (!targetNextNodeId) {
      this.state.currentNodeId = null;
      this.state.dialogueEnded = true;
      return { success: true, message: "Dialogue completed.", state: this.state };
    }

    this.state.currentNodeId = targetNextNodeId;
    this.state.historyNodeIds.push(targetNextNodeId);

    // Apply Next Node OnEnter Effects
    const nextNode = this.nodeMap.get(targetNextNodeId);
    if (nextNode && nextNode.onEnterEffects) {
      for (const eff of nextNode.onEnterEffects) {
        if (eff.kind === "grantItem") {
          engine.state.inventory.add(eff.itemId);
        } else if (eff.kind === "setFlag") {
          engine.state.flags.set(eff.flag, eff.value);
        }
      }
    }

    return {
      success: true,
      message: `Advanced dialogue to node '${targetNextNodeId}'`,
      state: this.state,
    };
  }
}
