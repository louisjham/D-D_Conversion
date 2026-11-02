import { VersionedAdventure, Location, Exit, Interactable, Secret, Encounter, RandomTableEntry, PlayerCharacter, Item } from "@grimoire3d/ir";
import {
  SeededRNG,
  resolveCheck,
  resolveSimpleCombat,
  resolveListenCheck,
  resolveOpenDoors,
  resolveDmgWanderingCheck,
  resolveDmgReactionRoll,
  resolveDmgMoraleCheck,
  resolveEnvironmentalHazard,
  createStandardCharacter,
  calcAbilityMod,
  useSecondWind,
  resolveShortRest,
  resolveLongRest,
  damageObject,
  resolveBreakAttempt,
  resolveLockpickAttempt,
  resolveAlchemicalSubstance,
  calcArmsAndEquipmentWeapon,
  calcObjectDurability,
  STANDARD_EQUIPMENT_CATALOG,
} from "@grimoire3d/rules-core";

export function parseAndRollDice(diceStr: string, rng: SeededRNG): number {
  const cleanStr = diceStr.replace(/\s+/g, '');
  const match = /^(\d+)d(\d+)(?:([+-])(\d+))?$/i.exec(cleanStr);
  if (!match) return rng.rollDice(6);
  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const sign = match[3];
  const mod = match[4] ? parseInt(match[4], 10) : 0;
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += rng.rollDice(sides);
  }
  if (sign === "+") total += mod;
  if (sign === "-") total -= mod;
  return total;
}

export type DomainEvent =
  | { kind: "player_moved"; fromRoomId: string; toRoomId: string; exitId: string }
  | { kind: "room_discovered"; roomId: string; label: string }
  | { kind: "fog_revealed"; roomId: string }
  | { kind: "item_granted"; itemId: string; source: string }
  | { kind: "item_used"; itemId: string; targetId?: string }
  | { kind: "secret_discovered"; secretId: string; perceptionDC: number; rollTotal: number }
  | { kind: "exit_unlocked"; exitId: string; method: "key" | "lockpick" }
  | { kind: "check_resolved"; ability: string; dc: number; roll: number; success: boolean }
  | { kind: "trap_triggered"; interactableId: string; disarmed: boolean }
  | { kind: "combat_started"; encounterId: string; monsterName: string }
  | { kind: "combat_round_resolved"; round: number; playerHp: number; enemyHp: number }
  | { kind: "combat_ended"; encounterId: string; victory: boolean }
  | { kind: "quest_updated"; questId: string; status: "started" | "completed" }
  | { kind: "random_table_rolled"; tableId: string; tableName: string; rollResult: number; entryResult: string }
  | { kind: "wandering_encounter_triggered"; tableId: string; entityId?: string; encounterText: string }
  | { kind: "listen_attempted"; exitId: string; heard: boolean; notice?: string }
  | { kind: "door_forced"; exitId: string; success: boolean; noiseAlerted: boolean }
  | { kind: "parley_attempted"; disposition: "hostile" | "cautious" | "neutral" | "friendly"; roll: number }
  | { kind: "hazard_encountered"; hazardId: string; avoided: boolean; damage: number }
  | { kind: "object_damaged"; interactableId: string; damage: number; remainingHp: number; isDestroyed: boolean }
  | { kind: "object_forced"; interactableId: string; success: boolean }
  | { kind: "alchemical_used"; itemId: string; substanceType: string; targetId?: string }
  | { kind: "game_ended"; outcome: "victory" | "defeat" };

export type Direction = "north" | "south" | "east" | "west" | "up" | "down";
export type InteractionVerb = "inspect" | "open" | "disarm" | "search" | "take" | "talk";
export type CombatActionType = "attack" | "defend" | "flee" | "useItem";

export type GameAction =
  | { kind: "move"; direction?: Direction; exitId?: string }
  | { kind: "inspect"; targetId: string }
  | { kind: "search"; targetId: string }
  | { kind: "interact"; targetId: string; verb: InteractionVerb }
  | { kind: "useItem"; itemId: string; targetId?: string }
  | { kind: "attackObject"; targetId: string; weaponItemId?: string }
  | { kind: "forceObject"; targetId: string; toolItemId?: string }
  | { kind: "combatAction"; action: CombatActionType }
  | { kind: "rollTable"; tableId: string }
  | { kind: "rest" }
  | { kind: "useSecondWind" }
  | { kind: "longRest" }
  | { kind: "listen"; exitId?: string; direction?: Direction }
  | { kind: "forceDoor"; exitId?: string; direction?: Direction }
  | { kind: "searchTraps" }
  | { kind: "parley" }
  | { kind: "flee" }
  | { kind: "unlockExit"; exitId: string }
  | { kind: "resolveCombat"; encounterId: string }
  | { kind: "pickupItem"; itemId: string };

export type GameState = {
  currentLocationId: string;
  inventory: Set<string>;
  flags: Map<string, boolean>;
  playerHp: number;
  playerMaxHp: number;
  playerAc: number;
  playerAttackBonus: number;
  playerCharacter: PlayerCharacter;
  discoveredSecrets: Set<string>;
  unlockedExits: Set<string>;
  discoveredRooms: Set<string>;
  actionLog: string[];
  emittedEvents: DomainEvent[];
  inCombat: boolean;
  activeCombatEncounterId?: string;
  gameEnded: boolean;
  gameOutcome?: "victory" | "defeat";
  seed: number;
  turnCount: number;
  clone?: () => GameState;
};

