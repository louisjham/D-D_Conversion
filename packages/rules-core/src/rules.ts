import { Condition, Effect, MonsterTemplate } from "@grimoire3d/ir";
import { executeMonsterAI } from "./monsterAI";

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

  public clone(): SeededRNG {
    const copy = new SeededRNG(0);
    (copy as any).state = this.state;
    return copy;
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
  damageDealtByMonster: number;
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
  let damageDealtByMonster = 0;
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

    // Enemy Attack using Monster Manual AI
    const remainingEnemies = Math.ceil(totalEnemyHp / monster.hp);
    const aiDecision = executeMonsterAI(
      monster,
      Math.min(monster.hp, totalEnemyHp),
      { hp: playerHp, ac: playerStats.ac },
      remainingEnemies,
      rng
    );

    if (aiDecision.breaksMorale) {
      log.push(`Round ${round}: ${aiDecision.description}`);
      totalEnemyHp = 0; // Monster broke rank and fled!
      break;
    }

    // Roll Enemy Attack (with Advantage if flanking/pack tactics!)
    let enemyRoll = rng.rollD20();
    if (aiDecision.hasAdvantage) {
      enemyRoll = Math.max(enemyRoll, rng.rollD20());
    }

    const enemyHit = enemyRoll === 20 || (enemyRoll !== 1 && enemyRoll + monster.attackBonus >= playerStats.ac);
    if (enemyHit) {
      const dmg = rng.rollDice(6) + aiDecision.bonusDamage;
      playerHp -= dmg;
      damageDealtByMonster += dmg;
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
    damageDealtByMonster,
  };
}

// --- PHB Exploration Rules: Listen at Door Check ---
export function resolveListenCheck(
  rng: SeededRNG,
  bonus: number = 0,
  dc: number = 12
): { success: boolean; roll: number; total: number; message: string } {
  const roll = rng.rollD20();
  const total = roll + bonus;
  const success = roll === 20 || (roll !== 1 && total >= dc);
  return {
    success,
    roll,
    total,
    message: success
      ? `Listen check succeeded (rolled ${total} vs DC ${dc}). Faint movement and breathing detected.`
      : `Listen check failed (rolled ${total} vs DC ${dc}). You hear only silence beyond the portal.`,
  };
}

// --- PHB Exploration Rules: Force Open Stuck / Heavy Doors ---
export function resolveOpenDoors(
  rng: SeededRNG,
  strengthScore: number = 14,
  forceDC: number = 14
): { success: boolean; roll: number; message: string } {
  // AD&D Open Doors on d6 (STR 14 = 1-2 on d6; D20 equivalent DC 14 with +2 mod)
  const strBonus = Math.floor((strengthScore - 10) / 2);
  const roll = rng.rollD20();
  const total = roll + strBonus;
  const success = roll === 20 || (roll !== 1 && total >= forceDC);
  return {
    success,
    roll: total,
    message: success
      ? `With a heave of shoulder, the door shudders and bursts open with a loud wooden crack!`
      : `You slam against the door, but the warped timber holds fast.`,
  };
}

// --- DMG World Rules: Wandering Monster Check ---
export function resolveDmgWanderingCheck(
  rng: SeededRNG,
  chanceOnD6: number = 1,
  isNoisyAction: boolean = false
): { triggered: boolean; roll: number; threshold: number } {
  const roll = rng.rollDice(6);
  // Noisy actions (forcing a door, combat) increase wandering patrol chances
  const threshold = isNoisyAction ? Math.min(6, chanceOnD6 + 1) : chanceOnD6;
  return {
    triggered: roll <= threshold,
    roll,
    threshold,
  };
}

// --- DMG Encounter Rules: 2d6 Monster Reaction Roll ---
export type MonsterDisposition = "hostile" | "cautious" | "neutral" | "friendly";

export function resolveDmgReactionRoll(
  rng: SeededRNG,
  charismaMod: number = 0
): { reaction: MonsterDisposition; roll: number; description: string } {
  const d1 = rng.rollDice(6);
  const d2 = rng.rollDice(6);
  const total = d1 + d2 + charismaMod;

  if (total <= 5) {
    return { reaction: "hostile", roll: total, description: "Monsters brandish weapons and attack immediately!" };
  } else if (total <= 8) {
    return { reaction: "cautious", roll: total, description: "Monsters hold their ground warily with weapons drawn, growling warnings." };
  } else if (total <= 11) {
    return { reaction: "neutral", roll: total, description: "Monsters pause, willing to listen to a parley or bribe offer." };
  } else {
    return { reaction: "friendly", roll: total, description: "Monsters lower weapons, receptive to negotiation or retreat." };
  }
}

// --- DMG Encounter Rules: Morale Check ---
export function resolveDmgMoraleCheck(
  rng: SeededRNG,
  baseMorale: number = 7
): { breaks: boolean; roll: number; message: string } {
  const d1 = rng.rollDice(6);
  const d2 = rng.rollDice(6);
  const total = d1 + d2;
  const breaks = total > baseMorale;
  return {
    breaks,
    roll: total,
    message: breaks
      ? `Morale broken! Rolled ${total} vs Morale ${baseMorale}. The monsters panic and attempt to flee!`
      : `Morale holds firm! Rolled ${total} vs Morale ${baseMorale}. They continue fighting.`,
  };
}

// --- DMG World Rules: Environmental Hazard Save ---
export function resolveEnvironmentalHazard(
  rng: SeededRNG,
  hazard: { type: string; dc: number; damage?: string },
  saveBonus: number = 2
): { avoided: boolean; damageDealt: number; message: string } {
  const roll = rng.rollD20();
  const total = roll + saveBonus;
  const avoided = roll === 20 || (roll !== 1 && total >= hazard.dc);
  let damageDealt = 0;
  if (!avoided && hazard.damage) {
    damageDealt = rng.rollDice(6); // default 1d6
  }
  return {
    avoided,
    damageDealt,
    message: avoided
      ? `Hazard avoided! Rolled ${total} vs DC ${hazard.dc}.`
      : `Hazard failed! Rolled ${total} vs DC ${hazard.dc}. Suffered ${damageDealt} damage.`,
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
