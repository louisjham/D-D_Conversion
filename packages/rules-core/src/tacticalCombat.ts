import { SeededRNG } from "./rules";
import { MonsterTemplate } from "@grimoire3d/ir";
import { Spell, SpellEvaluator, CasterState } from "@grimoire3d/spell-core";

export interface GridPos {
  x: number;
  y: number;
}

export type TacticalActionType =
  | "MOVE"
  | "MELEE_ATTACK"
  | "RANGED_ATTACK"
  | "CAST_SPELL"
  | "USE_POTION"
  | "DODGE"
  | "DASH"
  | "DISENGAGE"
  | "END_TURN";

export interface CombatantAttack {
  id: string;
  name: string;
  type: "melee" | "ranged";
  attackBonus: number;
  damageDice: string;
  rangeTiles: number; // 1 for melee, 6+ for ranged
}

export interface TacticalCombatant {
  id: string;
  name: string;
  isPlayer: boolean;
  hp: number;
  maxHp: number;
  ac: number;
  dexModifier: number;
  initiative: number;
  gridPos: GridPos;
  movementSpeedTiles: number;
  movementRemaining: number;
  hasAction: boolean;
  hasBonusAction: boolean;
  hasReaction: boolean;
  isDodging: boolean;
  isDisengaging: boolean;
  attacks: CombatantAttack[];
  spells: Spell[];
  casterState?: CasterState;
  color: string;
  iconName: string;
}

export interface TacticalCombatLogEntry {
  id: string;
  round: number;
  timestamp: string;
  sourceName: string;
  targetName?: string;
  actionType: TacticalActionType;
  message: string;
  rollDetails?: {
    d20Roll: number;
    bonus: number;
    total: number;
    targetAc: number;
    isHit: boolean;
    isCritical: boolean;
    isFumble: boolean;
    damageDealt?: number;
  };
}

export interface TacticalCombatState {
  round: number;
  combatants: TacticalCombatant[];
  turnIndex: number;
  activeCombatantId: string;
  combatEnded: boolean;
  outcome?: "victory" | "defeat";
  gridWidth: number;
  gridHeight: number;
  log: TacticalCombatLogEntry[];
  selectedTargetId?: string;
}

