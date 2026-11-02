import { describe, it, expect } from "vitest";
import { TacticalCombatManager } from "./tacticalCombat";

describe("Tactical Combat Manager Test Suite", () => {
  it("1. Initializes initiative order with player and monsters sorted by initiative", () => {
    const manager = new TacticalCombatManager(
      { name: "Hero Fighter", hp: 25, maxHp: 25, ac: 16, attackBonus: 5, damageBonus: 3 },
      [
        {
          template: { id: "goblin-1", name: "Goblin Scout", hp: 7, ac: 13, attackBonus: 4, damageRoll: "1d6+2" },
          count: 2,
        },
      ],
      42
    );

    expect(manager.state.combatants.length).toBe(3); // 1 Player + 2 Goblins
    expect(manager.state.round).toBe(1);
    expect(manager.state.combatEnded).toBe(false);

    // Assert initiative sorting
    for (let i = 0; i < manager.state.combatants.length - 1; i++) {
      expect(manager.state.combatants[i].initiative).toBeGreaterThanOrEqual(
        manager.state.combatants[i + 1].initiative
      );
    }
  });

  it("2. Grid movement deducts movement points correctly", () => {
    const manager = new TacticalCombatManager(
      { name: "Hero", hp: 20, maxHp: 20, ac: 15, attackBonus: 4, damageBonus: 2 },
      [{ template: { id: "orc", name: "Orc", hp: 15, ac: 13, attackBonus: 4, damageRoll: "1d8+2" }, count: 1 }],
      42
    );

    const active = manager.getActiveCombatant();
    const initialPos = { ...active.gridPos };

    // Move 2 tiles
    const targetPos = { x: initialPos.x + 2, y: initialPos.y };
    const success = manager.moveActiveCombatant(targetPos);

    expect(success).toBe(true);
    expect(active.gridPos).toEqual(targetPos);
    expect(active.movementRemaining).toBe(4); // 6 - 2 = 4
  });

  it("3. Melee attack executes d20 roll vs AC and updates hit points", () => {
    const manager = new TacticalCombatManager(
      { name: "Hero", hp: 20, maxHp: 20, ac: 15, attackBonus: 10, damageBonus: 4 }, // High attack bonus to guarantee hit
      [{ template: { id: "goblin", name: "Goblin", hp: 10, ac: 10, attackBonus: 3, damageRoll: "1d6+1" }, count: 1 }],
      42
    );

    // Position player next to monster
    const player = manager.state.combatants.find((c) => c.isPlayer)!;
    const monster = manager.state.combatants.find((c) => !c.isPlayer)!;
    monster.gridPos = { x: player.gridPos.x + 1, y: player.gridPos.y };

    const initialMonsterHp = monster.hp;
    const hitSuccess = manager.executeAttack("longsword", monster.id);

    expect(hitSuccess).toBe(true);
    expect(monster.hp).toBeLessThan(initialMonsterHp);
    expect(manager.state.log.length).toBeGreaterThan(1);
  });

  it("4. Potion of Healing restores player HP and consumes bonus action", () => {
    const manager = new TacticalCombatManager(
      { name: "Hero", hp: 5, maxHp: 20, ac: 14, attackBonus: 4, damageBonus: 2 },
      [{ template: { id: "kobold", name: "Kobold", hp: 5, ac: 10, attackBonus: 2, damageRoll: "1d4+1" }, count: 1 }],
      42
    );

    const player = manager.getActiveCombatant();
    const initialHp = player.hp;

    const potionUsed = manager.executeUsePotion();

    expect(potionUsed).toBe(true);
    expect(player.hp).toBeGreaterThan(initialHp);
    expect(player.hasBonusAction).toBe(false);
  });
});
