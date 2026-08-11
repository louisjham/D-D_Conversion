import { SimulatorEngine, GameAction, DomainEvent } from "./simulator";

export type AutoPlayStepResult = {
  action: GameAction;
  success: boolean;
  message: string;
  events: DomainEvent[];
  completed: boolean;
  outcome?: "victory" | "defeat";
};

export class AutoPlayAgent {
  public engine: SimulatorEngine;
  public stepCount: number = 0;
  public maxSteps: number = 500;
  private roomVisitCounts: Map<string, number> = new Map();
  private inspectedTargets: Set<string> = new Set();

  constructor(engine: SimulatorEngine, maxSteps: number = 500) {
    this.engine = engine;
    this.maxSteps = maxSteps;
  }

  public planNextAction(): GameAction {
    const state = this.engine.state;
    const curLoc = this.engine.getCurrentLocation();

    // Track visit count
    this.roomVisitCounts.set(curLoc.id, (this.roomVisitCounts.get(curLoc.id) || 0) + 1);

    // 1. Combat Decision Policy
    const encounterActive = curLoc.encounter && !state.flags.get(`${curLoc.encounter.id}-defeated`) && !state.flags.get("altar-viper-defeated");

    if (state.inCombat || encounterActive) {
      const healItem = Array.from(state.inventory).find((i) => i.includes("potion") || i.includes("healing"));
      if (state.playerHp <= 12 && healItem) {
        return { kind: "useItem", itemId: healItem };
      }
      return { kind: "combatAction", action: "attack" };
    }

    // 2. Critical Healing / Rest Policy
    if (state.playerHp <= 16) {
      return { kind: "rest" };
    }

    // 3. Inspection Policy: Inspect uninspected interactables in current room
    for (const inter of curLoc.interactables) {
      if (!this.inspectedTargets.has(inter.id)) {
        this.inspectedTargets.add(inter.id);
        return { kind: "inspect", targetId: inter.id };
      }
    }

    // 4. Secret Search Policy: Search undiscovered secrets in current room
    for (const sec of curLoc.secrets) {
      if (!state.discoveredSecrets.has(sec.id)) {
        return { kind: "search", targetId: sec.id };
      }
    }

    // 5. Door Unlocking Policy: Unlock visible locked exits if key is owned
    for (const exit of curLoc.exits) {
      if (exit.locked && !state.unlockedExits.has(exit.id)) {
        if (exit.locked.keyItemId && state.inventory.has(exit.locked.keyItemId)) {
          return { type: "UNLOCK_EXIT", exitId: exit.id };
        }
      }
    }

    // 6. Navigation Policy: Pick valid exit that leads to the least-visited reachable room
    let bestExit = null;
    let minVisits = Infinity;

    for (const exit of curLoc.exits) {
      // Check secret visibility
      if (exit.visibleWhen?.kind === "flag" && !state.flags.get(exit.visibleWhen.flag)) {
        continue;
      }
      // Check locked status
      if (exit.locked && !state.unlockedExits.has(exit.id) && !state.inventory.has(exit.locked.keyItemId || "")) {
        continue;
      }

      const targetVisits = this.roomVisitCounts.get(exit.target) || 0;
      if (targetVisits < minVisits) {
        minVisits = targetVisits;
        bestExit = exit;
      }
    }

    if (bestExit) {
      return { kind: "move", direction: bestExit.direction };
    }

    return { kind: "rest" };
  }

  public step(): AutoPlayStepResult {
    if (this.engine.state.gameEnded || this.stepCount >= this.maxSteps) {
      return {
        action: { kind: "rest" },
        success: false,
        message: this.engine.state.gameEnded ? "Game has completed." : "Maximum step budget exceeded.",
        events: [],
        completed: true,
        outcome: this.engine.state.gameOutcome,
      };
    }

    this.stepCount++;
    const action = this.planNextAction();
    const result = this.engine.executeAction(action);

    return {
      action,
      success: result.success,
      message: result.message,
      events: result.events,
      completed: this.engine.state.gameEnded,
      outcome: this.engine.state.gameOutcome,
    };
  }

  public runUntilCompletion(): { totalSteps: number; outcome?: "victory" | "defeat"; history: AutoPlayStepResult[] } {
    const history: AutoPlayStepResult[] = [];

    while (!this.engine.state.gameEnded && this.stepCount < this.maxSteps) {
      const stepRes = this.step();
      history.push(stepRes);
    }

    return {
      totalSteps: this.stepCount,
      outcome: this.engine.state.gameOutcome,
      history,
    };
  }
}
