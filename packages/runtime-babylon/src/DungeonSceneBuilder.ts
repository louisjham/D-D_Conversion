import { WorldLayout, GridTile, CompiledRoom, CompiledPortal, CompiledInteractable } from "@grimoire3d/world-compiler";
import { VersionedAdventure } from "@grimoire3d/ir";
import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  PointLight,
  Mesh,
  TransformNode,
  Texture,
} from "@babylonjs/core";

export type SceneMeshMap = {
  roomMeshes: Map<string, Mesh[]>;
  portalMeshes: Map<string, Mesh>;
  interactableMeshes: Map<string, Mesh>;
  monsterMeshes: Map<string, Mesh>;
  torchLights: PointLight[];
};

export class DungeonSceneBuilder {
  public static buildScene(
    scene: Scene,
    worldLayout: WorldLayout,
    vAdventure: VersionedAdventure,
    activeLocationId: string,
    unlockedExits: Set<string>,
    discoveredSecrets: Set<string>
  ): SceneMeshMap {
    const roomMeshes = new Map<string, Mesh[]>();
    const portalMeshes = new Map<string, Mesh>();
    const interactableMeshes = new Map<string, Mesh>();
    const monsterMeshes = new Map<string, Mesh>();
    const torchLights: PointLight[] = [];

    const rootNode = new TransformNode("dungeonRoot", scene);

    // Standard Materials
    const floorMat = new StandardMaterial("floorMat", scene);
    floorMat.diffuseColor = new Color3(0.22, 0.24, 0.28);
    floorMat.specularColor = new Color3(0.1, 0.1, 0.1);

    const activeFloorMat = new StandardMaterial("activeFloorMat", scene);
    activeFloorMat.diffuseColor = new Color3(0.12, 0.38, 0.28);

    const waterMat = new StandardMaterial("waterMat", scene);
    waterMat.diffuseColor = new Color3(0.05, 0.15, 0.35);
    waterMat.alpha = 0.8;

    const wallMat = new StandardMaterial("wallMat", scene);
    wallMat.diffuseColor = new Color3(0.16, 0.17, 0.2);

    const doorMat = new StandardMaterial("doorMat", scene);
    doorMat.diffuseColor = new Color3(0.5, 0.3, 0.12);

    const lockedDoorMat = new StandardMaterial("lockedDoorMat", scene);
    lockedDoorMat.diffuseColor = new Color3(0.6, 0.15, 0.15);

    const secretDoorMat = new StandardMaterial("secretDoorMat", scene);
    secretDoorMat.diffuseColor = new Color3(0.35, 0.2, 0.45);

    const chestMat = new StandardMaterial("chestMat", scene);
    chestMat.diffuseColor = new Color3(0.8, 0.6, 0.2);

    const viperMat = new StandardMaterial("viperMat", scene);
    viperMat.diffuseColor = new Color3(0.85, 0.15, 0.15);

    // Build Rooms
    for (const room of worldLayout.rooms) {
      const isActive = room.id === activeLocationId;
      const geom = room.bounds;
      const roomMeshList: Mesh[] = [];

      // Floor Plane
      const isWater = room.biome === "cavern" && room.id === "flooded-vault";
      const floor = MeshBuilder.CreateGround(
        `floor_${room.id}`,
        { width: geom.width, height: geom.height },
        scene
      );
      floor.position = new Vector3(geom.x + geom.width / 2, 0, geom.y + geom.height / 2);
      floor.material = isWater ? waterMat : isActive ? activeFloorMat : floorMat;
      floor.parent = rootNode;
      roomMeshList.push(floor);

      // Ceiling Plane
      const ceiling = MeshBuilder.CreateGround(
        `ceiling_${room.id}`,
        { width: geom.width, height: geom.height },
        scene
      );
      ceiling.position = new Vector3(geom.x + geom.width / 2, 3.0, geom.y + geom.height / 2);
      ceiling.rotation = new Vector3(Math.PI, 0, 0);
      ceiling.material = wallMat;
      ceiling.parent = rootNode;

      // Wall Boundaries (4 walls)
      const wallH = 3.0;
      const wallT = 0.2;

      const nWall = MeshBuilder.CreateBox(`wall_n_${room.id}`, { width: geom.width, height: wallH, depth: wallT }, scene);
      nWall.position = new Vector3(geom.x + geom.width / 2, wallH / 2, geom.y + geom.height);
      nWall.material = wallMat;
      nWall.parent = rootNode;

      const sWall = MeshBuilder.CreateBox(`wall_s_${room.id}`, { width: geom.width, height: wallH, depth: wallT }, scene);
      sWall.position = new Vector3(geom.x + geom.width / 2, wallH / 2, geom.y);
      sWall.material = wallMat;
      sWall.parent = rootNode;

      const eWall = MeshBuilder.CreateBox(`wall_e_${room.id}`, { width: wallT, height: wallH, depth: geom.height }, scene);
      eWall.position = new Vector3(geom.x + geom.width, wallH / 2, geom.y + geom.height / 2);
      eWall.material = wallMat;
      eWall.parent = rootNode;

      const wWall = MeshBuilder.CreateBox(`wall_w_${room.id}`, { width: wallT, height: wallH, depth: geom.height }, scene);
      wWall.position = new Vector3(geom.x, wallH / 2, geom.y + geom.height / 2);
      wWall.material = wallMat;
      wWall.parent = rootNode;

      // Torches
      if (room.lighting === "torchlit") {
        const torchLight = new PointLight(
          `torch_${room.id}`,
          new Vector3(geom.x + geom.width / 2, 2.2, geom.y + geom.height / 2),
          scene
        );
        torchLight.diffuse = new Color3(1.0, 0.65, 0.2);
        torchLight.intensity = isActive ? 1.6 : 0.7;
        torchLight.radius = 12;
        torchLights.push(torchLight);

        // Torch visual bracket mesh
        const torchMesh = MeshBuilder.CreateCylinder(`torchMesh_${room.id}`, { diameter: 0.15, height: 0.6 }, scene);
        torchMesh.position = new Vector3(geom.x + geom.width / 2, 1.8, geom.y + geom.height / 2);
        torchMesh.material = chestMat;
      }

      roomMeshes.set(room.id, roomMeshList);
    }

    // Build Portals / Doors
    for (const portal of worldLayout.portals) {
      const isLocked = portal.locked && !unlockedExits.has(portal.id);
      const isSecret = !!portal.visibleWhenFlag && !discoveredSecrets.has(portal.id);

      const doorMesh = MeshBuilder.CreateBox(
        `portal_${portal.id}`,
        { width: 1.0, height: 2.2, depth: 0.3 },
        scene
      );
      doorMesh.position = new Vector3(portal.gridPos.x, 1.1, portal.gridPos.y);
      doorMesh.material = isSecret ? secretDoorMat : isLocked ? lockedDoorMat : doorMat;
      doorMesh.parent = rootNode;

      portalMeshes.set(portal.id, doorMesh);
    }

    // Build Interactables (Chests, Altars, Traps)
    for (const inter of worldLayout.interactables) {
      const chestMesh = MeshBuilder.CreateBox(
        `inter_${inter.id}`,
        { width: 0.8, height: 0.6, depth: 0.6 },
        scene
      );
      chestMesh.position = new Vector3(inter.gridPos.x, 0.3, inter.gridPos.y);
      chestMesh.material = chestMat;
      chestMesh.parent = rootNode;

      interactableMeshes.set(inter.id, chestMesh);
    }

    // Build Monster Encounters (e.g. Giant Serpent Viper in Altar Chamber)
    for (const enc of worldLayout.encounterTriggers) {
      const altarRoom = worldLayout.rooms.find((r) => r.id === enc.roomId);
      if (altarRoom) {
        const viperMesh = MeshBuilder.CreateSphere(
          `monster_${enc.id}`,
          { diameter: 1.2 },
          scene
        );
        viperMesh.position = new Vector3(
          altarRoom.bounds.x + altarRoom.bounds.width / 2,
          0.6,
          altarRoom.bounds.y + altarRoom.bounds.height / 2
        );
        viperMesh.material = viperMat;
        viperMesh.parent = rootNode;

        monsterMeshes.set(enc.id, viperMesh);
      }
    }

    return {
      roomMeshes,
      portalMeshes,
      interactableMeshes,
      monsterMeshes,
      torchLights,
    };
  }
}