export function cloneGameState(state: GameState): GameState {
  const cloned: GameState = {
    currentLocationId: state.currentLocationId,
    inventory: new Set(state.inventory),
    flags: new Map(state.flags),
    playerHp: state.playerHp,
    playerMaxHp: state.playerMaxHp,
    playerAc: state.playerAc,
    playerAttackBonus: state.playerAttackBonus,
    playerCharacter: {
      ...state.playerCharacter,
      abilities: { ...state.playerCharacter.abilities },
    },
    discoveredSecrets: new Set(state.discoveredSecrets),
    unlockedExits: new Set(state.unlockedExits),
    discoveredRooms: new Set(state.discoveredRooms),
    actionLog: [...state.actionLog],
    emittedEvents: [...state.emittedEvents],
    inCombat: state.inCombat,
    activeCombatEncounterId: state.activeCombatEncounterId,
    gameEnded: state.gameEnded,
    gameOutcome: state.gameOutcome,
    seed: state.seed,
    turnCount: state.turnCount,
    clone() {
      return cloneGameState(this);
    },
  };
  return cloned;
}

export class SimulatorEngine {
  public state: GameState;
  public adventure: VersionedAdventure;
  public rng: SeededRNG;
  private locationMap: Map<string, Location>;

  constructor(vAdventure: VersionedAdventure, seed: number = 42, customCharacter?: PlayerCharacter) {
    this.adventure = vAdventure;
    this.rng = new SeededRNG(seed);
    this.locationMap = new Map(vAdventure.adventure.locations.map((l) => [l.id, l]));

    const startId = vAdventure.adventure.start;
    const startLoc = this.locationMap.get(startId);
    const character =
      customCharacter ||
      createStandardCharacter({
        name: "Valeros the Bold",
        race: "human",
        class: "fighter",
        level: 1,
      });

    const discoveredRooms = new Set<string>([startId]);

    this.state = {
      currentLocationId: startId,
      inventory: new Set<string>(),
      flags: new Map<string, boolean>(),
      playerHp: character.hp,
      playerMaxHp: character.maxHp,
      playerAc: character.ac,
      playerAttackBonus: 2 + calcAbilityMod(character.abilities.str),
      playerCharacter: character,
      discoveredSecrets: new Set<string>(),
      unlockedExits: new Set<string>(),
      discoveredRooms,
      actionLog: [`Entered ${startLoc ? startLoc.label : startId}`],
      emittedEvents: [
        { kind: "room_discovered", roomId: startId, label: startLoc ? startLoc.label : startId },
        { kind: "fog_revealed", roomId: startId },
      ],
      inCombat: false,
      gameEnded: false,
      seed,
      turnCount: 0,
      clone() {
        return cloneGameState(this);
      },
    };
  }

  public clone(): SimulatorEngine {
    const cloned = new SimulatorEngine(this.adventure, this.state.seed, this.state.playerCharacter);
    cloned.state = this.state.clone ? this.state.clone() : cloneGameState(this.state);
    cloned.rng = this.rng.clone();
    return cloned;
  }

  public checkQuestCompletion(): boolean {
    if (this.state.gameEnded) {
      return this.state.gameOutcome === "victory";
    }

    const curLoc = this.getCurrentLocation();
    const isEscapeTunnel = curLoc.id === "escape-tunnel";
    const isVictoryLocation =
      isEscapeTunnel ||
      (curLoc as any).tags?.includes("victory") ||
      curLoc.presentation?.ambienceTags?.includes("victory");

    let questsCompleted = false;
    const quests = this.adventure.adventure.quests || [];
    if (quests.length > 0) {
      questsCompleted = quests.every((q) => {
        const cond = q.completionCondition;
        if (!cond) return false;
        if (cond.kind === "always") return true;
        if (cond.kind === "flag") return !!this.state.flags.get(cond.flag);
        if (cond.kind === "hasItem") return this.state.inventory.has(cond.itemId);
        return false;
      });
    }

    if (isVictoryLocation || (quests.length > 0 && questsCompleted)) {
      if (isEscapeTunnel) {
        this.state.flags.set("escaped-crypt", true);
      }
      this.state.gameEnded = true;
      this.state.gameOutcome = "victory";

      if (isEscapeTunnel) {
        this.emit({ kind: "quest_updated", questId: "escape-crypt", status: "completed" });
      }
      quests.forEach((q) => {
        if (questsCompleted) this.emit({ kind: "quest_updated", questId: q.id, status: "completed" });
      });

      this.emit({ kind: "game_ended", outcome: "victory" });

      const victoryText = isEscapeTunnel
        ? "VICTORY! You escaped the Serpent Altar Crypt!"
        : "VICTORY! You have completed the adventure!";
      this.state.actionLog.push(victoryText);
      return true;
    }

    return false;
  }

