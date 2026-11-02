import {
  VersionedAdventure,
  Location,
  Exit,
  MonsterTemplate,
  Item,
  Encounter,
  Provenance,
  resolveItem,
} from "@grimoire3d/ir";
import { SeededRNG } from "@grimoire3d/rules-core";
import { validateAdventure } from "@grimoire3d/validator";
import {
  GeneratorOptions,
  GeneratorOptionsSchema,
  RoomRole,
  TopologyPattern,
  GENERATOR_VERSION,
} from "./types";

interface EdgeDef {
  from: string;
  to: string;
  direction: "north" | "south" | "east" | "west" | "up" | "down";
  locked?: boolean;
  isSecret?: boolean;
}

interface RoomNode {
  id: string;
  role: RoomRole;
  label: string;
  x: number;
  y: number;
  encounterType?: "none" | "minion" | "boss";
  hasKeyItem?: boolean;
  hasChest?: boolean;
  hasTrap?: boolean;
}

export class ProceduralGenerator {
  public static generateAdventure(options: Partial<GeneratorOptions> = {}): VersionedAdventure {
    const opts = GeneratorOptionsSchema.parse(options);
    const rng = new SeededRNG(opts.seed);

    let pattern: TopologyPattern = opts.topologyPattern;
    if (pattern === "b2-hybrid") {
      const roll = rng.rollDice(3);
      pattern =
        roll === 1
          ? "hub-and-spoke"
          : roll === 2
          ? "linear-with-loopback"
          : "branching-with-bottleneck";
    }

    const keyItemId = 'brass-key';
    const biome =
      opts.theme === "cavern-complex"
        ? "cavern"
        : opts.theme === "ancient-crypt"
        ? "crypt"
        : "keep";

    const createProvenance = (entityId: string, templateId?: string): Provenance => ({
      sourceId: `proc-${opts.seed}-${entityId}`,
      extraction: {
        method: "procedural",
        generator: {
          version: GENERATOR_VERSION,
          seed: opts.seed,
          templateId: templateId || pattern,
        },
      },
      review: {
        status: "accepted",
      },
    });

    // 1. Build Room Nodes & Topology Edges
    const { nodes, edges } = this.buildTopologyGraph(opts.roomCount, pattern, rng, opts.includeKeyLockPuzzle);

    // 2. Generate Items
    const items: Item[] = [];
    if (opts.includeKeyLockPuzzle) {
      const canonicalKey = resolveItem("brass-key");
      if (canonicalKey) {
        items.push({
          ...canonicalKey,
          provenance: createProvenance("brass-key", "item-key"),
        });
      }
    }

    // 3. Generate Monster Templates
    const minionHp = 4 + opts.targetPartyLevel * 2;
    const bossHp = 15 + opts.targetPartyLevel * 6;
    const minionAtk = 2 + Math.floor(opts.targetPartyLevel / 2);
    const bossAtk = 4 + opts.targetPartyLevel;

    const monsters: MonsterTemplate[] = [
      {
        id: "proc-minion",
        name: `Dungeon Guard (Lvl ${opts.targetPartyLevel})`,
        hp: minionHp,
        ac: 13,
        attackBonus: minionAtk,
        damageRoll: `1d6+${Math.floor(opts.targetPartyLevel / 2)}`,
        xpValue: 50,
        provenance: createProvenance("proc-minion", "monster-guard"),
      },
      {
        id: "proc-boss",
        name: `Dungeon Overlord (Lvl ${opts.targetPartyLevel + 2})`,
        hp: bossHp,
        ac: 15,
        attackBonus: bossAtk,
        damageRoll: `1d8+${opts.targetPartyLevel}`,
        role: "boss",
        xpValue: 450,
        provenance: createProvenance("proc-boss", "monster-overlord"),
      },
    ];

    // 4. Map Nodes to IR Locations
    const locations: Location[] = [];
    const oppositeDir: Record<string, "north" | "south" | "east" | "west" | "up" | "down"> = {
      north: "south",
      south: "north",
      east: "west",
      west: "east",
      up: "down",
      down: "up",
    };

    for (const node of nodes) {
      const isStart = node.role === "entrance";
      const isBoss = node.role === "boss";

      // Collect exits for this room
      const exits: Exit[] = [];
      const roomEdges = edges.filter((e) => e.from === node.id || e.to === node.id);

      for (const edge of roomEdges) {
        const isOutward = edge.from === node.id;
        const targetId = isOutward ? edge.to : edge.from;
        const dir = isOutward ? edge.direction : oppositeDir[edge.direction];
        const isDoorLocked = edge.locked && opts.includeKeyLockPuzzle;

        const exitObj: Exit = {
          id: `exit-${node.id}-to-${targetId}`,
          direction: dir,
          target: targetId,
          locked: isDoorLocked ? { keyItemId } : undefined,
          provenance: createProvenance(`exit-${node.id}-to-${targetId}`, isDoorLocked ? "exit-locked" : "exit-normal"),
        };

        if (edge.isSecret) {
          exitObj.visibleWhen = {
            kind: "flag",
            flag: `secret-door-${edge.from}-discovered`,
            equals: true,
          };
        }

        exits.push(exitObj);
      }

      // Boss room connects to victory escape-tunnel
      if (isBoss) {
        exits.push({
          id: `exit-${node.id}-to-escape`,
          direction: "down",
          target: "escape-tunnel",
          provenance: createProvenance(`exit-${node.id}-to-escape`, "exit-escape"),
        });
      }

      // Interactables
      const interactables = [];
      if (node.hasKeyItem && opts.includeKeyLockPuzzle) {
        interactables.push({
          id: `chest-key-${node.id}`,
          label: "Iron Chest",
          description: "A heavy iron chest holding the brass key to the inner sanctuary.",
          onInspectEffects: [{ kind: "grantItem" as const, itemId: keyItemId }],
          provenance: createProvenance(`chest-key-${node.id}`, "interactable-chest-key"),
        });
      } else if (node.hasChest) {
        interactables.push({
          id: `treasure-chest-${node.id}`,
          label: "Jeweled Coffer",
          description: "An ancient chest filled with silver ingots and gemstones.",
          onInspectEffects: [{ kind: "setFlag" as const, flag: `found-treasure-${node.id}`, value: true }],
          provenance: createProvenance(`treasure-chest-${node.id}`, "interactable-chest-treasure"),
        });
      }

      // Secrets
      const secrets = [];
      const outwardSecretEdges = edges.filter((e) => e.from === node.id && e.isSecret);
      for (const sEdge of outwardSecretEdges) {
        secrets.push({
          id: `secret-door-${sEdge.from}`,
          label: "Concealed Stone Door",
          perceptionDC: 12,
          discovered: false,
          revealsExitId: `exit-${node.id}-to-${sEdge.to}`,
          provenance: createProvenance(`secret-door-${sEdge.from}`, "secret-door"),
        });
      }

      // Encounters
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
          provenance: createProvenance("proc-boss-encounter", "encounter-boss"),
        };
      } else if (node.encounterType === "minion") {
        encounter = {
          id: `proc-encounter-${node.id}`,
          trigger: { kind: "always" },
          enemies: [{ monsterTemplateId: "proc-minion", count: Math.max(1, rng.rollDice(2)) }],
          provenance: createProvenance(`proc-encounter-${node.id}`, "encounter-minion"),
        };
      }

