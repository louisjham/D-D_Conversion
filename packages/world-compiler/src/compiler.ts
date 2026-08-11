import { VersionedAdventure, Location, Exit, RoomGeometry } from "@grimoire3d/ir";

export type TileType = "floor" | "wall" | "door" | "secretDoor" | "water" | "stairs";

export type GridPosition = {
  x: number;
  y: number;
};

export type GridTile = {
  x: number;
  y: number;
  type: TileType;
  roomId?: string;
  passable: boolean;
  interactableId?: string;
  portalId?: string;
};

export type CompiledRoom = {
  id: string;
  label: string;
  bounds: RoomGeometry;
  biome: string;
  lighting: string;
  ambienceTags: string[];
  playerFacingDescription: string;
  gmNotes: string[];
};

export type CompiledPortal = {
  id: string;
  direction: "north" | "south" | "east" | "west" | "up" | "down";
  fromRoomId: string;
  toRoomId: string;
  locked: boolean;
  keyItemId?: string;
  pickable?: boolean;
  lockpickDC?: number;
  visibleWhenFlag?: string;
  gridPos: GridPosition;
};

export type CompiledInteractable = {
  id: string;
  label: string;
  description: string;
  roomId: string;
  gridPos: GridPosition;
  inspectionCheck?: { ability: string; dc: number };
  grantItemIds?: string[];
  setFlags?: { flag: string; value: boolean }[];
};

export type CompiledEncounterTrigger = {
  id: string;
  roomId: string;
  enemies: { monsterTemplateId: string; count: number }[];
  tactics?: string;
  victoryEffects?: any[];
};

export type WorldLayout = {
  adventureId: string;
  gridWidth: number;
  gridHeight: number;
  tiles: GridTile[][];
  rooms: CompiledRoom[];
  portals: CompiledPortal[];
  interactables: CompiledInteractable[];
  encounterTriggers: CompiledEncounterTrigger[];
  spawnPoint: {
    roomId: string;
    gridPos: GridPosition;
  };
};

export class WorldCompiler {
  public static compile(vAdventure: VersionedAdventure): WorldLayout {
    const adv = vAdventure.adventure;

    // Calculate maximum bounds of grid
    let maxGridX = 30;
    let maxGridY = 30;

    for (const loc of adv.locations) {
      const rightX = loc.geometry.x + loc.geometry.width + 4;
      const bottomY = loc.geometry.y + loc.geometry.height + 4;
      if (rightX > maxGridX) maxGridX = rightX;
      if (bottomY > maxGridY) maxGridY = bottomY;
    }

    // Initialize tile grid filled with walls
    const tiles: GridTile[][] = Array.from({ length: maxGridY }, (_, y) =>
      Array.from({ length: maxGridX }, (_, x) => ({
        x,
        y,
        type: "wall" as TileType,
        passable: false,
      }))
    );

    const compiledRooms: CompiledRoom[] = [];
    const compiledPortals: CompiledPortal[] = [];
    const compiledInteractables: CompiledInteractable[] = [];
    const compiledEncounters: CompiledEncounterTrigger[] = [];

    // 1. Carve Out Rooms
    for (const loc of adv.locations) {
      const g = loc.geometry;
      const biomeTileType: TileType = loc.presentation.biome === "cavern" && loc.id === "flooded-vault" ? "water" : "floor";

      for (let y = g.y; y < g.y + g.height; y++) {
        for (let x = g.x; x < g.x + g.width; x++) {
          if (y >= 0 && y < maxGridY && x >= 0 && x < maxGridX) {
            tiles[y][x] = {
              x,
              y,
              type: biomeTileType,
              roomId: loc.id,
              passable: true,
            };
          }
        }
      }

      compiledRooms.push({
        id: loc.id,
        label: loc.label,
        bounds: loc.geometry,
        biome: loc.presentation.biome,
        lighting: loc.presentation.lighting,
        ambienceTags: loc.presentation.ambienceTags,
        playerFacingDescription: loc.narrative.playerFacingDescription,
        gmNotes: loc.narrative.gmNotes,
      });

      // Carve Out Exits / Doors
      for (const exit of loc.exits) {
        let portalX = g.x + Math.floor(g.width / 2);
        let portalY = g.y + Math.floor(g.height / 2);

        if (exit.direction === "east") portalX = g.x + g.width;
        if (exit.direction === "west") portalX = g.x - 1;
        if (exit.direction === "north") portalY = g.y + g.height;
        if (exit.direction === "south") portalY = g.y - 1;

        if (portalY >= 0 && portalY < maxGridY && portalX >= 0 && portalX < maxGridX) {
          const isSecret = !!exit.visibleWhen;
          const doorTileType: TileType = isSecret ? "secretDoor" : "door";

          tiles[portalY][portalX] = {
            x: portalX,
            y: portalY,
            type: doorTileType,
            roomId: loc.id,
            passable: !exit.locked,
            portalId: exit.id,
          };

          compiledPortals.push({
            id: exit.id,
            direction: exit.direction,
            fromRoomId: loc.id,
            toRoomId: exit.target,
            locked: !!exit.locked,
            keyItemId: exit.locked?.keyItemId,
            pickable: exit.locked?.pickable,
            lockpickDC: exit.locked?.lockpickDC,
            visibleWhenFlag: exit.visibleWhen?.kind === "flag" ? exit.visibleWhen.flag : undefined,
            gridPos: { x: portalX, y: portalY },
          });
        }
      }

      // Carve Out Interactables
      loc.interactables.forEach((inter, idx) => {
        const interX = g.x + 1 + (idx % Math.max(1, g.width - 2));
        const interY = g.y + 1 + Math.floor(idx / Math.max(1, g.width - 2));

        if (interY >= 0 && interY < maxGridY && interX >= 0 && interX < maxGridX) {
          tiles[interY][interX].interactableId = inter.id;

          const grantItemIds: string[] = [];
          const setFlags: { flag: string; value: boolean }[] = [];

          if (inter.onInspectEffects) {
            for (const eff of inter.onInspectEffects) {
              if (eff.kind === "grantItem") grantItemIds.push(eff.itemId);
              if (eff.kind === "setFlag") setFlags.push({ flag: eff.flag, value: eff.value });
            }
          }

          compiledInteractables.push({
            id: inter.id,
            label: inter.label,
            description: inter.description,
            roomId: loc.id,
            gridPos: { x: interX, y: interY },
            inspectionCheck: inter.inspectionCheck,
            grantItemIds,
            setFlags,
          });
        }
      });

      // Encounters
      if (loc.encounter) {
        compiledEncounters.push({
          id: loc.encounter.id,
          roomId: loc.id,
          enemies: loc.encounter.enemies,
          tactics: loc.encounter.tactics,
          victoryEffects: loc.encounter.victoryEffects,
        });
      }
    }

    // Spawn Point
    const startLoc = adv.locations.find((l) => l.id === adv.start) || adv.locations[0];
    const spawnPos: GridPosition = {
      x: startLoc.geometry.x + Math.floor(startLoc.geometry.width / 2),
      y: startLoc.geometry.y + Math.floor(startLoc.geometry.height / 2),
    };

    return {
      adventureId: adv.id,
      gridWidth: maxGridX,
      gridHeight: maxGridY,
      tiles,
      rooms: compiledRooms,
      portals: compiledPortals,
      interactables: compiledInteractables,
      encounterTriggers: compiledEncounters,
      spawnPoint: {
        roomId: startLoc.id,
        gridPos: spawnPos,
      },
    };
  }
}
