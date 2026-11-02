import { WorldLayout, GridTile, CompiledRoom, CompiledPortal, CompiledInteractable } from "@grimoire3d/world-compiler";
import { VersionedAdventure } from "@grimoire3d/ir";
import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Color4,
  PointLight,
  Mesh,
  TransformNode,
  Texture,
  DynamicTexture,
  ParticleSystem,
} from "@babylonjs/core";

export type SceneMeshMap = {
  roomMeshes: Map<string, Mesh[]>;
  portalMeshes: Map<string, Mesh>;
  interactableMeshes: Map<string, Mesh>;
  monsterMeshes: Map<string, Mesh>;
  torchLights: PointLight[];
  particleSystems: ParticleSystem[];
};

export class DungeonSceneBuilder {
  /**
   * Helper to create a procedural glow particle texture in memory
   * so no external particle image file dependency is required.
   */
  private static getOrCreateParticleTexture(scene: Scene): Texture {
    const existing = scene.getTextureByName("proceduralFlameParticle");
    if (existing) return existing as Texture;

    const dt = new DynamicTexture("proceduralFlameParticle", 64, scene, false);
    const ctx = dt.getContext() as CanvasRenderingContext2D;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255, 240, 200, 1.0)");
    grad.addColorStop(0.35, "rgba(255, 140, 30, 0.85)");
    grad.addColorStop(0.7, "rgba(210, 45, 10, 0.45)");
    grad.addColorStop(1, "rgba(40, 10, 0, 0.0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    dt.update();
    return dt;
  }

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
    const particleSystems: ParticleSystem[] = [];

    const rootNode = new TransformNode("dungeonRoot", scene);
    const particleTexture = this.getOrCreateParticleTexture(scene);

    // 1. Textures & Materials
    const floorTexture = new Texture("/assets/textures/stone_floor.png", scene);
    const caveFloorTexture = new Texture("/assets/textures/cave_floor.png", scene);
    const wallTexture = new Texture("/assets/textures/stone_wall.png", scene);
    const waterTexture = new Texture("/assets/textures/water.png", scene);
    const woodPlanksTexture = new Texture("/assets/textures/wood_planks.png", scene);

    // Floor Materials
    const floorMat = new StandardMaterial("floorMat", scene);
    floorMat.diffuseTexture = floorTexture;
    floorMat.specularColor = new Color3(0.08, 0.08, 0.08);

    const cavernFloorMat = new StandardMaterial("cavernFloorMat", scene);
    cavernFloorMat.diffuseTexture = caveFloorTexture;
    cavernFloorMat.specularColor = new Color3(0.12, 0.12, 0.12);

    const activeFloorMat = new StandardMaterial("activeFloorMat", scene);
    activeFloorMat.diffuseTexture = floorTexture;
    activeFloorMat.diffuseColor = new Color3(0.9, 1.0, 0.95);
    activeFloorMat.emissiveColor = new Color3(0.03, 0.08, 0.05);

    const waterMat = new StandardMaterial("waterMat", scene);
    waterMat.diffuseTexture = waterTexture;
    waterMat.diffuseColor = new Color3(0.2, 0.5, 0.6);
    waterMat.specularColor = new Color3(0.8, 0.9, 1.0);
    waterMat.specularPower = 32;
    waterMat.alpha = 0.88;

    // Wall Material
    const wallMat = new StandardMaterial("wallMat", scene);
    wallMat.diffuseTexture = wallTexture;
    wallMat.specularColor = new Color3(0.05, 0.05, 0.05);

    // Door Materials
    const doorMat = new StandardMaterial("doorMat", scene);
    doorMat.diffuseTexture = woodPlanksTexture;
    doorMat.specularColor = new Color3(0.15, 0.12, 0.08);

    const lockedDoorMat = new StandardMaterial("lockedDoorMat", scene);
    lockedDoorMat.diffuseTexture = woodPlanksTexture;
    lockedDoorMat.diffuseColor = new Color3(0.9, 0.45, 0.45);
    lockedDoorMat.emissiveColor = new Color3(0.12, 0.02, 0.02);

    const secretDoorMat = new StandardMaterial("secretDoorMat", scene);
    secretDoorMat.diffuseTexture = wallTexture; // Disguised as stone wall
    secretDoorMat.diffuseColor = new Color3(0.7, 0.6, 0.8);
    secretDoorMat.emissiveColor = new Color3(0.08, 0.02, 0.1);

