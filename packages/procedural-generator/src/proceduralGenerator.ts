import {
  VersionedAdventure,
  Location,
  Exit,
  MonsterTemplate,
  Item,
  Encounter,
} from "@grimoire3d/ir";
import { SeededRNG } from "@grimoire3d/rules-core";
import { validateAdventure } from "@grimoire3d/validator";
import { GeneratorOptions, GeneratorOptionsSchema } from "./types";

export class ProceduralGenerator {
  public static generateAdventure(options: Partial<GeneratorOptions> = {}): VersionedAdventure {
    const opts = GeneratorOptionsSchema.parse(options);
    const rng = new SeededRNG(opts.seed);

    const locations: Location[] = [];
    const monsters: MonsterTemplate[] = [];
    const items: Item[] = [];

    const biome = opts.theme === "cavern-complex" ? "cavern" : opts.theme === "ancient-crypt" ? "crypt" : "keep";
    const keyItemId = `dungeon-key-${opts.seed}`;

    // 1. Generate Key Item
    if (opts.includeKeyLockPuzzle) {
      items.push({
        id: keyItemId,
        name: `Ornate Brass Key #${opts.seed}`,
        type: "key",
        description: "A rusty brass key generated for this dungeon complex.",
        valueCoins: 25,
      });
    }

    // 2. Generate Monster Templates based on Level
    const minionHp = 4 + opts.targetPartyLevel * 2;
    const bossHp = 15 + opts.targetPartyLevel * 6;
    const minionAtk = 2 + Math.floor(opts.targetPartyLevel / 2);
    const bossAtk = 4 + opts.targetPartyLevel;

    monsters.push({
      id: "proc-minion",
      name: `Dungeon Guard (Lvl ${opts.targetPartyLevel})`,
      hp: minionHp,
      ac: 13,
      attackBonus: minionAtk,
      damageRoll: `1d6+${Math.floor(opts.targetPartyLevel / 2)}`,
    });

    monsters.push({
      id: "proc-boss",
      name: `Dungeon Overlord (Lvl ${opts.targetPartyLevel + 2})`,
      hp: bossHp,
      ac: 15,
      attackBonus: bossAtk,
      damageRoll: `1d8+${opts.targetPartyLevel}`,
    });

    // 3. Generate Room Topology
    const roomCount = opts.roomCount;
    const directions: ("north" | "south" | "east" | "west")[] = ["north", "south", "east", "west"];

    for (let i = 0; i < roomCount; i++) {
      const roomId = i === 0 ? "proc-start" : i === roomCount - 1 ? "proc-boss-room" : `proc-room-${i}`;
      const isStart = i === 0;
      const isBoss = i === roomCount - 1 && opts.includeBossRoom;
      const isKeyRoom = i === Math.floor(roomCount / 3) && opts.includeKeyLockPuzzle;
      const isLockedDoorRoom = i === Math.floor((roomCount * 2) / 3) && opts.includeKeyLockPuzzle;

      const exits: Exit[] = [];

      // Link to next room
      if (i < roomCount - 1) {
        const nextId = i + 1 === roomCount - 1 ? "proc-boss-room" : `proc-room-${i + 1}`;
        const dir = directions[i % 4];
        const isDoorLocked = isLockedDoorRoom;

        exits.push({
          id: `exit-${i}-to-${i + 1}`,
          direction: dir,
          target: nextId,
          locked: isDoorLocked ? { keyItemId } : undefined,
        });
      }

      // Link back to previous room
      if (i > 0) {
        const prevId = i - 1 === 0 ? "proc-start" : `proc-room-${i - 1}`;
        const oppositeDirs: Record<string, "north" | "south" | "east" | "west"> = {
          north: "south",
          south: "north",
          east: "west",
          west: "east",
        };
        const prevDir = oppositeDirs[directions[(i - 1) % 4]];

        exits.push({
          id: `exit-${i}-to-${i - 1}`,
          direction: prevDir,
          target: prevId,
        });
      }

      // Add Escape Exit in boss room
      if (isBoss) {
        exits.push({
          id: "exit-boss-to-escape",
          direction: "down",
          target: "escape-tunnel",
        });
      }

      // Room Interactables & Key Placement
      const interactables = [];
      if (isKeyRoom) {
        interactables.push({
          id: `chest-key-${i}`,
          label: "Iron Chest",
          description: "A heavy chest holding the brass key to the inner sanctuary.",
          onInspectEffects: [{ kind: "grantItem" as const, itemId: keyItemId }],
        });
      }

      // Encounter Placement
      let encounter: Encounter | undefined;
      if (isBoss) {
        encounter = {
          id: "proc-boss-encounter",
          trigger: { kind: "always" },
          enemies: [{ monsterTemplateId: "proc-boss", count: 1 }],
          victoryEffects: [
            { kind: "setFlag", flag: "proc-boss-defeated", value: true },
            { kind: "setFlag", flag: "caves-cleared", value: true },
          ],
        };
      } else if (!isStart && i % 2 === 0) {
        encounter = {
          id: `proc-encounter-${i}`,
          trigger: { kind: "always" },
          enemies: [{ monsterTemplateId: "proc-minion", count: Math.floor(rng.rollDice(2)) }],
        };
      }

      locations.push({
        id: roomId,
        label: isStart ? "1. Dungeon Entrance" : isBoss ? `${roomCount}. Overlord Sanctum` : `${i + 1}. Chamber ${i + 1}`,
        geometry: { x: (i % 5) * 8, y: Math.floor(i / 5) * 8, width: 6, height: 6 },
        presentation: {
          biome,
          lighting: isStart ? "day" : "torchlit",
          ambienceTags: [opts.theme, "procedural-chamber"],
        },
        narrative: {
          playerFacingDescription: `A ${biome} chamber carved from rough stone.`,
          gmNotes: [`Procedural room #${i + 1}`],
        },
        exits,
        interactables,
        secrets: [],
        encounter,
      });
    }

    // Add Escape Tunnel Destination Room
    locations.push({
      id: "escape-tunnel",
      label: `${roomCount + 1}. Sunlight Exit`,
      geometry: { x: 0, y: -16, width: 6, height: 6 },
      presentation: { biome: "forest", lighting: "day", ambienceTags: ["daylight", "freedom"] },
      narrative: { playerFacingDescription: "Fresh air and daylight!", gmNotes: ["Victory room"] },
      exits: [],
      interactables: [],
      secrets: [],
    });

    const vAdventure: VersionedAdventure = {
      schemaVersion: "0.1",
      adventure: {
        id: `proc-dungeon-${opts.seed}`,
        title: opts.title,
        systemProfile: "classic-dungeon",
        start: "proc-start",
        locations,
        npcs: [],
        monsters,
        items,
        quests: [
          {
            id: "proc-main-quest",
            title: "Clear the Dungeon Overlord",
            description: "Defeat the Dungeon Overlord and escape through the sunlight exit.",
            completionCondition: { kind: "flag", flag: "proc-boss-defeated", equals: true },
            rewards: [],
          },
        ],
      },
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        importedBy: "extractor",
      },
    };

    // Audit generated adventure with validator
    const audit = validateAdventure(vAdventure);
    if (!audit.valid) {
      const errMsgs = audit.issues.filter((i) => i.severity === "error").map((i) => i.message);
      throw new Error(`Procedural dungeon generation produced invalid IR: ${errMsgs.join(", ")}`);
    }

    return vAdventure;
  }
}
