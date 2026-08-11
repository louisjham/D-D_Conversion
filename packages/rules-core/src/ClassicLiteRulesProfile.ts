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

    switch (action.type) {
      case "MOVE": {
        events.push({ type: "PLAYER_MOVED", target: action.exitId });
        return { success: true, message: `Moved exit ${action.exitId}`, events };
      }
      case "INSPECT": {
        events.push({ type: "INTERACTABLE_INSPECTED", id: action.interactableId });
        return { success: true, message: `Inspected ${action.interactableId}`, events };
      }
      case "SEARCH_SECRET": {
        const res = resolveCheck(12, 3, rng);
        events.push({ type: "SECRET_SEARCHED", success: res.success });
        return { success: res.success, message: res.success ? "Found secret" : "Nothing found", events };
      }
      default:
        return { success: false, message: "Unknown action", events: [] };
    }
  }
}