      // Boundaries & Hazards
      let boundaries = undefined;
      if (node.hasTrap) {
        boundaries = {
          hazards: [
            {
              id: `pit-trap-${node.id}`,
              type: "pit-trap" as const,
              dc: 12,
              damage: "1d6",
              description: "A 10-foot concealed spiked pit trap beneath crumbly flagstones.",
            },
          ],
        };
      }

      locations.push({
        id: node.id,
        label: node.label,
        geometry: { x: node.x, y: node.y, width: 6, height: 6 },
        presentation: {
          biome,
          lighting: isStart ? "day" : "torchlit",
          ambienceTags: [opts.theme, node.role, `role-${node.role}`],
        },
        narrative: {
          playerFacingDescription: `A ${biome} chamber carved from subterranean rock. Role: ${node.role}.`,
          gmNotes: [`Procedural room ${node.id} (${node.role})`],
        },
        exits,
        interactables,
        secrets,
        encounter,
        boundaries,
        provenance: createProvenance(node.id, `room-${node.role}`),
      });
    }

    // 5. Escape Tunnel Victory Destination
    locations.push({
      id: "escape-tunnel",
      label: "Sunlight Valley Exit",
      geometry: { x: 0, y: -20, width: 6, height: 6 },
      presentation: {
        biome: "keep",
        lighting: "day",
        ambienceTags: ["daylight", "freedom", "victory"],
      },
      narrative: {
        playerFacingDescription: "A natural slope leading up to daylight and the freedom of the Borderlands!",
        gmNotes: ["Victory escape point"],
      },
      exits: [],
      interactables: [],
      secrets: [],
      provenance: createProvenance("escape-tunnel", "room-escape"),
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
            title: "Overthrow the Dungeon Overlord",
            description: "Navigate the complex, acquire the seal key, defeat the Overlord, and escape.",
            completionCondition: { kind: "flag", flag: "proc-boss-defeated", equals: true },
            rewards: [],
          },
        ],
      },
      metadata: {
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        importedBy: "extractor",
      },
    };

    // Audit generated adventure with static validator
    const audit = validateAdventure(vAdventure, { checkCombatWinnability: false });
    if (!audit.valid) {
      const errMsgs = audit.issues
        .filter((i) => i.severity === "error")
        .map((i) => i.message);
      throw new Error(`Procedural dungeon generation produced invalid IR: ${errMsgs.join("; ")}`);
    }

    return vAdventure;
  }

  /**
   * Generates room nodes and constraint-satisfying edges based on the chosen B2-inspired pattern.
   */
  private static buildTopologyGraph(
    roomCount: number,
    pattern: TopologyPattern,
    rng: SeededRNG,
    includeKeyLock: boolean
  ): { nodes: RoomNode[]; edges: EdgeDef[] } {
    const nodes: RoomNode[] = [];
    const edges: EdgeDef[] = [];

    // Room 0: Entrance
    nodes.push({
      id: "proc-start",
      role: "entrance",
      label: "1. Dungeon Entrance",
      x: 0,
      y: 0,
    });

    // Room N-1: Boss Room (placed at maximum depth)
    const bossId = "proc-boss-room";

    if (pattern === "hub-and-spoke") {
      // 1. Hub
      const hubId = "proc-hub";
      nodes.push({
        id: hubId,
        role: "hub",
        label: "2. Grand Central Vault (Hub)",
        x: 0,
        y: 10,
        encounterType: "none",
      });
      edges.push({ from: "proc-start", to: hubId, direction: "north" });

      // Divide remaining roomCount - 3 rooms into spokes
      // Spoke A: Puzzle branch (holds key)
      // Spoke B: Side branch (trap + treasure + loopback)
      // Spoke C: Bottleneck -> Boss
      const remCount = roomCount - 3; // subtract entrance, hub, boss
      const spokeACount = Math.max(1, Math.floor(remCount / 3));
      const spokeBCount = Math.max(1, Math.floor(remCount / 3));
      const spokeCCount = Math.max(1, remCount - spokeACount - spokeBCount);

      // --- Spoke A: Puzzle Branch ---
      let prevSpokeA = hubId;
      for (let i = 0; i < spokeACount; i++) {
        const id = `proc-spoke-a-${i}`;
        const isPuzzle = i === spokeACount - 1;
        nodes.push({
          id,
          role: isPuzzle ? "puzzle" : "connector",
          label: isPuzzle ? "Seal Puzzle Chamber" : `West Hallway ${i + 1}`,
          x: -10 * (i + 1),
          y: 10,
          hasKeyItem: isPuzzle,
          encounterType: isPuzzle ? "minion" : "none",
        });
        edges.push({
          from: prevSpokeA,
          to: id,
          direction: "west",
        });
        prevSpokeA = id;
      }

      // --- Spoke B: Side Branch (Treasure + Trap + Loopback) ---
      let prevSpokeB = hubId;
      for (let i = 0; i < spokeBCount; i++) {
        const id = `proc-spoke-b-${i}`;
        const isTrap = i === 0;
        const isTreasure = i === spokeBCount - 1;
        nodes.push({
          id,
          role: isTreasure ? "treasure" : isTrap ? "trap" : "connector",
          label: isTreasure ? "Ancient Treasury" : isTrap ? "Spiked Hazard Crypt" : `East Hallway ${i + 1}`,
          x: 10 * (i + 1),
          y: 10,
          hasChest: isTreasure,
          hasTrap: isTrap,
          encounterType: isTrap ? "minion" : "none",
        });
        edges.push({
          from: prevSpokeB,
          to: id,
          direction: "east",
        });
        prevSpokeB = id;
      }

      // Loopback: connect end of Spoke B back to Spoke A or Entrance via secret passage
      edges.push({
        from: prevSpokeB,
        to: "proc-start",
        direction: "south",
        isSecret: true,
      });

      // --- Spoke C: Bottleneck -> Boss Path ---
      let prevSpokeC = hubId;
      for (let i = 0; i < spokeCCount; i++) {
        const id = `proc-spoke-c-${i}`;
        const isBottleneck = i === 0;
        nodes.push({
          id,
          role: isBottleneck ? "connector" : "secret",
          label: isBottleneck ? "Sealed Iron Chokepoint" : `North Approach ${i + 1}`,
          x: 0,
          y: 10 + 10 * (i + 1),
          encounterType: "minion",
        });

        edges.push({
          from: prevSpokeC,
          to: id,
          direction: "north",
          locked: isBottleneck && includeKeyLock,
        });
        prevSpokeC = id;
      }

      // Connect to Boss Room
      nodes.push({
        id: bossId,
        role: "boss",
        label: `${roomCount}. Overlord Sanctum`,
        x: 0,
        y: 10 + 10 * (spokeCCount + 1),
        encounterType: "boss",
      });
      edges.push({
        from: prevSpokeC,
        to: bossId,
        direction: "north",
      });

    } else if (pattern === "linear-with-loopback") {
      // Main linear spine with loopback secret door and puzzle branch
      const spineCount = Math.max(2, roomCount - 3);
      let prev = "proc-start";

      // Spine rooms
      for (let i = 0; i < spineCount; i++) {
        const id = `proc-room-${i + 1}`;
        const isBottleneck = i === spineCount - 1;
        const isTrap = i === 1;

        nodes.push({
          id,
          role: isBottleneck ? "connector" : isTrap ? "trap" : i === 0 ? "hub" : "connector",
          label: isBottleneck ? "Inner Gate Chokepoint" : `Chamber ${i + 2}`,
          x: 0,
          y: 10 * (i + 1),
          hasTrap: isTrap,
          encounterType: i % 2 === 1 ? "minion" : "none",
        });

        edges.push({
          from: prev,
          to: id,
          direction: "north",
        });
        prev = id;
      }

      // Side puzzle room attached to room 1 (before bottleneck)
      const puzzleId = "proc-puzzle-crypt";
      nodes.push({
        id: puzzleId,
        role: "puzzle",
        label: "Sunken Key Crypt",
        x: -10,
        y: 10,
        hasKeyItem: true,
        encounterType: "minion",
      });
      edges.push({
        from: "proc-room-1",
        to: puzzleId,
        direction: "west",
      });

      // Side treasure room attached to room 2
      const treasureId = "proc-secret-treasury";
      nodes.push({
        id: treasureId,
        role: "treasure",
        label: "Hidden Vault",
        x: 10,
        y: 20,
        hasChest: true,
      });
      edges.push({
        from: "proc-room-2",
        to: treasureId,
        direction: "east",
      });

      // Loopback: connect treasure room back to entrance via secret door
      edges.push({
        from: treasureId,
        to: "proc-start",
        direction: "south",
        isSecret: true,
      });

      // Boss room at maximum depth from bottleneck
      nodes.push({
        id: bossId,
        role: "boss",
        label: `${roomCount}. Overlord Sanctum`,
        x: 0,
        y: 10 * (spineCount + 1),
        encounterType: "boss",
      });
      edges.push({
        from: prev,
        to: bossId,
        direction: "north",
        locked: includeKeyLock,
      });

    } else {
      // branching-with-bottleneck
      const forkId = "proc-fork-hub";
      nodes.push({
        id: forkId,
        role: "hub",
        label: "2. The Twin Hallway Fork (Hub)",
        x: 0,
        y: 10,
        encounterType: "none",
      });
      edges.push({ from: "proc-start", to: forkId, direction: "north" });

      const bottleneckId = "proc-bottleneck-gate";
      nodes.push({
        id: bottleneckId,
        role: "connector",
        label: "Fortified Archway (Bottleneck)",
        x: 0,
        y: 30,
        encounterType: "minion",
      });

      // West Wing: leads to puzzle (key)
      const west1Id = "proc-west-wing";
      nodes.push({
        id: west1Id,
        role: "connector",
        label: "West Vaulted Corridor",
        x: -10,
        y: 20,
        encounterType: "minion",
      });
      edges.push({ from: forkId, to: west1Id, direction: "west" });

      const puzzleId = "proc-puzzle-shrine";
      nodes.push({
        id: puzzleId,
        role: "puzzle",
        label: "Sanctuary of the Key",
        x: -20,
        y: 20,
        hasKeyItem: true,
      });
      edges.push({ from: west1Id, to: puzzleId, direction: "west" });
      edges.push({ from: west1Id, to: bottleneckId, direction: "north" });

      // East Wing: leads to trap + treasure
      const east1Id = "proc-east-wing";
      nodes.push({
        id: east1Id,
        role: "trap",
        label: "Trapped Colonnade",
        x: 10,
        y: 20,
        hasTrap: true,
        encounterType: "minion",
      });
      edges.push({ from: forkId, to: east1Id, direction: "east" });

      const treasureId = "proc-east-treasury";
      nodes.push({
        id: treasureId,
        role: "treasure",
        label: "Reliquary of the Ancients",
        x: 20,
        y: 20,
        hasChest: true,
      });
      edges.push({ from: east1Id, to: treasureId, direction: "east" });
      edges.push({ from: east1Id, to: bottleneckId, direction: "north" });

      // Loop connector: secret bridge between West and East wing
      edges.push({
        from: puzzleId,
        to: treasureId,
        direction: "south",
        isSecret: true,
      });

      // Extra connector rooms if requested roomCount > nodes so far
      let prevToBoss = bottleneckId;
      const currentNodesCount = nodes.length; // 7 nodes
      const extraNeeded = Math.max(0, roomCount - currentNodesCount - 1);

      for (let i = 0; i < extraNeeded; i++) {
        const id = `proc-inner-hall-${i}`;
        nodes.push({
          id,
          role: "connector",
          label: `Inner Sanctum Hallway ${i + 1}`,
          x: 0,
          y: 40 + i * 10,
          encounterType: "none",
        });
        edges.push({
          from: prevToBoss,
          to: id,
          direction: "north",
          locked: i === 0 && includeKeyLock,
        });
        prevToBoss = id;
      }

      // Boss room at maximum depth
      nodes.push({
        id: bossId,
        role: "boss",
        label: `${roomCount}. Overlord Sanctum`,
        x: 0,
        y: 40 + extraNeeded * 10,
        encounterType: "boss",
      });
      edges.push({
        from: prevToBoss,
        to: bossId,
        direction: "north",
        locked: extraNeeded === 0 && includeKeyLock,
      });
    }

    // Verify and assert constraints:
    // Compute BFS depths from entrance
    const depthMap = new Map<string, number>([["proc-start", 0]]);
    const queue = ["proc-start"];

    // Adjacency for traversal
    const adj = new Map<string, string[]>();
    for (const n of nodes) adj.set(n.id, []);
    for (const e of edges) {
      adj.get(e.from)?.push(e.to);
      adj.get(e.to)?.push(e.from);
    }

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const d = depthMap.get(curr)!;
      for (const nxt of adj.get(curr) || []) {
        if (!depthMap.has(nxt)) {
          depthMap.set(nxt, d + 1);
          queue.push(nxt);
        }
      }
    }

    // All rooms reachable check
    for (const n of nodes) {
      if (!depthMap.has(n.id)) {
        // Fallback safety link to ensure no orphan
        edges.push({ from: "proc-start", to: n.id, direction: "east" });
        depthMap.set(n.id, 1);
      }
    }

    return { nodes, edges };
  }
}
