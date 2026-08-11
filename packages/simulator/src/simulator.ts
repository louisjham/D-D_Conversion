import { VersionedAdventure, Location, Exit, Interactable, Secret, Encounter, RandomTableEntry } from "@grimoire3d/ir";
import { SeededRNG, resolveCheck, resolveSimpleCombat } from "@grimoire3d/rules-core";

export function parseAndRollDice(diceStr: string, rng: SeededRNG): number {
  const match = /^(\d+)d(\d+)(?:([+-])(\d+))?$/i.exec(diceStr.trim());
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
  | { type: "PLAYER_MOVED"; fromRoomId: string; toRoomId: string; exitId: string }
  | { type: "ROOM_DISCOVERED"; roomId: string; label: string }
  | { type: "FOG_REVEALED"; roomId: string }
  | { type: "ITEM_GRANTED"; itemId: string; source: string }
  | { type: "ITEM_USED"; itemId: string; targetId?: string }
  | { type: "SECRET_DISCOVERED"; secretId: string; perceptionDC: number; rollTotal: number }
  | { type: "EXIT_UNLOCKED"; exitId: string; method: "key" | "lockpick" }
  | { type: "CHECK_RESOLVED"; ability: string; dc: number; roll: number; success: boolean }
  | { type: "TRAP_TRIGGERED"; interactableId: string; disarmed: boolean }
  | { type: "COMBAT_STARTED"; encounterId: string; monsterName: string }
  | { type: "COMBAT_ROUND_RESOLVED"; round: number; playerHp: number; enemyHp: number }
  | { type: "COMBAT_ENDED"; encounterId: string; victory: boolean }
  | { type: "QUEST_UPDATED"; questId: string; status: "started" | "completed" }
  | { type: "RANDOM_TABLE_ROLLED"; tableId: string; tableName: string; rollResult: number; entryResult: string }
  | { type: "WANDERING_ENCOUNTER_TRIGGERED"; tableId: string; entityId?: string; encounterText: string }
  | { type: "GAME_ENDED"; outcome: "victory" | "defeat" };

export type Direction = "north" | "south" | "east" | "west" | "up" | "down";
export type InteractionVerb = "inspect" | "open" | "disarm" | "search" | "take" | "talk";
export type CombatActionType = "attack" | "defend" | "flee" | "useItem";

export type GameAction =
  | { kind: "move"; direction: Direction }
  | { kind: "inspect"; targetId: string }
  | { kind: "search"; targetId: string }
  | { kind: "interact"; targetId: string; verb: InteractionVerb }
  | { kind: "useItem"; itemId: string; targetId?: string }
  | { kind: "combatAction"; action: CombatActionType }
  | { kind: "rollTable"; tableId: string }
  | { kind: "rest" }
  // Legacy / Direct Actions
  | { type: "MOVE"; exitId: string }
  | { type: "INSPECT"; interactableId: string }
  | { type: "SEARCH_SECRET"; secretId: string }
  | { type: "UNLOCK_EXIT"; exitId: string }
  | { type: "RESOLVE_COMBAT"; encounterId: string }
  | { type: "PICKUP_ITEM"; itemId: string };

export type GameState = {
  currentLocationId: string;
  inventory: Set<string>;
  flags: Map<string, boolean>;
  playerHp: number;
  playerMaxHp: number;
  playerAc: number;
  playerAttackBonus: number;
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
};

export class SimulatorEngine {
  public state: GameState;
  public adventure: VersionedAdventure;
  public rng: SeededRNG;
  private locationMap: Map<string, Location>;

  constructor(vAdventure: VersionedAdventure, seed: number = 42) {
    this.adventure = vAdventure;
    this.rng = new SeededRNG(seed);
    this.locationMap = new Map(vAdventure.adventure.locations.map((l) => [l.id, l]));

    const startId = vAdventure.adventure.start;
    const startLoc = this.locationMap.get(startId);

    const discoveredRooms = new Set<string>([startId]);

    this.state = {
      currentLocationId: startId,
      inventory: new Set<string>(),
      flags: new Map<string, boolean>(),
      playerHp: 24,
      playerMaxHp: 24,
      playerAc: 14,
      playerAttackBonus: 5,
      discoveredSecrets: new Set<string>(),
      unlockedExits: new Set<string>(),
      discoveredRooms,
      actionLog: [`Entered ${startLoc ? startLoc.label : startId}`],
      emittedEvents: [
        { type: "ROOM_DISCOVERED", roomId: startId, label: startLoc ? startLoc.label : startId },
        { type: "FOG_REVEALED", roomId: startId },
      ],
      inCombat: false,
      gameEnded: false,
      seed,
      turnCount: 0,
    };
  }

  public evaluateRandomTable(tableId: string): { roll: number; entry?: RandomTableEntry; event?: DomainEvent } {
    const tables = this.adventure.adventure.randomTables || [];
    const table = tables.find((t) => t.id === tableId);
    if (!table) return { roll: 0 };

    const roll = parseAndRollDice(table.dice, this.rng);
    const entry = table.entries.find((e) => roll >= e.range[0] && roll <= e.range[1]);

    const entryDesc = entry ? (entry.result.text || entry.result.entityId || entry.result.kind) : "No effect";
    const event: DomainEvent = {
      type: "RANDOM_TABLE_ROLLED",
      tableId: table.id,
      tableName: table.name,
      rollResult: roll,
      entryResult: entryDesc,
    };
    this.emit(event);

    if (entry) {
      if (entry.result.kind === "encounter") {
        this.emit({
          type: "WANDERING_ENCOUNTER_TRIGGERED",
          tableId: table.id,
          entityId: entry.result.entityId,
          encounterText: entry.result.text || `Wandering ${entry.result.entityId || "monster"} appeared!`,
        });
        this.state.actionLog.push(`[Table Roll: ${table.name}] Rolled ${roll} -> ${entry.result.text || entry.result.entityId}`);
      } else if (entry.result.kind === "item" && entry.result.entityId) {
        this.state.inventory.add(entry.result.entityId);
        this.emit({ type: "ITEM_GRANTED", itemId: entry.result.entityId, source: table.id });
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

  public executeAction(action: GameAction): { success: boolean; message: string; events: DomainEvent[] } {
    if (this.state.gameEnded) {
      return { success: false, message: "Game has already ended.", events: [] };
    }

    const curLoc = this.getCurrentLocation();
    const preEventCount = this.state.emittedEvents.length;

    // Normalization of 'kind' actions to engine handlers
    let targetExitId: string | undefined;
    let targetInteractableId: string | undefined;
    let targetSecretId: string | undefined;

    if ("kind" in action) {
      if (action.kind === "move") {
        const exit = curLoc.exits.find((e) => e.direction === action.direction);
        if (exit) targetExitId = exit.id;
      } else if (action.kind === "inspect" || action.kind === "interact") {
        targetInteractableId = action.targetId;
      } else if (action.kind === "search") {
        targetSecretId = action.targetId;
      }
    } else {
      if (action.type === "MOVE") targetExitId = action.exitId;
      if (action.type === "INSPECT") targetInteractableId = action.interactableId;
      if (action.type === "SEARCH_SECRET") targetSecretId = action.secretId;
    }

    // 1. Move Execution
    if (targetExitId || (action as any).type === "MOVE" || (action as any).kind === "move") {
      const exitId = targetExitId || (action as any).exitId;
      const exit = curLoc.exits.find((e) => e.id === exitId || e.direction === (action as any).direction);

      if (!exit) {
        return { success: false, message: `No valid exit in direction ${(action as any).direction || exitId}.`, events: [] };
      }

      // Check secret visibility
      if (exit.visibleWhen?.kind === "flag" && !this.state.flags.get(exit.visibleWhen.flag)) {
        return { success: false, message: `Exit is hidden behind secret seam.`, events: [] };
      }

      // Check locked
      if (exit.locked && !this.state.unlockedExits.has(exit.id)) {
        if (exit.locked.keyItemId && this.state.inventory.has(exit.locked.keyItemId)) {
          this.state.unlockedExits.add(exit.id);
          this.emit({ type: "EXIT_UNLOCKED", exitId: exit.id, method: "key" });
          this.state.actionLog.push(`Unlocked exit using '${exit.locked.keyItemId}'`);
        } else {
          return { success: false, message: `Exit '${exit.id}' is locked! Key required: ${exit.locked.keyItemId || "Lockpick"}.`, events: [] };
        }
      }

      const prevRoomId = this.state.currentLocationId;
      this.state.currentLocationId = exit.target;
      const newLoc = this.getCurrentLocation();

      this.state.discoveredRooms.add(newLoc.id);

      this.emit({ type: "PLAYER_MOVED", fromRoomId: prevRoomId, toRoomId: newLoc.id, exitId: exit.id });
      this.emit({ type: "ROOM_DISCOVERED", roomId: newLoc.id, label: newLoc.label });
      this.emit({ type: "FOG_REVEALED", roomId: newLoc.id });

      const msg = `Moved to ${newLoc.label}`;
      this.state.actionLog.push(msg);

      // Check Objective Win Condition
      if (newLoc.id === "escape-tunnel") {
        this.state.flags.set("escaped-crypt", true);
        this.state.gameEnded = true;
        this.state.gameOutcome = "victory";
        this.emit({ type: "QUEST_UPDATED", questId: "escape-crypt", status: "completed" });
        this.emit({ type: "GAME_ENDED", outcome: "victory" });
        this.state.actionLog.push("VICTORY! You escaped the Serpent Altar Crypt!");
      }

      const emitted = this.state.emittedEvents.slice(preEventCount);
      return { success: true, message: msg, events: emitted };
    }

    // 2. Inspect / Interactable Execution
    if (targetInteractableId || (action as any).type === "INSPECT") {
      const interId = targetInteractableId || (action as any).interactableId;
      const inter = curLoc.interactables.find((i) => i.id === interId);
      if (!inter) {
        return { success: false, message: `Interactable '${interId}' not found.`, events: [] };
      }

      let msg = `Inspected '${inter.label}': ${inter.description}`;

      if (inter.inspectionCheck) {
        const res = resolveCheck(inter.inspectionCheck.dc, 3, this.rng);
        this.emit({
          type: "CHECK_RESOLVED",
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
      }

      if (inter.onInspectEffects) {
        for (const eff of inter.onInspectEffects) {
          if (eff.kind === "grantItem") {
            this.state.inventory.add(eff.itemId);
            this.emit({ type: "ITEM_GRANTED", itemId: eff.itemId, source: inter.id });
            msg += ` | Found item: '${eff.itemId}'`;
          } else if (eff.kind === "setFlag") {
            this.state.flags.set(eff.flag, eff.value);
            msg += ` | Set flag '${eff.flag}' = ${eff.value}`;
          }
        }
      }

      this.state.actionLog.push(msg);
      const emitted = this.state.emittedEvents.slice(preEventCount);
      return { success: true, message: msg, events: emitted };
    }

    // 3. Search Secret Execution
    if (targetSecretId || (action as any).type === "SEARCH_SECRET") {
      const secId = targetSecretId || (action as any).secretId;
      const secret = curLoc.secrets.find((s) => s.id === secId);
      if (!secret) {
        return { success: false, message: `Secret '${secId}' not found.`, events: [] };
      }

      const res = resolveCheck(secret.perceptionDC, 4, this.rng);
      this.emit({
        type: "CHECK_RESOLVED",
        ability: "perception",
        dc: secret.perceptionDC,
        roll: res.roll,
        success: res.success,
      });

      if (res.success) {
        this.state.discoveredSecrets.add(secret.id);
        this.state.flags.set(`${secret.id}-discovered`, true);

        this.emit({
          type: "SECRET_DISCOVERED",
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
          this.emit({ type: "ITEM_GRANTED", itemId: secret.grantsItemId, source: secret.id });
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
    if ((action as any).type === "UNLOCK_EXIT") {
      const exit = curLoc.exits.find((e) => e.id === (action as any).exitId);
      if (!exit || !exit.locked) {
        return { success: false, message: `No locked exit '${(action as any).exitId}' here.`, events: [] };
      }

      if (exit.locked.keyItemId && this.state.inventory.has(exit.locked.keyItemId)) {
        this.state.unlockedExits.add(exit.id);
        this.emit({ type: "EXIT_UNLOCKED", exitId: exit.id, method: "key" });
        const msg = `Unlocked door with key '${exit.locked.keyItemId}'.`;
        this.state.actionLog.push(msg);
        const emitted = this.state.emittedEvents.slice(preEventCount);
        return { success: true, message: msg, events: emitted };
      } else if (exit.locked.pickable) {
        const res = resolveCheck(exit.locked.lockpickDC || 12, 3, this.rng);
        this.emit({
          type: "CHECK_RESOLVED",
          ability: "thievesTools",
          dc: exit.locked.lockpickDC || 12,
          roll: res.roll,
          success: res.success,
        });

        if (res.success) {
          this.state.unlockedExits.add(exit.id);
          this.emit({ type: "EXIT_UNLOCKED", exitId: exit.id, method: "lockpick" });
          const msg = `Picked lock on door!`;
          this.state.actionLog.push(msg);
          const emitted = this.state.emittedEvents.slice(preEventCount);
          return { success: true, message: msg, events: emitted };
        }
      }

      return { success: false, message: `Could not unlock exit. Key required.`, events: [] };
    }

    // 5. Combat Action Execution
    if ((action as any).type === "RESOLVE_COMBAT" || (action as any).kind === "combatAction") {
      if (!curLoc.encounter) {
        return { success: false, message: `No active encounter in this room.`, events: [] };
      }

      const enc = curLoc.encounter;
      const enemySpec = enc.enemies[0];
      const monster = this.adventure.adventure.monsters.find((m) => m.id === enemySpec.monsterTemplateId);
      if (!monster) {
        return { success: false, message: `Monster template '${enemySpec.monsterTemplateId}' missing.`, events: [] };
      }

      this.emit({ type: "COMBAT_STARTED", encounterId: enc.id, monsterName: monster.name });

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
      for (const line of combatRes.log) {
        this.state.actionLog.push(line);
      }

      this.emit({ type: "COMBAT_ENDED", encounterId: enc.id, victory: combatRes.victory });

      if (combatRes.victory && enc.victoryEffects) {
        for (const eff of enc.victoryEffects) {
          if (eff.kind === "setFlag") {
            this.state.flags.set(eff.flag, eff.value);
          }
        }
      } else if (!combatRes.victory) {
        this.state.gameEnded = true;
        this.state.gameOutcome = "defeat";
        this.emit({ type: "GAME_ENDED", outcome: "defeat" });
      }

      const emitted = this.state.emittedEvents.slice(preEventCount);
      return {
        success: combatRes.victory,
        message: combatRes.victory ? "Combat victory!" : "Defeated in combat!",
        events: emitted,
      };
    }

    // 6. Rest
    if ((action as any).kind === "rest") {
      this.state.turnCount++;
      this.state.playerHp = Math.min(this.state.playerMaxHp, this.state.playerHp + 8);
      const msg = `Rested and recovered HP (Current HP: ${this.state.playerHp}/${this.state.playerMaxHp})`;
      this.state.actionLog.push(msg);
      return { success: true, message: msg, events: [] };
    }

    // 7. Roll Table Execution
    if ("kind" in action && action.kind === "rollTable") {
      const res = this.evaluateRandomTable(action.tableId);
      const emitted = this.state.emittedEvents.slice(preEventCount);
      return {
        success: !!res.entry,
        message: res.entry ? `Rolled table '${action.tableId}': result ${res.roll}` : `Table '${action.tableId}' not found`,
        events: emitted,
      };
    }

    return { success: false, message: "Unhandled action input.", events: [] };
  }
}
