import { Scene, UniversalCamera, Vector3, ArcRotateCamera, Camera } from "@babylonjs/core";

export type CameraMode = "firstPerson" | "thirdPerson" | "topDown";

export class FirstPersonCameraController {
  private scene: Scene;
  private canvas: HTMLCanvasElement;
  public activeCamera: Camera;
  public cameraMode: CameraMode = "firstPerson";

  private fpCamera: UniversalCamera;
  private tpCamera: ArcRotateCamera;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.canvas = canvas;

    // First Person Camera Setup
    this.fpCamera = new UniversalCamera("fpCamera", new Vector3(2, 1.6, 2), this.scene);
    this.fpCamera.speed = 0.4;
    this.fpCamera.angularSensibility = 2000;
    this.fpCamera.keysUp.push(87); // W
    this.fpCamera.keysDown.push(83); // S
    this.fpCamera.keysLeft.push(65); // A
    this.fpCamera.keysRight.push(68); // D
    this.fpCamera.checkCollisions = true;
    this.fpCamera.ellipsoid = new Vector3(0.4, 0.8, 0.4);

    // Third Person / Top-Down Camera Setup
    this.tpCamera = new ArcRotateCamera(
      "tpCamera",
      Math.PI / 4,
      Math.PI / 3,
      20,
      new Vector3(2, 1, 2),
      this.scene
    );

    this.activeCamera = this.fpCamera;
    this.scene.activeCamera = this.fpCamera;
    this.fpCamera.attachControl(this.canvas, true);
  }

  public setMode(mode: CameraMode, targetPos: Vector3) {
    this.cameraMode = mode;
    this.fpCamera.detachControl();
    this.tpCamera.detachControl();

    if (mode === "firstPerson") {
      this.fpCamera.position = new Vector3(targetPos.x, 1.6, targetPos.z);
      this.activeCamera = this.fpCamera;
      this.scene.activeCamera = this.fpCamera;
      this.fpCamera.attachControl(this.canvas, true);
    } else if (mode === "thirdPerson") {
      this.tpCamera.target = new Vector3(targetPos.x, 1.0, targetPos.z);
      this.tpCamera.radius = 12;
      this.tpCamera.alpha = Math.PI / 4;
      this.tpCamera.beta = Math.PI / 3;
      this.activeCamera = this.tpCamera;
      this.scene.activeCamera = this.tpCamera;
      this.tpCamera.attachControl(this.canvas, true);
    } else if (mode === "topDown") {
      this.tpCamera.target = new Vector3(targetPos.x, 0, targetPos.z);
      this.tpCamera.radius = 28;
      this.tpCamera.alpha = Math.PI / 2;
      this.tpCamera.beta = 0.01;
      this.activeCamera = this.tpCamera;
      this.scene.activeCamera = this.tpCamera;
      this.tpCamera.attachControl(this.canvas, true);
    }
  }

  public setPosition(pos: Vector3) {
    this.fpCamera.position = new Vector3(pos.x, 1.6, pos.z);
    this.tpCamera.target = new Vector3(pos.x, 1.0, pos.z);
  }
}