export function findPathBFS(
  start: GridPos,
  target: GridPos,
  bounds: { width: number; height: number },
  occupiedTiles: Set<string>
): GridPos[] | null {
  interface BFSNode {
    pos: GridPos;
    path: GridPos[];
  }

  const queue: BFSNode[] = [{ pos: start, path: [] }];
  const visited = new Set<string>();
  visited.add(`${start.x},${start.y}`);

  // 8 directions for Chebyshev distance
  const dirs = [
    { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
    { x: -1, y: 0 },                   { x: 1, y: 0 },
    { x: -1, y: 1 },  { x: 0, y: 1 },  { x: 1, y: 1 }
  ];

  while (queue.length > 0) {
    const { pos, path } = queue.shift()!;

    if (pos.x === target.x && pos.y === target.y) {
      return path;
    }

    for (const dir of dirs) {
      const nextX = pos.x + dir.x;
      const nextY = pos.y + dir.y;
      
      if (nextX < 0 || nextX >= bounds.width || nextY < 0 || nextY >= bounds.height) {
        continue;
      }
      
      const key = `${nextX},${nextY}`;
      if (visited.has(key)) {
        continue;
      }
      
      // Occupied tiles block path, except the target tile itself
      if (occupiedTiles.has(key) && (nextX !== target.x || nextY !== target.y)) {
        continue;
      }

      visited.add(key);
      const nextPos = { x: nextX, y: nextY };
      queue.push({
        pos: nextPos,
        path: [...path, nextPos]
      });
    }
  }
  
  return null;
}

export class TacticalCombatManager {
  public state: TacticalCombatState;
  private rng: SeededRNG;

  constructor(
    playerStats: {
      name: string;
      hp: number;
      maxHp: number;
      ac: number;
      attackBonus: number;
      damageBonus: number;
    },
    monsters: { template: MonsterTemplate; count: number }[],
    seed: number = 42
  ) {
    this.rng = new SeededRNG(seed);
    const combatants: TacticalCombatant[] = [];

    // 1. Initialize Player Combatant
    const playerDexMod = 2; // +2 Dex Mod default
    const playerInit = this.rng.rollD20() + playerDexMod;

    const playerCombatant: TacticalCombatant = {
      id: "player",
      name: playerStats.name || "Hero",
      isPlayer: true,
      hp: playerStats.hp,
      maxHp: playerStats.maxHp,
      ac: playerStats.ac,
      dexModifier: playerDexMod,
      initiative: playerInit,
      gridPos: { x: 1, y: 4 },
      movementSpeedTiles: 6, // 30ft
      movementRemaining: 6,
      hasAction: true,
      hasBonusAction: true,
      hasReaction: true,
      isDodging: false,
      isDisengaging: false,
      attacks: [
        {
          id: "longsword",
          name: "Longsword",
          type: "melee",
          attackBonus: playerStats.attackBonus,
          damageDice: `1d8+${playerStats.damageBonus}`,
          rangeTiles: 1,
        },
        {
          id: "shortbow",
          name: "Shortbow",
          type: "ranged",
          attackBonus: playerStats.attackBonus,
          damageDice: "1d6+2",
          rangeTiles: 6,
        },
      ],
      spells: [
        {
          id: "magic-missile",
          name: "Magic Missile",
          school: "evocation",
          level: 1,
          manaCost: 2,
          kind: "damage",
          targetType: "singleTarget",
          diceFormula: "3d4+3",
          scaleWithCasterLevel: true,
          allowedClasses: ["wizard"],
          description: "Unmissable darts of magical energy.",
        },
        {
          id: "cure-wounds",
          name: "Cure Wounds",
          school: "abjuration",
          level: 1,
          manaCost: 2,
          kind: "healing",
          targetType: "self",
          diceFormula: "1d8+3",
          scaleWithCasterLevel: true,
          allowedClasses: ["cleric"],
          description: "Healing energy restores hit points.",
        },
      ],
      casterState: {
        characterName: playerStats.name,
        characterClass: "Fighter",
        level: 3,
        currentMana: 6,
        maxMana: 6,
        activeStatusEffects: [],
      },
      color: "#10b981", // Emerald
      iconName: "Shield",
    };
    combatants.push(playerCombatant);

    // 2. Initialize Monster Combatants
    let monsterCounter = 1;
    let spawnY = 2;
    for (const group of monsters) {
      for (let i = 0; i < group.count; i++) {
        const m = group.template;
        const mInit = this.rng.rollD20() + 1;
        const mId = `monster-${monsterCounter++}`;
        const mCombatant: TacticalCombatant = {
          id: mId,
          name: group.count > 1 ? `${m.name} ${i + 1}` : m.name,
          isPlayer: false,
          hp: m.hp,
          maxHp: m.hp,
          ac: m.ac,
          dexModifier: 1,
          initiative: mInit,
          gridPos: { x: 8, y: spawnY },
          movementSpeedTiles: 6,
          movementRemaining: 6,
          hasAction: true,
          hasBonusAction: true,
          hasReaction: true,
          isDodging: false,
          isDisengaging: false,
          attacks: [
            {
              id: `${mId}-attack`,
              name: m.name.includes("Archer") ? "Shortbow" : "Scimitar",
              type: m.name.includes("Archer") ? "ranged" : "melee",
              attackBonus: m.attackBonus ?? 3,
              damageDice: m.damageRoll || "1d6+1",
              rangeTiles: m.name.includes("Archer") ? 6 : 1,
            },
          ],

          spells: [],
          color: "#ef4444", // Crimson
          iconName: "Skull",
        };
        combatants.push(mCombatant);
        spawnY = (spawnY + 3) % 9;
      }
    }

    // 3. Sort by Initiative descending
    combatants.sort((a, b) => b.initiative - a.initiative);

    this.state = {
      round: 1,
      combatants,
      turnIndex: 0,
      activeCombatantId: combatants[0].id,
      combatEnded: false,
      gridWidth: 10,
      gridHeight: 9,
      log: [
        {
          id: `log-${Date.now()}-init`,
          round: 1,
          timestamp: new Date().toLocaleTimeString(),
          sourceName: "SYSTEM",
          actionType: "END_TURN",
          message: `⚔️ Tactical Combat Started! Initiative Order: ${combatants.map((c) => `${c.name} (${c.initiative})`).join(", ")}`,
        },
      ],
    };
  }

  public getActiveCombatant(): TacticalCombatant {
    return this.state.combatants[this.state.turnIndex];
  }

  /**
   * Calculates distance between two grid positions in tiles (Chebyshev / D&D 5e 5ft diagonal rules).
   */
  public static calculateDistance(posA: GridPos, posB: GridPos): number {
    return Math.max(Math.abs(posA.x - posB.x), Math.abs(posA.y - posB.y));
  }

  /**
   * Executes movement for active combatant to a target tile.
   */
  public moveActiveCombatant(targetPos: GridPos): boolean {
    const active = this.getActiveCombatant();
    if (this.state.combatEnded) return false;

    const dist = TacticalCombatManager.calculateDistance(active.gridPos, targetPos);
    if (dist <= 0 || dist > active.movementRemaining) return false;

    // Check tile occupancy
    const occupied = this.state.combatants.some(
      (c) => c.hp > 0 && c.gridPos.x === targetPos.x && c.gridPos.y === targetPos.y
    );
    if (occupied) return false;

    active.gridPos = { ...targetPos };
    active.movementRemaining -= dist;

    this.addLog(active.name, undefined, "MOVE", `Moved ${dist * 5}ft to position (${targetPos.x}, ${targetPos.y}).`);
    return true;
  }

  /**
   * Executes a weapon attack action against a target combatant.
   */
  public executeAttack(attackId: string, targetId: string): boolean {
    const active = this.getActiveCombatant();
    if (!active.hasAction || this.state.combatEnded) return false;

    const target = this.state.combatants.find((c) => c.id === targetId && c.hp > 0);
    if (!target) return false;

    const attack = active.attacks.find((a) => a.id === attackId) || active.attacks[0];
    if (!attack) return false;

    const dist = TacticalCombatManager.calculateDistance(active.gridPos, target.gridPos);
    if (dist > attack.rangeTiles) return false;

    active.hasAction = false;

    // Roll Attack
    const d20Roll = this.rng.rollD20();
    const isCritical = d20Roll === 20;
    const isFumble = d20Roll === 1;
    const effectiveAc = target.isDodging ? target.ac + 2 : target.ac;
    const totalRoll = d20Roll + attack.attackBonus;
    const isHit = isCritical || (!isFumble && totalRoll >= effectiveAc);

    let damageDealt = 0;
    if (isHit) {
      damageDealt = this.rollDiceFormula(attack.damageDice);
      if (isCritical) damageDealt += this.rollDiceFormula(attack.damageDice); // Double dice on Crit
      target.hp = Math.max(0, target.hp - damageDealt);
    }

    const hitMsg = isHit
      ? `HIT ${target.name} for ${damageDealt} ${attack.type} damage! (${target.hp}/${target.maxHp} HP)`
      : `MISSED ${target.name} (AC ${effectiveAc}).`;

    this.addLog(active.name, target.name, attack.type === "melee" ? "MELEE_ATTACK" : "RANGED_ATTACK", `${attack.name}: d20(${d20Roll}) + ${attack.attackBonus} = ${totalRoll} vs AC ${effectiveAc} -> ${hitMsg}`, {
      d20Roll,
      bonus: attack.attackBonus,
      total: totalRoll,
      targetAc: effectiveAc,
      isHit,
      isCritical,
      isFumble,
      damageDealt,
    });

    this.checkCombatState();
    return true;
  }

  /**
   * Casts a spell from spell-core.
   */
  public executeCastSpell(spellId: string, targetId?: string): boolean {
    const active = this.getActiveCombatant();
    if (!active.hasAction || !active.spells || active.spells.length === 0 || this.state.combatEnded) return false;

    const spell = active.spells.find((s) => s.id === spellId);
    if (!spell) return false;

    if (active.casterState && active.casterState.currentMana < spell.manaCost) return false;

    active.hasAction = false;
    if (active.casterState) {
      active.casterState.currentMana -= spell.manaCost;
    }

    if (spell.kind === "healing") {
      const healAmount = this.rollDiceFormula(spell.diceFormula);
      active.hp = Math.min(active.maxHp, active.hp + healAmount);
      this.addLog(active.name, active.name, "CAST_SPELL", `Cast ${spell.name} healing self for +${healAmount} HP (${active.hp}/${active.maxHp} HP)!`);
    } else {
      const target = this.state.combatants.find((c) => c.id === targetId && c.hp > 0) || this.getOpponents(active)[0];
      if (target) {
        const damage = this.rollDiceFormula(spell.diceFormula);
        target.hp = Math.max(0, target.hp - damage);
        this.addLog(active.name, target.name, "CAST_SPELL", `Cast ${spell.name} blasting ${target.name} for ${damage} magical damage! (${target.hp}/${target.maxHp} HP)`);
      }
    }

    this.checkCombatState();
    return true;
  }

  /**
   * Drinks a Health Potion.
   */
  public executeUsePotion(): boolean {
    const active = this.getActiveCombatant();
    if (!active.hasBonusAction || this.state.combatEnded) return false;

    active.hasBonusAction = false;
    const heal = this.rng.rollDice(4) + this.rng.rollDice(4) + 2; // 2d4+2 Potion of Healing
    active.hp = Math.min(active.maxHp, active.hp + heal);

    this.addLog(active.name, active.name, "USE_POTION", `Drank Healing Potion restoring +${heal} HP (${active.hp}/${active.maxHp} HP)!`);
    return true;
  }

  /**
   * Tactical Dodge action.
   */
  public executeDodge(): boolean {
    const active = this.getActiveCombatant();
    if (!active.hasAction || this.state.combatEnded) return false;

    active.hasAction = false;
    active.isDodging = true;
    this.addLog(active.name, undefined, "DODGE", "Adopted a Defensive Stance (+2 AC vs incoming attacks).");
    return true;
  }

  public endTurn(): void {
    if (this.state.combatEnded) return;

    let nextIndex = this.state.turnIndex;
    let nextActive = this.getActiveCombatant();
    let loopCount = 0;
    const numCombatants = this.state.combatants.length;

    do {
      nextIndex = (nextIndex + 1) % numCombatants;
      if (nextIndex === 0) {
        this.state.round++;
      }
      nextActive = this.state.combatants[nextIndex];
      loopCount++;
    } while (nextActive.hp <= 0 && loopCount < numCombatants);

    if (loopCount >= numCombatants && nextActive.hp <= 0) {
      this.state.combatEnded = true;
      return;
    }

    this.state.turnIndex = nextIndex;

    // Reset turn action budget
    nextActive.movementRemaining = nextActive.movementSpeedTiles;
    nextActive.hasAction = true;
    nextActive.hasBonusAction = true;
    nextActive.hasReaction = true;
    nextActive.isDodging = false;
    nextActive.isDisengaging = false;

    this.state.activeCombatantId = nextActive.id;

    // AI Turn Auto-Execution if monster
    if (!nextActive.isPlayer) {
      this.executeMonsterAiTurn(nextActive);
    }
  }

  private executeMonsterAiTurn(monster: TacticalCombatant): void {
    const player = this.state.combatants.find((c) => c.isPlayer && c.hp > 0);
    if (!player) return;

    const dist = TacticalCombatManager.calculateDistance(monster.gridPos, player.gridPos);
    const attack = monster.attacks[0];

    // Move closer if out of reach
    if (dist > attack.rangeTiles && monster.movementRemaining > 0) {
      const occupiedTiles = new Set<string>();
      for (const c of this.state.combatants) {
        if (c.hp > 0 && c.id !== monster.id) {
          occupiedTiles.add(`${c.gridPos.x},${c.gridPos.y}`);
        }
      }

      const path = findPathBFS(
        monster.gridPos,
        player.gridPos,
        { width: this.state.gridWidth, height: this.state.gridHeight },
        occupiedTiles
      );

      if (path && path.length > 0) {
        let targetStep = monster.gridPos;
        
        for (let i = 0; i < path.length; i++) {
          const stepPos = path[i];
          
          if (stepPos.x === player.gridPos.x && stepPos.y === player.gridPos.y) {
            break; 
          }
          
          if (i + 1 > monster.movementRemaining) {
            break;
          }
          
          targetStep = stepPos;
          
          const distToTarget = TacticalCombatManager.calculateDistance(stepPos, player.gridPos);
          if (distToTarget <= attack.rangeTiles) {
            break;
          }
        }
        
        if (targetStep.x !== monster.gridPos.x || targetStep.y !== monster.gridPos.y) {
          this.moveActiveCombatant(targetStep);
        }
      }
    }

    // Attack if in range
    const newDist = TacticalCombatManager.calculateDistance(monster.gridPos, player.gridPos);
    if (newDist <= attack.rangeTiles && monster.hasAction) {
      this.executeAttack(attack.id, player.id);
    }

    // End Monster Turn
    this.endTurn();
  }

  private getOpponents(combatant: TacticalCombatant): TacticalCombatant[] {
    return this.state.combatants.filter((c) => c.isPlayer !== combatant.isPlayer && c.hp > 0);
  }

  private checkCombatState(): void {
    const playerAlive = this.state.combatants.some((c) => c.isPlayer && c.hp > 0);
    const monstersAlive = this.state.combatants.some((c) => !c.isPlayer && c.hp > 0);

    if (!playerAlive) {
      this.state.combatEnded = true;
      this.state.outcome = "defeat";
      this.addLog("SYSTEM", undefined, "END_TURN", "☠️ Defeat! Player was overcome in combat.");
    } else if (!monstersAlive) {
      this.state.combatEnded = true;
      this.state.outcome = "victory";
      this.addLog("SYSTEM", undefined, "END_TURN", "🏆 Victory! All enemy monsters defeated!");
    }
  }

  private rollDiceFormula(diceStr: string): number {
    const cleanStr = diceStr.replace(/\s+/g, '');
    const match = /^(\d+)d(\d+)(?:([+-])(\d+))?$/i.exec(cleanStr);
    if (!match) return this.rng.rollDice(6);
    const count = parseInt(match[1], 10);
    const sides = parseInt(match[2], 10);
    const sign = match[3];
    const mod = match[4] ? parseInt(match[4], 10) : 0;
    let total = 0;
    for (let i = 0; i < count; i++) {
      total += this.rng.rollDice(sides);
    }
    if (sign === "+") total += mod;
    if (sign === "-") total -= mod;
    return Math.max(1, total);
  }

  private addLog(
    sourceName: string,
    targetName: string | undefined,
    actionType: TacticalActionType,
    message: string,
    rollDetails?: TacticalCombatLogEntry["rollDetails"]
  ): void {
    this.state.log.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      round: this.state.round,
      timestamp: new Date().toLocaleTimeString(),
      sourceName,
      targetName,
      actionType,
      message,
      rollDetails,
    });
  }
}
