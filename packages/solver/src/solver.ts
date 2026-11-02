import { VersionedAdventure } from "@grimoire3d/ir";
import {
  SimulatorEngine,
  GameState,
  GameAction,
  cloneGameState,
} from "@grimoire3d/simulator";
import { SeededRNG, createStandardCharacter } from "@grimoire3d/rules-core";
import {
  SolverOptions,
  SolverResult,
  SolverNode,
  SolverDeadEnd,
} from "./types";

/**
 * Hash game state by:
 * (locationId + sorted flags + sorted inventory + HP bucket + discovered secrets + unlocked exits)
 */
export function hashState(state: GameState, hpBucketSize: number = 5): string {
  const loc = state.currentLocationId;

  // Sorted flags (only truthy values)
  const sortedFlags = Array.from(state.flags.entries())
    .filter(([_, v]) => Boolean(v))
    .map(([k, v]) => `${k}:${v}`)
    .sort()
    .join(",");

  // Sorted inventory
  const sortedInv = Array.from(state.inventory)
    .sort()
    .join(",");

  // HP bucket
  const hpBucket = state.playerHp <= 0 ? 0 : Math.ceil(state.playerHp / hpBucketSize);

  // Sorted discovered secrets
  const sortedSecrets = Array.from(state.discoveredSecrets)
    .sort()
    .join(",");

  // Sorted unlocked exits
  const sortedExits = Array.from(state.unlockedExits)
    .sort()
    .join(",");

  return `${loc}|flags:[${sortedFlags}]|inv:[${sortedInv}]|hp:${hpBucket}|secrets:[${sortedSecrets}]|exits:[${sortedExits}]`;
}

/**
 * Checks if the state meets the adventure's quest completion or victory conditions.
 */
export function isQuestComplete(adventure: VersionedAdventure, state: GameState): boolean {
  if (state.gameEnded && state.gameOutcome === "victory") {
    return true;
  }

  const curLoc = adventure.adventure.locations.find((l) => l.id === state.currentLocationId);
  const isEscapeTunnel = curLoc?.id === "escape-tunnel";
  const isVictoryLocation =
    isEscapeTunnel ||
    (curLoc as any)?.tags?.includes("victory") ||
    curLoc?.presentation?.ambienceTags?.includes("victory");

  let questsCompleted = false;
  const quests = adventure.adventure.quests || [];
  if (quests.length > 0) {
    questsCompleted = quests.every((q) => {
      const cond = q.completionCondition;
      if (!cond) return false;
      if (cond.kind === "always") return true;
      if (cond.kind === "flag") return !!state.flags.get(cond.flag);
      if (cond.kind === "hasItem") return state.inventory.has(cond.itemId);
      return false;
    });
  }

  return Boolean(isVictoryLocation || (quests.length > 0 && questsCompleted));
}

/**
 * Enumerates all legal actions available from the current game state.
 */
export function enumerateLegalActions(
  adventure: VersionedAdventure,
  state: GameState
): GameAction[] {
  if (state.gameEnded) return [];

  const curLoc = adventure.adventure.locations.find((l) => l.id === state.currentLocationId);
  if (!curLoc) return [];

  const actions: GameAction[] = [];

  // 1. Encounter / Combat action
  if (curLoc.encounter) {
    const encId = curLoc.encounter.id;
    const isDefeated =
      state.flags.get(`encounter-defeated-${encId}`) ||
      state.flags.get("altar-viper-defeated") ||
      (encId === "encounter-high-priest" && state.flags.get("high-priest-defeated"));

    if (!isDefeated) {
      actions.push({ kind: "combatAction", action: "attack" });
      actions.push({ type: "RESOLVE_COMBAT", encounterId: encId });

      // Potions if wounded
      if (state.playerHp < state.playerMaxHp) {
        for (const itemId of state.inventory) {
          if (itemId.includes("potion") || itemId.includes("healing")) {
            actions.push({ kind: "useItem", itemId });
          }
        }
      }
    }
  }

  // 2. Interactables in room
  for (const inter of curLoc.interactables || []) {
    if (!state.flags.get(`inspected-${inter.id}`)) {
      actions.push({ kind: "inspect", targetId: inter.id });
      actions.push({ type: "INSPECT", interactableId: inter.id });
    }

    if (
      inter.physical?.keyItemId &&
      state.inventory.has(inter.physical.keyItemId) &&
      !state.flags.get(`unlocked-${inter.id}`)
    ) {
      actions.push({ kind: "useItem", itemId: inter.physical.keyItemId, targetId: inter.id });
    }
    if (
      inter.physical?.breakDc &&
      state.inventory.has("item-crowbar") &&
      !state.flags.get(`forced-${inter.id}`)
    ) {
      actions.push({ kind: "forceObject", targetId: inter.id, toolItemId: "item-crowbar" });
    }
  }

  // 3. Secrets in room
  for (const sec of curLoc.secrets || []) {
    if (!state.discoveredSecrets.has(sec.id)) {
      actions.push({ kind: "search", targetId: sec.id });
      actions.push({ type: "SEARCH_SECRET", secretId: sec.id });
    }
  }

  // 4. Locked Exits
  for (const exit of curLoc.exits || []) {
    if (exit.locked && !state.unlockedExits.has(exit.id)) {
      if (exit.locked.keyItemId && state.inventory.has(exit.locked.keyItemId)) {
        actions.push({ type: "UNLOCK_EXIT", exitId: exit.id });
        actions.push({ kind: "useItem", itemId: exit.locked.keyItemId, targetId: exit.id });
      }
      if (exit.locked.pickable) {
        actions.push({ type: "UNLOCK_EXIT", exitId: exit.id });
      }
      if (exit.forceDC && state.inventory.has("item-crowbar")) {
        actions.push({ kind: "forceDoor", exitId: exit.id, direction: exit.direction });
      }
    }
  }

  // 5. Exits (Movement)
  for (const exit of curLoc.exits || []) {
    // Visibility check
    if (exit.visibleWhen?.kind === "flag") {
      const requiredVal = exit.visibleWhen.equals ?? true;
      if (Boolean(state.flags.get(exit.visibleWhen.flag)) !== Boolean(requiredVal)) {
        continue;
      }
    }

    actions.push({ kind: "move", direction: exit.direction, exitId: exit.id });
    actions.push({ type: "MOVE", exitId: exit.id });
  }

  // 6. Rest if damaged
  if (state.playerHp < state.playerMaxHp) {
    actions.push({ kind: "rest" });
  }

  // Deduplicate actions
  const seen = new Set<string>();
  const deduped: GameAction[] = [];
  for (const act of actions) {
    const key = JSON.stringify(act);
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(act);
    }
  }

  return deduped;
}

