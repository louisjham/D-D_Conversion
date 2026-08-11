import { Condition, Effect, MonsterTemplate } from "@grimoire3d/ir";

// --- Seeded PRNG (Mulberry32) ---
export class SeededRNG {
  private state: number;

  constructor(seed: number = 12345) {
    this.state = seed;
  }

  public nextFloat(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  public rollD20(): number {
    return Math.floor(this.nextFloat() * 20) + 1;
  }

  public rollDice(sides: number): number {
    return Math.floor(this.nextFloat() * sides) + 1;
  }
}

export type CheckResult = {
  success: boolean;
  roll: number;
  bonus: number;
  total: number;
  dc: number;
  isNat20: boolean;
  isNat1: boolean;
};

export function resolveCheck(dc: number, bonus: number, rng: SeededRNG): CheckResult {
  const roll = rng.rollD20();
  const isNat20 = roll === 20;
  const isNat1 = roll === 1;
  const total = roll + bonus;
  const success = isNat20 || (!isNat1 && total >= dc);

  return { success, roll, bonus, total, dc, isNat20, isNat1 };
}

export function evaluateCondition(
  condition: Condition,
  stateFlags: Map<string, boolean>,
  inventoryItems: Set<string>
): boolean {
  switch (condition.kind) {
    case "always":
      return true;
    case "flag":
      return (stateFlags.get(condition.flag) ?? false) === condition.equals;
    case "hasItem":
      return inventoryItems.has(condition.itemId);
    case "checkPassed":
      return stateFlags.get(`check-${condition.checkId}`) ?? false;
  }
}

export type CombatResult = {
  victory: boolean;
  rounds: number;
  playerHpRemaining: number;
  log: string[];
};

export function resolveSimpleCombat(
  monster: MonsterTemplate,
  count: number,
  playerStats: { hp: number; ac: number; attackBonus: number; damageBonus: number },
  rng: SeededRNG
): CombatResult {
  let playerHp = playerStats.hp;
  let totalEnemyHp = monster.hp * count;
  let round = 0;
  const log: string[] = [];

  log.push(`Combat started against ${count}x ${monster.name} (Total HP: ${totalEnemyHp})`);

  while (playerHp > 0 && totalEnemyHp > 0 && round < 20) {
    round++;

    // Player Attack
    const playerRoll = rng.rollD20();
    const playerHit = playerRoll === 20 || (playerRoll !== 1 && playerRoll + playerStats.attackBonus >= monster.ac);
    if (playerHit) {
      const dmg = rng.rollDice(6) + playerStats.damageBonus;
      totalEnemyHp -= dmg;
      log.push(`Round ${round}: You hit ${monster.name} for ${dmg} damage! (${Math.max(0, totalEnemyHp)} HP remaining)`);
    } else {
      log.push(`Round ${round}: You missed ${monster.name} (rolled ${playerRoll}).`);
    }

    if (totalEnemyHp <= 0) break;

    // Enemy Attack
    const enemyRoll = rng.rollD20();
    const enemyHit = enemyRoll === 20 || (enemyRoll !== 1 && enemyRoll + monster.attackBonus >= playerStats.ac);
    if (enemyHit) {
      const dmg = rng.rollDice(6);
      playerHp -= dmg;
      log.push(`Round ${round}: ${monster.name} hits you for ${dmg} damage! (${Math.max(0, playerHp)} HP remaining)`);
    } else {
      log.push(`Round ${round}: ${monster.name} missed you (rolled ${enemyRoll}).`);
    }
  }

  const victory = totalEnemyHp <= 0 && playerHp > 0;
  log.push(victory ? `Victory! ${monster.name} defeated.` : `Defeat! You were overwhelmed.`);

  return {
    victory,
    rounds: round,
    playerHpRemaining: Math.max(0, playerHp),
    log,
  };
}

// --- RulesProfile Interface ---
export interface RulesProfile {
  readonly id: string;
  readonly version: string;
  resolveAction(
    state: any,
    action: any,
    rng: SeededRNG
  ): { success: boolean; message: string; events: any[] };
}