  public evaluateRandomTable(tableId: string): { roll: number; entry?: RandomTableEntry; event?: DomainEvent } {
    const tables = this.adventure.adventure.randomTables || [];
    const table = tables.find((t) => t.id === tableId);
    if (!table) return { roll: 0 };

    const roll = parseAndRollDice(table.dice, this.rng);
    const entry = table.entries.find((e) => roll >= e.range[0] && roll <= e.range[1]);

    const entryDesc = entry ? (entry.result.text || entry.result.entityId || entry.result.kind) : "No effect";
    const event: DomainEvent = {
      kind: "random_table_rolled",
      tableId: table.id,
      tableName: table.name,
      rollResult: roll,
      entryResult: entryDesc,
    };
    this.emit(event);

    if (entry) {
      if (entry.result.kind === "encounter") {
        this.emit({
          kind: "wandering_encounter_triggered",
          tableId: table.id,
          entityId: entry.result.entityId,
          encounterText: entry.result.text || `Wandering ${entry.result.entityId || "monster"} appeared!`,
        });
        this.state.actionLog.push(`[Table Roll: ${table.name}] Rolled ${roll} -> ${entry.result.text || entry.result.entityId}`);
      } else if (entry.result.kind === "item" && entry.result.entityId) {
        this.state.inventory.add(entry.result.entityId);
        this.emit({ kind: "item_granted", itemId: entry.result.entityId, source: table.id });
        this.state.actionLog.push(`[Table Roll: ${table.name}] Rolled ${roll} -> Granted item '${entry.result.entityId}'`);
      } else if (entry.result.kind === "flag" && entry.result.entityId) {
        this.state.flags.set(entry.result.entityId, true);
        this.state.actionLog.push(`[Table Roll: ${table.name}] Rolled ${roll} -> Set flag '${entry.result.entityId}'`);
      } else {
        this.state.actionLog.push(`[Table Roll: ${table.name}] Rolled ${roll} -> ${entry.result.text || "No effect"}`);
      }
    }

    return { roll, entry, event };
  }

  public getCurrentLocation(): Location {
    const loc = this.locationMap.get(this.state.currentLocationId);
    if (!loc) throw new Error(`Location '${this.state.currentLocationId}' not found.`);
    return loc;
  }

  public emit(event: DomainEvent) {
    this.state.emittedEvents.push(event);
  }