/**
 * Performs Breadth-First Search (BFS) over reachable game states
 * to prove solvability and detect soft-locks / dead-ends.
 */
export function solveAdventure(
  adventure: VersionedAdventure,
  options?: SolverOptions
): SolverResult {
  const startTime = Date.now();
  const maxDepth = options?.maxDepth ?? 100;
  const maxStates = options?.maxStates ?? 5000;
  const seed = options?.seed ?? 42;
  const hpBucketSize = options?.hpBucketSize ?? 5;
  const character =
    options?.character ||
    createStandardCharacter({
      name: "Valeros the Bold",
      race: "human",
      class: "fighter",
      level: 5,
    });

  const baseEngine = new SimulatorEngine(adventure, seed, character);

  // Check initial state
  if (isQuestComplete(adventure, baseEngine.state)) {
    return {
      status: "SOLVABLE",
      solved: true,
      totalStatesVisited: 1,
      shortestPath: [],
      finalState: baseEngine.state,
      deadEnds: [],
      timeElapsedMs: Date.now() - startTime,
    };
  }

  const startHash = hashState(baseEngine.state, hpBucketSize);
  const visited = new Set<string>([startHash]);

  const queue: SolverNode[] = [
    {
      state: baseEngine.state.clone ? baseEngine.state.clone() : cloneGameState(baseEngine.state),
      path: [],
      depth: 0,
    },
  ];

  const deadEnds: SolverDeadEnd[] = [];

  while (queue.length > 0) {
    if (visited.size >= maxStates) {
      return {
        status: "EXHAUSTED",
        solved: false,
        totalStatesVisited: visited.size,
        shortestPath: [],
        deadEnds,
        timeElapsedMs: Date.now() - startTime,
      };
    }

    const current = queue.shift()!;

    if (current.depth >= maxDepth) {
      continue;
    }

    const legalActions = enumerateLegalActions(adventure, current.state);
    let producedSuccessor = false;

    for (const action of legalActions) {
      const stepEngine = new SimulatorEngine(adventure, seed, character);
      stepEngine.state = current.state.clone ? current.state.clone() : cloneGameState(current.state);
      stepEngine.rng = new SeededRNG(seed + current.depth + 1);

      const result = stepEngine.executeAction(action);
      if (!result.success) {
        continue;
      }

      // Defeat states are not viable pathways
      if (stepEngine.state.gameEnded && stepEngine.state.gameOutcome === "defeat") {
        continue;
      }

      const nextPath = [...current.path, action];

      // Check victory / quest completion
      const solved =
        (stepEngine.state.gameEnded && stepEngine.state.gameOutcome === "victory") ||
        isQuestComplete(adventure, stepEngine.state);

      if (solved) {
        return {
          status: "SOLVABLE",
          solved: true,
          totalStatesVisited: visited.size + 1,
          shortestPath: nextPath,
          finalState: stepEngine.state,
          deadEnds,
          timeElapsedMs: Date.now() - startTime,
        };
      }

      const nextHash = hashState(stepEngine.state, hpBucketSize);
      if (!visited.has(nextHash)) {
        visited.add(nextHash);
        producedSuccessor = true;
        queue.push({
          state: stepEngine.state,
          action,
          path: nextPath,
          depth: current.depth + 1,
        });
      }
    }

    // Dead-end detection:
    // "flag any reachable state where no legal action leads to a new state AND the quest is incomplete (soft-lock)."
    if (!producedSuccessor && !isQuestComplete(adventure, current.state)) {
      deadEnds.push({
        locationId: current.state.currentLocationId,
        state: current.state,
        reason: `Reachable state in '${current.state.currentLocationId}' has no legal actions leading to new unvisited states.`,
        depth: current.depth,
      });
    }
  }

  return {
    status: "UNSOLVABLE",
    solved: false,
    totalStatesVisited: visited.size,
    shortestPath: [],
    deadEnds,
    timeElapsedMs: Date.now() - startTime,
  };
}
