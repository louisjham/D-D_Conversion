import { VersionedAdventure, Location } from "@grimoire3d/ir";
import { WorldCompiler, WorldLayout } from "@grimoire3d/world-compiler";
import { Engine, Scene, Vector3, Color3, HemisphericLight, PointLight, Mesh, GlowLayer, ParticleSystem } from "@babylonjs/core";
import { DungeonSceneBuilder, SceneMeshMap } from "./DungeonSceneBuilder";
import { FirstPersonCameraController, CameraMode } from "./FirstPersonCameraController";
import { RaycastPicker, RaycastTarget } from "./RaycastPicker";

export interface WorldRenderer {
  init(canvas: HTMLCanvasElement): void;
  renderScene(vAdventure: VersionedAdventure, activeLocationId: string, unlockedExits?: Set<string>, discoveredSecrets?: Set<string>): void;
  setCameraMode(mode: CameraMode): void;
  getRaycastTarget(): RaycastTarget | null;
  highlightEntity(entityId?: string): void;
  dispose(): void;
}

export class BabylonWorldRenderer implements WorldRenderer {
  private engine: Engine | null = null;
  private scene: Scene | null = null;
  private cameraController: FirstPersonCameraController | null = null;
  private raycastPicker: RaycastPicker | null = null;
  private meshMap: SceneMeshMap | null = null;
  private currentWorldLayout: WorldLayout | null = null;
  private glowLayer: GlowLayer | null = null;

  public init(canvas: HTMLCanvasElement): void {
    this.engine = new Engine(canvas, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color3(0.04, 0.05, 0.07).toColor4();

    // Atmospheric Dungeon Fog
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.035;
    this.scene.fogColor = new Color3(0.05, 0.06, 0.08);

    const ambientLight = new HemisphericLight("ambientLight", new Vector3(0, 1, 0), this.scene);
    ambientLight.intensity = 0.32;
    ambientLight.groundColor = new Color3(0.08, 0.09, 0.12);

    // Subtle bloom & emissive glow on torches, runes, and magic altars
    this.glowLayer = new GlowLayer("dungeonGlow", this.scene, {
      mainTextureRatio: 0.5,
      blurKernelSize: 16,
    });
    this.glowLayer.intensity = 0.65;

    this.cameraController = new FirstPersonCameraController(this.scene, canvas);
    this.raycastPicker = new RaycastPicker(this.scene);

    this.engine.runRenderLoop(() => {
      if (this.scene) {
        // Torch light flickering animation
        if (this.meshMap?.torchLights) {
          const t = Date.now() * 0.005;
          this.meshMap.torchLights.forEach((l, idx) => {
            l.intensity = 1.35 + Math.sin(t + idx * 1.5) * 0.22;
          });
        }
        this.scene.render();
      }
    });
  }

  public renderScene(
    vAdventure: VersionedAdventure,
    activeLocationId: string,
    unlockedExits: Set<string> = new Set(),
    discoveredSecrets: Set<string> = new Set()
  ): void {
    if (!this.scene) return;

    this.currentWorldLayout = WorldCompiler.compile(vAdventure);

    // Stop and dispose previous particle systems
    if (this.meshMap?.particleSystems) {
      for (const ps of this.meshMap.particleSystems) {
        ps.stop();
        ps.dispose();
      }
    }

    // Clear previous dynamic meshes
    const meshes = this.scene.meshes.slice();
    for (const mesh of meshes) {
      if (!mesh.name.includes("Camera")) {
        mesh.dispose();
      }
    }

    this.activeUnlockedExits = unlockedExits;
    this.activeDiscoveredSecrets = discoveredSecrets;

    this.meshMap = DungeonSceneBuilder.buildScene(
      this.scene,
      this.currentWorldLayout,
      vAdventure,
      activeLocationId,
      unlockedExits,
      discoveredSecrets
    );

    // Position Camera on Active Room Center
    const activeRoom = this.currentWorldLayout.rooms.find((r) => r.id === activeLocationId);
    if (activeRoom && this.cameraController) {
      const centerX = activeRoom.bounds.x + activeRoom.bounds.width / 2;
      const centerZ = activeRoom.bounds.y + activeRoom.bounds.height / 2;
      this.cameraController.setPosition(new Vector3(centerX, 1.6, centerZ));
    }
  }

  public setCameraMode(mode: CameraMode): void {
    if (this.cameraController && this.scene && this.currentWorldLayout) {
      const targetPos = this.cameraController.activeCamera.position.clone();
      this.cameraController.setMode(mode, targetPos);
    }
  }

  private activeUnlockedExits: Set<string> = new Set();
  private activeDiscoveredSecrets: Set<string> = new Set();

  public getRaycastTarget(): RaycastTarget | null {
    if (!this.raycastPicker) return null;
    return this.raycastPicker.performRaycast(5.0, this.activeDiscoveredSecrets, this.activeUnlockedExits);
  }

  public highlightEntity(entityId?: string): void {
    if (!this.scene || !entityId) return;
    const mesh = this.scene.getMeshByName(`portal_${entityId}`) || this.scene.getMeshByName(`inter_${entityId}`);
    if (mesh) {
      mesh.scaling = new Vector3(1.1, 1.1, 1.1);
    }
  }

  public dispose(): void {
    if (this.engine) {
      if (this.glowLayer) {
        this.glowLayer.dispose();
        this.glowLayer = null;
      }
      if (this.meshMap?.particleSystems) {
        for (const ps of this.meshMap.particleSystems) {
          ps.stop();
          ps.dispose();
        }
      }
      this.engine.dispose();
      this.engine = null;
      this.scene = null;
    }
  }
}
