import { evaluateCondition } from "@grimoire3d/rules-core";
import { SimulatorEngine } from "@grimoire3d/simulator";
import { CompiledEventScript } from "./types";

export type EventGraphEvaluationResult = {
  triggered: boolean;
  conditionsPassed: boolean;
  effectsApplied: number;
  message: string;
};

export class EventGraphEvaluator {
  public static evaluateScript(
    script: CompiledEventScript,
    engine: SimulatorEngine
  ): EventGraphEvaluationResult {
    if (!script.valid) {
      return {
        triggered: false,
        conditionsPassed: false,
        effectsApplied: 0,
        message: `Cannot execute invalid script (${script.errors.join(", ")})`,
      };
    }

    // Evaluate all conditions
    for (const cond of script.conditions) {
      const passed = evaluateCondition(cond, engine.state.flags, engine.state.inventory);
      if (!passed) {
        return {
          triggered: true,
          conditionsPassed: false,
          effectsApplied: 0,
          message: `Script trigger conditions failed.`,
        };
      }
    }

    // Apply effects
    let appliedCount = 0;
    for (const eff of script.effects) {
      if (eff.kind === "grantItem") {
        engine.state.inventory.add(eff.itemId);
        engine.emit({ kind: "item_granted", itemId: eff.itemId, source: script.graphId });
        appliedCount++;
      } else if (eff.kind === "setFlag") {
        engine.state.flags.set(eff.flag, eff.value);
        appliedCount++;
      } else if (eff.kind === "revealSecret") {
        engine.state.discoveredSecrets.add(eff.secretId);
        appliedCount++;
      } else if (eff.kind === "openExit") {
        engine.state.unlockedExits.add(eff.exitId);
        engine.emit({ kind: "exit_unlocked", exitId: eff.exitId, method: "key" });
        appliedCount++;
      }
    }

    return {
      triggered: true,
      conditionsPassed: true,
      effectsApplied: appliedCount,
      message: `Successfully executed event graph script '${script.graphId}' (${appliedCount} effects applied).`,
    };
  }
}
