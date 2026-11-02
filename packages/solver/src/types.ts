import { GameAction, GameState } from "@grimoire3d/simulator";
import { PlayerCharacter } from "@grimoire3d/ir";

export type SolverStatus = "SOLVABLE" | "UNSOLVABLE" | "EXHAUSTED" | "MAX_DEPTH_REACHED";

export interface SolverOptions {
  /** Maximum BFS depth (shortest path length). Default: 100 */
  maxDepth?: number;
  /** Maximum number of states to explore. Default: 5000 */
  maxStates?: number;
  /** Seed for SeededRNG. Default: 42 */
  seed?: number;
  /** Starting character. If omitted, standard hero or simulator default is used */
  character?: PlayerCharacter;
  /** HP bucket size for state hashing. Default: 5 */
  hpBucketSize?: number;
}

export interface SolverNode {
  state: GameState;
  action?: GameAction;
  path: GameAction[];
  depth: number;
}

export interface SolverDeadEnd {
  locationId: string;
  state: GameState;
  reason: string;
  depth: number;
}

export interface SolverResult {
  status: SolverStatus;
  solved: boolean;
  totalStatesVisited: number;
  shortestPath: GameAction[];
  finalState?: GameState;
  deadEnds: SolverDeadEnd[];
  timeElapsedMs: number;
}