    // Interactable & Monster Materials
    const chestMat = new StandardMaterial("chestMat", scene);
    chestMat.diffuseTexture = woodPlanksTexture;
    chestMat.diffuseColor = new Color3(0.85, 0.65, 0.35);
    chestMat.specularColor = new Color3(0.4, 0.3, 0.1);

    const viperMat = new StandardMaterial("viperMat", scene);
    viperMat.diffuseColor = new Color3(0.15, 0.45, 0.25);
    viperMat.emissiveColor = new Color3(0.1, 0.3, 0.15);
    viperMat.specularColor = new Color3(0.6, 0.8, 0.6);

    // Build Rooms
    for (const room of worldLayout.rooms) {
      const isActive = room.id === activeLocationId;
      const geom = room.bounds;
      const roomMeshList: Mesh[] = [];

      const isWater = room.biome === "cavern" && room.id === "flooded-vault";
      const isCavern = room.biome === "cavern";

      // Floor Plane
      const floor = MeshBuilder.CreateGround(
        `floor_${room.id}`,
        { width: geom.width, height: geom.height },
        scene
      );
      floor.position = new Vector3(geom.x + geom.width / 2, 0, geom.y + geom.height / 2);

      // Clone material with per-room texture tiling based on room dimensions
      const roomFloorMat = (isWater ? waterMat : isCavern ? cavernFloorMat : isActive ? activeFloorMat : floorMat).clone(`floorMat_${room.id}`);
      if (roomFloorMat.diffuseTexture && "uScale" in roomFloorMat.diffuseTexture) {
        const tex = roomFloorMat.diffuseTexture as Texture;
        tex.uScale = Math.max(1, geom.width / 2);
        tex.vScale = Math.max(1, geom.height / 2);
      }
      floor.material = roomFloorMat;
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

      const roomCeilMat = wallMat.clone(`ceilMat_${room.id}`);
      if (roomCeilMat.diffuseTexture && "uScale" in roomCeilMat.diffuseTexture) {
        const tex = roomCeilMat.diffuseTexture as Texture;
        tex.uScale = Math.max(1, geom.width / 2);
        tex.vScale = Math.max(1, geom.height / 2);
      }
      ceiling.material = roomCeilMat;
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

      // Torches & Atmospheric Particles
      if (room.lighting === "torchlit") {
        const torchPos = new Vector3(geom.x + geom.width / 2, 2.2, geom.y + geom.height / 2);

        const torchLight = new PointLight(`torch_${room.id}`, torchPos, scene);
        torchLight.diffuse = new Color3(1.0, 0.62, 0.22);
        torchLight.specular = new Color3(0.8, 0.45, 0.1);
        torchLight.intensity = isActive ? 1.7 : 0.75;
        torchLight.radius = 12;
        torchLights.push(torchLight);

        // Torch visual bracket mesh
        const torchMesh = MeshBuilder.CreateCylinder(`torchMesh_${room.id}`, { diameter: 0.12, height: 0.55 }, scene);
        torchMesh.position = new Vector3(torchPos.x, 1.8, torchPos.z);
        torchMesh.material = chestMat;

        // Particle System for Torch Flame & Embers
        const flameParticles = new ParticleSystem(`torchFlame_${room.id}`, 80, scene);
        flameParticles.particleTexture = particleTexture;
        flameParticles.emitter = new Vector3(torchPos.x, 2.1, torchPos.z);
        flameParticles.minEmitBox = new Vector3(-0.04, 0, -0.04);
        flameParticles.maxEmitBox = new Vector3(0.04, 0, 0.04);

        // Warm torch fire colors
        flameParticles.color1 = new Color4(1.0, 0.7, 0.2, 1.0);
        flameParticles.color2 = new Color4(0.9, 0.35, 0.05, 0.85);
        flameParticles.colorDead = new Color4(0.2, 0.05, 0.0, 0.0);

        flameParticles.minSize = 0.12;
        flameParticles.maxSize = 0.28;
        flameParticles.minLifeTime = 0.35;
        flameParticles.maxLifeTime = 0.85;
        flameParticles.emitRate = 45;
        flameParticles.blendMode = ParticleSystem.BLENDMODE_ADD;
        flameParticles.gravity = new Vector3(0, 0.7, 0);
        flameParticles.direction1 = new Vector3(-0.08, 0.8, -0.08);
        flameParticles.direction2 = new Vector3(0.08, 1.2, 0.08);
        flameParticles.minEmitPower = 0.2;
        flameParticles.maxEmitPower = 0.5;
        flameParticles.updateSpeed = 0.012;

        flameParticles.start();
        particleSystems.push(flameParticles);
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
      particleSystems,
    };
  }
}
