import { VersionedAdventure } from "@grimoire3d/ir";
import { SimulatorEngine } from "./simulator";

export type WalkthroughStep = {
  action?: "move" | "inspect" | "searchSecret" | "unlockExit" | "resolveCombat" | "pickupItem";
  target?: string;
  expect?: {
    location?: string;
    item?: string;
    flag?: string;
    equals?: boolean;
  };
};

export type WalkthroughResult = {
  success: boolean;
  stepsExecuted: number;
  totalSteps: number;
  logs: string[];
  error?: string;
};

export function runWalkthroughScript(
  vAdventure: VersionedAdventure,
  steps: WalkthroughStep[],
  seed: number = 42
): WalkthroughResult {
  const engine = new SimulatorEngine(vAdventure, seed);
  const logs: string[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    if (step.action) {
      let res: { success: boolean; message: string } = { success: false, message: "" };

      switch (step.action) {
        case "move":
          res = engine.executeAction({ type: "MOVE", exitId: step.target! });
          break;
        case "inspect":
          res = engine.executeAction({ type: "INSPECT", interactableId: step.target! });
          break;
        case "searchSecret":
          res = engine.executeAction({ type: "SEARCH_SECRET", secretId: step.target! });
          break;
        case "unlockExit":
          res = engine.executeAction({ type: "UNLOCK_EXIT", exitId: step.target! });
          break;
        case "resolveCombat":
          res = engine.executeAction({ type: "RESOLVE_COMBAT", encounterId: step.target! });
          break;
        case "pickupItem":
          res = engine.executeAction({ type: "PICKUP_ITEM", itemId: step.target! });
          break;
      }

      logs.push(`Step ${i + 1}: ${step.action}(${step.target || ""}) => ${res.message}`);

      if (!res.success) {
        return {
          success: false,
          stepsExecuted: i + 1,
          totalSteps: steps.length,
          logs,
          error: `Action failed at step ${i + 1}: ${res.message}`,
        };
      }
    }

    if (step.expect) {
      if (step.expect.location) {
        if (engine.state.currentLocationId !== step.expect.location) {
          return {
            success: false,
            stepsExecuted: i + 1,
            totalSteps: steps.length,
            logs,
            error: `Assertion failed at step ${i + 1}: expected location '${step.expect.location}', got '${engine.state.currentLocationId}'`,
          };
        }
      }

      if (step.expect.item) {
        if (!engine.state.inventory.has(step.expect.item)) {
          return {
            success: false,
            stepsExecuted: i + 1,
            totalSteps: steps.length,
            logs,
            error: `Assertion failed at step ${i + 1}: expected item '${step.expect.item}' in inventory`,
          };
        }
      }

      if (step.expect.flag) {
        const expectedVal = step.expect.equals ?? true;
        const actualVal = engine.state.flags.get(step.expect.flag) ?? false;
        if (actualVal !== expectedVal) {
          return {
            success: false,
            stepsExecuted: i + 1,
            totalSteps: steps.length,
            logs,
            error: `Assertion failed at step ${i + 1}: expected flag '${step.expect.flag}' = ${expectedVal}, got ${actualVal}`,
          };
        }
      }

      logs.push(`Step ${i + 1}: Assertions passed.`);
    }
  }

  return {
    success: true,
    stepsExecuted: steps.length,
    totalSteps: steps.length,
    logs,
  };
}