  public executeAction(action: GameAction): {
    success: boolean;
    message: string;
    events: DomainEvent[];
    combatStats?: {
      victory: boolean;
      damageByMonster: Record<string, number>;
    };
  } {
    if (this.state.gameEnded) {
      return { success: false, message: "Game has already ended.", events: [] };
    }

    const curLoc = this.getCurrentLocation();
    const preEventCount = this.state.emittedEvents.length;

    // Normalization of 'kind' actions to engine handlers
    let targetExitId: string | undefined;
    let targetInteractableId: string | undefined;
    let targetSecretId: string | undefined;

    if (action.kind === "move") {
      if (action.exitId) {
        targetExitId = action.exitId;
      } else if (action.direction) {
        const exit = curLoc.exits.find((e) => e.direction === action.direction);
        if (exit) targetExitId = exit.id;
      }
    } else if (action.kind === "inspect" || action.kind === "interact") {
      targetInteractableId = action.targetId;
    } else if (action.kind === "search") {
      targetSecretId = action.targetId;
    }

    // 1. Move Execution
    if (action.kind === "move") {
      const exitId = targetExitId || action.exitId;
      const exit = targetExitId
        ? curLoc.exits.find((e) => e.id === targetExitId)
        : curLoc.exits.find((e) => e.id === exitId || e.direction === action.direction);

      if (!exit) {
        return { success: false, message: `No valid exit in direction ${action.direction || exitId}.`, events: [] };
      }

      // Check secret visibility
      if (exit.visibleWhen?.kind === "flag" && !this.state.flags.get(exit.visibleWhen.flag)) {
        return { success: false, message: `Exit is hidden behind secret seam.`, events: [] };
      }

      // Check locked
      if (exit.locked && !this.state.unlockedExits.has(exit.id)) {
        if (exit.locked.keyItemId && this.state.inventory.has(exit.locked.keyItemId)) {
          this.state.unlockedExits.add(exit.id);
          this.emit({ kind: "exit_unlocked", exitId: exit.id, method: "key" });
          this.state.actionLog.push(`Unlocked exit using '${exit.locked.keyItemId}'`);
        } else {
          return { success: false, message: `Exit '${exit.id}' is locked! Key required: ${exit.locked.keyItemId || "Lockpick"}.`, events: [] };
        }
      }

      // Check stuck / barred door states (DMG World Boundary)
      if ((exit.doorState === "stuck" || exit.doorState === "barred") && !this.state.unlockedExits.has(exit.id)) {
        return {
          success: false,
          message: `The door '${exit.id}' is ${exit.doorState}! You must use 'forceDoor' to batter it open before passing.`,
          events: [],
        };
      }

      const targetLoc = this.locationMap.get(exit.target);
      if (!targetLoc) {
        return {
          success: false,
          message: `Destination '${exit.target}' not found in adventure.`,
          events: [],
        };
      }

      const prevRoomId = this.state.currentLocationId;
      this.state.currentLocationId = exit.target;
      const newLoc = targetLoc;

      this.state.discoveredRooms.add(newLoc.id);

      this.emit({ kind: "player_moved", fromRoomId: prevRoomId, toRoomId: newLoc.id, exitId: exit.id });
      this.emit({ kind: "room_discovered", roomId: newLoc.id, label: newLoc.label });
      this.emit({ kind: "fog_revealed", roomId: newLoc.id });

      const msg = `Moved to ${newLoc.label}`;
      this.state.actionLog.push(msg);

      // DMG Environmental Hazard Check
      if (newLoc.boundaries?.hazards && newLoc.boundaries.hazards.length > 0) {
        for (const haz of newLoc.boundaries.hazards) {
          if (!this.state.flags.get(`hazard-${haz.id}-avoided`)) {
            const hazRes = resolveEnvironmentalHazard(this.rng, haz);
            this.emit({ kind: "hazard_encountered", hazardId: haz.id, avoided: hazRes.avoided, damage: hazRes.damageDealt });
            if (!hazRes.avoided) {
              this.state.playerHp = Math.max(1, this.state.playerHp - hazRes.damageDealt);
              this.state.actionLog.push(`Triggered hazard '${haz.id}': ${hazRes.message}`);
            } else {
              this.state.flags.set(`hazard-${haz.id}-avoided`, true);
              this.state.actionLog.push(`Evaded hazard '${haz.id}': ${hazRes.message}`);
            }
          }
        }
      }

      // Check Objective Win Condition
      this.checkQuestCompletion();

      const emitted = this.state.emittedEvents.slice(preEventCount);
      return { success: true, message: msg, events: emitted };
    }

    // 2. Inspect / Interactable Execution
    if (action.kind === "inspect" || action.kind === "interact") {
      const interId = targetInteractableId || action.targetId;
      const inter = curLoc.interactables.find((i) => i.id === interId);
      if (!inter) {
        return { success: false, message: `Interactable '${interId}' not found.`, events: [] };
      }

      let msg = `Inspected '${inter.label}': ${inter.description}`;

      if (inter.inspectionCheck) {
        // If player has a key that matches the action or master key, bypass picklock check
        const hasBypassKey =
          this.state.inventory.has("master-slave-key") ||
          this.state.inventory.has("slaver-iron-key") ||
          this.state.inventory.has("iron-key") ||
          this.state.inventory.has("bronze-library-key");

        if (!hasBypassKey) {
          const res = resolveCheck(inter.inspectionCheck.dc, 3, this.rng);
          this.emit({
            kind: "check_resolved",
            ability: inter.inspectionCheck.ability,
            dc: inter.inspectionCheck.dc,
            roll: res.roll,
            success: res.success,
          });

          if (!res.success) {
            msg += ` (Failed ${inter.inspectionCheck.ability} check DC ${inter.inspectionCheck.dc})`;
            this.state.actionLog.push(msg);
            const emitted = this.state.emittedEvents.slice(preEventCount);
            return { success: false, message: msg, events: emitted };
          }
        } else {
          msg += ` (Unlocked with key from inventory)`;
        }
      }

      if (inter.onInspectEffects) {
        for (const eff of inter.onInspectEffects) {
          if (eff.kind === "grantItem") {
            this.state.inventory.add(eff.itemId);
            this.emit({ kind: "item_granted", itemId: eff.itemId, source: inter.id });
            msg += ` | Found item: '${eff.itemId}'`;
          } else if (eff.kind === "setFlag") {
            this.state.flags.set(eff.flag, eff.value);
            msg += ` | Set flag '${eff.flag}' = ${eff.value}`;
          }
        }
      }
      this.state.flags.set(`inspected-${inter.id}`, true);
      this.checkQuestCompletion();

      this.state.actionLog.push(msg);
      const emitted = this.state.emittedEvents.slice(preEventCount);
      return { success: true, message: msg, events: emitted };
    }

    // 3. Search Secret Execution
    if (action.kind === "search") {
      const secId = targetSecretId || action.targetId;
      const secret = curLoc.secrets.find((s) => s.id === secId);
      if (!secret) {
        return { success: false, message: `Secret '${secId}' not found.`, events: [] };
      }

      const res = resolveCheck(secret.perceptionDC, 4, this.rng);
      this.emit({
        kind: "check_resolved",
        ability: "perception",
        dc: secret.perceptionDC,
        roll: res.roll,
        success: res.success,
      });

      if (res.success) {
        this.state.discoveredSecrets.add(secret.id);
        this.state.flags.set(`${secret.id}-discovered`, true);

        this.emit({
          kind: "secret_discovered",
          secretId: secret.id,
          perceptionDC: secret.perceptionDC,
          rollTotal: res.total,
        });

        if (secret.revealsExitId) {
          const exit = curLoc.exits.find((e) => e.id === secret.revealsExitId);
          if (exit && exit.visibleWhen?.kind === "flag") {
            this.state.flags.set(exit.visibleWhen.flag, true);
          }
        }

        if (secret.grantsItemId) {
          this.state.inventory.add(secret.grantsItemId);
          this.emit({ kind: "item_granted", itemId: secret.grantsItemId, source: secret.id });
        }

        const msg = `Found secret '${secret.label}'! (Rolled ${res.total} vs DC ${secret.perceptionDC})`;
        this.state.actionLog.push(msg);
        const emitted = this.state.emittedEvents.slice(preEventCount);
        return { success: true, message: msg, events: emitted };
      } else {
        const msg = `Searched for secret but found nothing. (Rolled ${res.total} vs DC ${secret.perceptionDC})`;
        this.state.actionLog.push(msg);
        const emitted = this.state.emittedEvents.slice(preEventCount);
        return { success: false, message: msg, events: emitted };
      }
    }

    // 4. Unlock Exit Execution
    if (action.kind === "unlockExit") {
      const exit = curLoc.exits.find((e) => e.id === action.exitId);
      if (!exit || !exit.locked) {
        return { success: false, message: `No locked exit '${action.exitId}' here.`, events: [] };
      }

      if (exit.locked.keyItemId && this.state.inventory.has(exit.locked.keyItemId)) {
        this.state.unlockedExits.add(exit.id);
        this.emit({ kind: "exit_unlocked", exitId: exit.id, method: "key" });
        const msg = `Unlocked door with key '${exit.locked.keyItemId}'.`;
        this.state.actionLog.push(msg);
        const emitted = this.state.emittedEvents.slice(preEventCount);
        return { success: true, message: msg, events: emitted };
      } else if (exit.locked.pickable) {
        const res = resolveCheck(exit.locked.lockpickDC || 12, 3, this.rng);
        this.emit({
          kind: "check_resolved",
          ability: "thievesTools",
          dc: exit.locked.lockpickDC || 12,
          roll: res.roll,
          success: res.success,
        });

        if (res.success) {
          this.state.unlockedExits.add(exit.id);
          this.emit({ kind: "exit_unlocked", exitId: exit.id, method: "lockpick" });
          const msg = `Picked lock on door!`;
          this.state.actionLog.push(msg);
          const emitted = this.state.emittedEvents.slice(preEventCount);
          return { success: true, message: msg, events: emitted };
        }
      }

      return { success: false, message: `Could not unlock exit. Key required.`, events: [] };
    }

    // 5. Combat Action Execution
    if (action.kind === "resolveCombat" || action.kind === "combatAction") {
      if (!curLoc.encounter) {
        return { success: false, message: `No active encounter in this room.`, events: [] };
      }

      const enc = curLoc.encounter;
      let allVictories = true;
      const damageByMonster: Record<string, number> = {};

      for (const enemySpec of enc.enemies) {
        if (this.state.playerHp <= 0) {
          allVictories = false;
          break;
        }

        const monster = this.adventure.adventure.monsters.find((m) => m.id === enemySpec.monsterTemplateId);
        if (!monster) {
          return { success: false, message: `Monster template '${enemySpec.monsterTemplateId}' missing.`, events: [] };
        }

        this.emit({ kind: "combat_started", encounterId: enc.id, monsterName: monster.name });

        const combatRes = resolveSimpleCombat(
          monster,
          enemySpec.count,
          {
            hp: this.state.playerHp,
            ac: this.state.playerAc,
            attackBonus: this.state.playerAttackBonus,
            damageBonus: 2,
          },
          this.rng
        );

        this.state.playerHp = combatRes.playerHpRemaining;
        damageByMonster[monster.id] = (damageByMonster[monster.id] || 0) + (combatRes.damageDealtByMonster || 0);

        for (const line of combatRes.log) {
          this.state.actionLog.push(line);
        }

        if (!combatRes.victory) {
          allVictories = false;
          break;
        }
      }

      this.emit({ kind: "combat_ended", encounterId: enc.id, victory: allVictories });

      if (allVictories) {
        this.state.flags.set(`encounter-defeated-${enc.id}`, true);
        if (enc.victoryEffects) {
          for (const eff of enc.victoryEffects) {
            if (eff.kind === "setFlag") {
              this.state.flags.set(eff.flag, eff.value);
            }
          }
        }
        this.checkQuestCompletion();
      } else {
        this.state.gameEnded = true;
        this.state.gameOutcome = "defeat";
        this.emit({ kind: "game_ended", outcome: "defeat" });
      }

      const emitted = this.state.emittedEvents.slice(preEventCount);
      return {
        success: allVictories,
        message: allVictories ? "Combat victory!" : "Defeated in combat!",
        events: emitted,
        combatStats: {
          victory: allVictories,
          damageByMonster,
        },
      };
    }

    // 6. Rest (PHB Healing Rest & DMG Wandering Patrol Check)
    if (action.kind === "rest") {
      this.state.turnCount++;
      const isSafeHaven = curLoc.presentation?.biome === "keep" || curLoc.id.includes("tavern") || curLoc.id.includes("keep");

      // In dangerous dungeon biomes, resting triggers a DMG wandering monster check!
      if (!isSafeHaven) {
        const wandCheck = resolveDmgWanderingCheck(this.rng, curLoc.wanderingFrequency?.chanceOnD6 ?? 1);
        if (wandCheck.triggered) {
          const wandMonster = curLoc.wanderingFrequency?.monsterTemplateId || "goblin-scout";
          const msg = `Rest interrupted! A wandering patrol attacks! Rolled ${wandCheck.roll} on d6 (Threshold: ${wandCheck.threshold})`;
          this.state.actionLog.push(msg);
          this.emit({
            kind: "wandering_encounter_triggered",
            tableId: "wandering-dungeon",
            entityId: wandMonster,
            encounterText: msg,
          });
          this.state.inCombat = true;
          return { success: false, message: msg, events: this.state.emittedEvents.slice(preEventCount) };
        }
      }

      this.state.playerHp = Math.min(this.state.playerMaxHp, this.state.playerHp + 8);
      this.state.playerCharacter.hp = this.state.playerHp;
      const msg = `Rested successfully and recovered HP (Current HP: ${this.state.playerHp}/${this.state.playerMaxHp})`;
      this.state.actionLog.push(msg);
      return { success: true, message: msg, events: [] };
    }

    // 6b. Second Wind (PHB Fighter Feature)
    if (action.kind === "useSecondWind") {
      const windRes = useSecondWind(this.state.playerCharacter, this.rng);
      this.state.playerHp = this.state.playerCharacter.hp;
      this.state.actionLog.push(windRes.message);
      return { success: windRes.success, message: windRes.message, events: [] };
    }

    // 6c. Long Rest (DMG Safe Haven 8-Hour Rest)
    if (action.kind === "longRest") {
      const isSafeHaven = curLoc.presentation?.biome === "keep" || curLoc.id.includes("tavern") || curLoc.id.includes("keep");
      if (!isSafeHaven) {
        return { success: false, message: "A Long Rest requires an established safe haven (Keep or Inn). Cannot camp long-term in an active dungeon!", events: [] };
      }
      const restRes = resolveLongRest(this.state.playerCharacter);
      this.state.playerHp = this.state.playerCharacter.hp;
      this.state.playerMaxHp = this.state.playerCharacter.maxHp;
      this.state.turnCount += 8;
      this.state.actionLog.push(restRes.message);
      return { success: true, message: restRes.message, events: [] };
    }

    // 7. Roll Table Execution
    if (action.kind === "rollTable") {
      const res = this.evaluateRandomTable(action.tableId);
      const emitted = this.state.emittedEvents.slice(preEventCount);
      return {
        success: !!res.entry,
        message: res.entry ? `Rolled table '${action.tableId}': result ${res.roll}` : `Table '${action.tableId}' not found`,
        events: emitted,
      };
    }

    // 8. PHB Exploration: Listen at Door
    if (action.kind === "listen") {
      const act = action as { exitId?: string; direction?: Direction };
      const exit = curLoc.exits.find((e) => e.id === act.exitId || e.direction === act.direction) || curLoc.exits[0];
      if (!exit) {
        return { success: false, message: "No exit to listen at.", events: [] };
      }
      const checkRes = resolveListenCheck(this.rng, 2, 12);
      const heard = checkRes.success;
      const sensory = heard
        ? exit.listenNotice || "You press your ear against the portal and hear low guttural muttering and clinking metal."
        : "You strain your ears against the cold timber but discern only silence.";

      this.emit({ kind: "listen_attempted", exitId: exit.id, heard, notice: heard ? sensory : undefined });
      this.state.actionLog.push(`[Listen at ${exit.direction} exit]: ${sensory}`);
      return { success: true, message: sensory, events: this.state.emittedEvents.slice(preEventCount) };
    }

    // 9. PHB Exploration: Force Open Stuck / Barred Door
    if (action.kind === "forceDoor") {
      const act = action as { exitId?: string; direction?: Direction };
      const exit = curLoc.exits.find((e) => e.id === act.exitId || e.direction === act.direction) || curLoc.exits[0];
      if (!exit) {
        return { success: false, message: "No exit to force open.", events: [] };
      }
      const forceRes = resolveOpenDoors(this.rng, 14, exit.forceDC || 14);
      if (forceRes.success) {
        this.state.unlockedExits.add(exit.id);
        // DMG Rule: Loud noises alert wandering patrols
        const wandCheck = resolveDmgWanderingCheck(this.rng, 1, true);
        this.emit({ kind: "door_forced", exitId: exit.id, success: true, noiseAlerted: wandCheck.triggered });
        let msg = `Battered open door '${exit.id}'!`;
        if (wandCheck.triggered) {
          msg += ` The resounding crash echoes through the stone corridors, alerting nearby patrols!`;
        }
        this.state.actionLog.push(msg);
        return { success: true, message: msg, events: this.state.emittedEvents.slice(preEventCount) };
      } else {
        this.emit({ kind: "door_forced", exitId: exit.id, success: false, noiseAlerted: false });
        this.state.actionLog.push(`Failed to force door '${exit.id}': ${forceRes.message}`);
        return { success: false, message: forceRes.message, events: this.state.emittedEvents.slice(preEventCount) };
      }
    }

    // 10. PHB Exploration: Search for Traps & Hazards (10-Foot Pole)
    if (action.kind === "searchTraps") {
      const checkRes = resolveCheck(13, 2, this.rng);
      if (checkRes.success && curLoc.boundaries?.hazards && curLoc.boundaries.hazards.length > 0) {
        for (const haz of curLoc.boundaries.hazards) {
          this.state.flags.set(`hazard-${haz.id}-avoided`, true);
        }
        const msg = `Careful inspection with a 10-foot pole detected: ${curLoc.boundaries.hazards.map((h) => h.description).join("; ")}. Hazard marked and bypassed safely!`;
        this.state.actionLog.push(msg);
        return { success: true, message: msg, events: [] };
      } else {
        const msg = "You probe the flagstones and seams methodically. No active triggers or pitfalls detected.";
        this.state.actionLog.push(msg);
        return { success: true, message: msg, events: [] };
      }
    }

    // 11. PHB Social: Parley with Encounter
    if (action.kind === "parley") {
      if (!curLoc.encounter) {
        return { success: false, message: "No creature here to parley with.", events: [] };
      }
      const reactionRes = resolveDmgReactionRoll(this.rng, 1);
      this.emit({ kind: "parley_attempted", disposition: reactionRes.reaction, roll: reactionRes.roll });
      if (reactionRes.reaction === "neutral" || reactionRes.reaction === "friendly") {
        this.state.flags.set(`encounter-parleyed-${curLoc.encounter.id}`, true);
        const msg = `Parley succeeded! Rolled ${reactionRes.roll} on 2d6. ${reactionRes.description} Combat averted.`;
        this.state.actionLog.push(msg);
        return { success: true, message: msg, events: this.state.emittedEvents.slice(preEventCount) };
      } else {
        const msg = `Parley rejected! Rolled ${reactionRes.roll} on 2d6. ${reactionRes.description}`;
        this.state.actionLog.push(msg);
        return { success: false, message: msg, events: this.state.emittedEvents.slice(preEventCount) };
      }
    }

    // 12. PHB & Arms & Equipment: Use Item
    if (action.kind === "useItem") {
      const act = action as { kind: "useItem"; itemId: string; targetId?: string };
      const item =
        this.adventure.adventure.items.find((i) => i.id === act.itemId) ||
        STANDARD_EQUIPMENT_CATALOG.find((i) => i.id === act.itemId);
      if (!item) {
        return { success: false, message: `Item '${act.itemId}' not found.`, events: [] };
      }
      if (!this.state.inventory.has(act.itemId) && !this.state.inventory.has(item.id)) {
        return { success: false, message: `Item '${item.name}' is not in your inventory.`, events: [] };
      }

      this.emit({ kind: "item_used", itemId: item.id, targetId: act.targetId });

      // A. Alchemical Item
      if (item.type === "alchemical" || item.alchemical) {
        let targetMaterial = undefined;
        let targetName = act.targetId || "chamber";
        const inter = curLoc.interactables.find((i) => i.id === act.targetId);
        if (inter) {
          targetName = inter.label;
          targetMaterial = inter.physical?.material;
        }

        const alchRes = resolveAlchemicalSubstance(
          item,
          {
            name: targetName,
            material: targetMaterial,
            isUndead: curLoc.encounter?.enemies.some(
              (e) => e.monsterTemplateId.includes("skeleton") || e.monsterTemplateId.includes("zombie")
            ),
          },
          this.rng
        );

        this.emit({
          kind: "alchemical_used",
          itemId: item.id,
          substanceType: item.alchemical?.substanceType || "acid-flask",
          targetId: act.targetId,
        });

        // If stonebreaker acid against stone interactable
        if (item.alchemical?.substanceType === "stonebreaker-acid" && inter) {
          const dmgRes = damageObject(
            {
              id: inter.id,
              hardness: inter.physical?.hardness,
              hp: inter.physical?.hp,
              maxHp: inter.physical?.maxHp,
              material: inter.physical?.material || "stone",
            },
            alchRes.damage || 15,
            "acid",
            undefined,
            "stonebreaker-acid"
          );
          if (inter.physical) inter.physical.hp = dmgRes.remainingHp;
          if (dmgRes.isDestroyed) {
            this.state.flags.set(`destroyed-${inter.id}`, true);
            if (inter.physical) inter.physical.isBroken = true;
          }
          this.emit({
            kind: "object_damaged",
            interactableId: inter.id,
            damage: dmgRes.damageDealt,
            remainingHp: dmgRes.remainingHp,
            isDestroyed: dmgRes.isDestroyed,
          });
          alchRes.message += ` ${dmgRes.message}`;
        }

        this.state.actionLog.push(`[Alchemical Item]: ${alchRes.message}`);
        return { success: true, message: alchRes.message, events: this.state.emittedEvents.slice(preEventCount) };
      }

      // B. Tool: Crowbar
      if (item.tool?.category === "crowbar") {
        const targetId = act.targetId;
        const inter = curLoc.interactables.find((i) => i.id === targetId);
        const exit = curLoc.exits.find((e) => e.id === targetId);
        if (!inter && !exit) {
          return { success: false, message: "No door or chest specified to pry open with crowbar.", events: [] };
        }
        const breakRes = resolveBreakAttempt(
          this.state.playerCharacter,
          { breakDc: inter?.physical?.breakDc || exit?.forceDC || 16, label: inter?.label || exit?.id },
          item,
          this.rng
        );
        this.emit({ kind: "object_forced", interactableId: targetId || "exit", success: breakRes.success });
        if (breakRes.success) {
          if (inter) {
            if (inter.physical) inter.physical.isBroken = true;
            this.state.flags.set(`forced-${inter.id}`, true);
          }
          if (exit) {
            this.state.unlockedExits.add(exit.id);
          }
        }
        this.state.actionLog.push(breakRes.message);
        return { success: breakRes.success, message: breakRes.message, events: this.state.emittedEvents.slice(preEventCount) };
      }

      // C. Tool: Thieves' Tools
      if (item.tool?.category === "thieves-tools") {
        const targetId = act.targetId;
        const inter = curLoc.interactables.find((i) => i.id === targetId);
        const exit = curLoc.exits.find((e) => e.id === targetId);
        const lockDc = inter?.physical?.lockDc || 15;
        const lockRes = resolveLockpickAttempt(this.state.playerCharacter, lockDc, true, this.rng);
        if (lockRes.success) {
          if (inter) {
            if (inter.physical) inter.physical.isLocked = false;
            this.state.flags.set(`unlocked-${inter.id}`, true);
          }
          if (exit) {
            this.state.unlockedExits.add(exit.id);
            this.emit({ kind: "exit_unlocked", exitId: exit.id, method: "lockpick" });
          }
        }
        this.state.actionLog.push(lockRes.message);
        return { success: lockRes.success, message: lockRes.message, events: this.state.emittedEvents.slice(preEventCount) };
      }

      // D. Potion
      if (item.type === "potion") {
        const heal = parseAndRollDice("2d4+2", this.rng);
        this.state.playerHp = Math.min(this.state.playerMaxHp, this.state.playerHp + heal);
        this.state.playerCharacter.hp = this.state.playerHp;
        const msg = `Quaffed '${item.name}', restoring ${heal} HP (Current: ${this.state.playerHp}/${this.state.playerMaxHp}).`;
        this.state.actionLog.push(msg);
        return { success: true, message: msg, events: this.state.emittedEvents.slice(preEventCount) };
      }

      // E. Key
      if (item.type === "key") {
        const exit = curLoc.exits.find((e) => e.locked?.keyItemId === item.id || e.id === act.targetId);
        const inter = curLoc.interactables.find((i) => i.physical?.keyItemId === item.id || i.id === act.targetId);
        if (exit) {
          this.state.unlockedExits.add(exit.id);
          this.emit({ kind: "exit_unlocked", exitId: exit.id, method: "key" });
          const msg = `Unlocked portal '${exit.id}' with ${item.name}!`;
          this.state.actionLog.push(msg);
          return { success: true, message: msg, events: this.state.emittedEvents.slice(preEventCount) };
        }
        if (inter) {
          if (inter.physical) inter.physical.isLocked = false;
          this.state.flags.set(`unlocked-${inter.id}`, true);
          const msg = `Unlocked '${inter.label}' with ${item.name}!`;
          this.state.actionLog.push(msg);
          return { success: true, message: msg, events: this.state.emittedEvents.slice(preEventCount) };
        }
      }

      const defaultMsg = `Used item '${item.name}'.`;
      this.state.actionLog.push(defaultMsg);
      return { success: true, message: defaultMsg, events: this.state.emittedEvents.slice(preEventCount) };
    }

    // 13. Arms & Equipment: Attack / Sunder Object
    if (action.kind === "attackObject") {
      const act = action as { kind: "attackObject"; targetId: string; weaponItemId?: string };
      const inter = curLoc.interactables.find((i) => i.id === act.targetId);
      if (!inter) {
        return { success: false, message: `Object '${act.targetId}' not found in this chamber.`, events: [] };
      }

      const weapon = act.weaponItemId
        ? this.adventure.adventure.items.find((i) => i.id === act.weaponItemId) ||
          STANDARD_EQUIPMENT_CATALOG.find((i) => i.id === act.weaponItemId)
        : STANDARD_EQUIPMENT_CATALOG.find((i) => i.id === "item-adamantine-greatsword");

      const weaponMaterial = weapon?.weapon?.material || "steel";
      const baseDmg = parseAndRollDice(weapon?.weapon?.damageDice || "1d8", this.rng) + 2;

      const dmgRes = damageObject(
        {
          id: inter.id,
          label: inter.label,
          hardness: inter.physical?.hardness,
          hp: inter.physical?.hp,
          maxHp: inter.physical?.maxHp,
          material: inter.physical?.material || "wood",
        },
        baseDmg,
        weapon?.weapon?.damageType || "slashing",
        weaponMaterial
      );

      if (inter.physical) {
        inter.physical.hp = dmgRes.remainingHp;
        if (dmgRes.isDestroyed) {
          inter.physical.isBroken = true;
          this.state.flags.set(`destroyed-${inter.id}`, true);
        }
      }

      this.emit({
        kind: "object_damaged",
        interactableId: inter.id,
        damage: dmgRes.damageDealt,
        remainingHp: dmgRes.remainingHp,
        isDestroyed: dmgRes.isDestroyed,
      });

      this.state.actionLog.push(`[Sunder Object: ${inter.label}]: ${dmgRes.message}`);
      return { success: true, message: dmgRes.message, events: this.state.emittedEvents.slice(preEventCount) };
    }

    // 14. Arms & Equipment: Force Object
    if (action.kind === "forceObject") {
      const act = action as { kind: "forceObject"; targetId: string; toolItemId?: string };
      const inter = curLoc.interactables.find((i) => i.id === act.targetId);
      if (!inter) {
        return { success: false, message: `Object '${act.targetId}' not found in this chamber.`, events: [] };
      }

      const tool = act.toolItemId
        ? this.adventure.adventure.items.find((i) => i.id === act.toolItemId) ||
          STANDARD_EQUIPMENT_CATALOG.find((i) => i.id === act.toolItemId)
        : undefined;

      const breakRes = resolveBreakAttempt(
        this.state.playerCharacter,
        { breakDc: inter.physical?.breakDc || 16, label: inter.label },
        tool,
        this.rng
      );

      this.emit({ kind: "object_forced", interactableId: inter.id, success: breakRes.success });

      if (breakRes.success) {
        if (inter.physical) {
          inter.physical.isBroken = true;
          inter.physical.isLocked = false;
        }
        this.state.flags.set(`forced-${inter.id}`, true);
      }

      this.state.actionLog.push(breakRes.message);
      return { success: breakRes.success, message: breakRes.message, events: this.state.emittedEvents.slice(preEventCount) };
    }

    // 15. Pickup Item Execution
    if (action.kind === "pickupItem") {
      const itemId = action.itemId;
      this.state.inventory.add(itemId);
      this.emit({ kind: "item_granted", itemId, source: "pickup" });
      const msg = `Picked up item '${itemId}'.`;
      this.state.actionLog.push(msg);
      const emitted = this.state.emittedEvents.slice(preEventCount);
      return { success: true, message: msg, events: emitted };
    }

    return { success: false, message: "Unhandled action input.", events: [] };
  }
}
