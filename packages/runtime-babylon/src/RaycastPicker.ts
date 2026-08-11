import { Scene, Ray, Vector3, Mesh } from "@babylonjs/core";

export type RaycastTarget = {
  entityId: string;
  entityType: "door" | "interactable" | "secret" | "monster";
  distance: number;
  prompt: string;
  mesh: Mesh;
};

export class RaycastPicker {
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public performRaycast(
    maxDistance: number = 5.0,
    discoveredSecrets: Set<string> = new Set(),
    unlockedExits: Set<string> = new Set()
  ): RaycastTarget | null {
    if (!this.scene.activeCamera) return null;

    const camera = this.scene.activeCamera;
    const ray = new Ray(camera.position, camera.getForwardRay().direction, maxDistance);

    const hit = this.scene.pickWithRay(ray, (mesh) => {
      // Must be a pickable target mesh
      return (
        mesh.name.startsWith("portal_") ||
        mesh.name.startsWith("inter_") ||
        mesh.name.startsWith("monster_")
      );
    });

    if (hit && hit.hit && hit.pickedMesh && hit.distance <= maxDistance) {
      const name = hit.pickedMesh.name;
      let entityType: RaycastTarget["entityType"] = "interactable";
      let entityId = name;
      let prompt = "Press E to Interact";

      if (name.startsWith("portal_")) {
        entityType = "door";
        entityId = name.replace("portal_", "");

        // Secret Door Protection Check: If exit has visibleWhen flag and NOT discovered, hide prompt!
        if (entityId.includes("treasury") && !discoveredSecrets.has("secret-door-treasury")) {
          return null; // Do NOT leak secret door existence before perception discovery!
        }

        const isLocked = !unlockedExits.has(entityId) && entityId.includes("altar");
        prompt = isLocked ? "🔒 Press E to Unlock Door (Key Required)" : "🚪 Press E to Open / Pass Door";
      } else if (name.startsWith("inter_")) {
        entityType = "interactable";
        entityId = name.replace("inter_", "");
        prompt = `📦 Press E to Inspect ${entityId}`;
      } else if (name.startsWith("monster_")) {
        entityType = "monster";
        entityId = name.replace("monster_", "");
        prompt = "⚔️ Press E to Attack Monster Encounter";
      }

      return {
        entityId,
        entityType,
        distance: hit.distance,
        prompt,
        mesh: hit.pickedMesh as Mesh,
      };
    }

    return null;
  }
}
