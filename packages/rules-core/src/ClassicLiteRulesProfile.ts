import { RulesProfile, SeededRNG, resolveCheck, resolveSimpleCombat } from "./rules";

export class ClassicLiteRulesProfile implements RulesProfile {
  public readonly id = "classic-lite";
  public readonly version = "1.0.0";

  public resolveAction(
    state: any,
    action: any,
    rng: SeededRNG
  ): { success: boolean; message: string; events: any[] } {
    const events: any[] = [];

    switch (action.kind) {
      case "move": {
        events.push({ kind: "player_moved", target: action.exitId });
        return { success: true, message: `Moved exit ${action.exitId}`, events };
      }
      case "inspect": {
        events.push({ kind: "interactable_inspected", id: action.targetId || action.interactableId });
        return { success: true, message: `Inspected ${action.targetId || action.interactableId}`, events };
      }
      case "search":
      case "search_secret": {
        const res = resolveCheck(12, 3, rng);
        events.push({ kind: "secret_searched", success: res.success });
        return { success: res.success, message: res.success ? "Found secret" : "Nothing found", events };
      }
      default:
        return { success: false, message: "Unknown action", events: [] };
    }
  }
}
