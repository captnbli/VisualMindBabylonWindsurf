import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Matrix, Quaternion } from "@babylonjs/core/Maths/math";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Plane } from "@babylonjs/core/Maths/math.plane";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

import { ConceptMap } from "./concepts/concept_map";
import { Mode, Types } from "./concepts/types";

interface ModeControllerConfig {
  scene: Scene;
  camera: Camera;
  engine: Engine;
  worldRoot: TransformNode;
}

const DRAG_THRESHOLD_PX = 3;

enum InputState {
  Idle = "idle",
  PointerArmed = "pointer_armed",
  Rotating = "rotating",
  Panning = "panning",
  DraggingSphere = "dragging_sphere",
}

class ModeController {
  public get draggableObjects(): Mesh[] {
    return [];
  }

  private readonly keyMap: Record<string, Mode> = {
    a: Types.Answer,
    q: Types.Question,
    n: Types.Note,
    "+": Types.Plus,
    "-": Types.Minus,
    l: Types.Link,
    r: Types.Reference,
  };

  private mode: Mode | null = null;
  private scene!: Scene;
  private camera!: ArcRotateCamera;
  private engine!: Engine;
  private worldRoot!: TransformNode;
  private objects: any[] = [];

  private inputState: InputState = InputState.Idle;
  private activePointerId: number | null = null;
  private activeButton: number | null = null;
  private lastPointerX: number = 0;
  private lastPointerY: number = 0;
  private hasMoved: boolean = false;

  private draggedSphere: Mesh | null = null;
  private dragPlane: Plane | null = null;
  private dragOffset: Vector3 = Vector3.Zero();

  private selectedConcept: any | null = null;
  private readonly homePlaneOrigin: Vector3 = Vector3.Zero();
  private homePlaneNormal: Vector3 = Vector3.Forward();
  private homeCameraRadius: number = 100;

  init({ scene, camera, engine, worldRoot }: ModeControllerConfig): void {
    this.scene = scene;
    if (!(camera instanceof ArcRotateCamera)) {
      throw new Error("Camera must be an ArcRotateCamera");
    }

    this.camera = camera;
    this.engine = engine;
    this.worldRoot = worldRoot;
    this.worldRoot.rotationQuaternion = this.worldRoot.rotationQuaternion ?? Quaternion.Identity();
    const initialForward = this.camera.getTarget().subtract(this.camera.position).normalize();
    // Home plane faces the camera and passes through origin.
    this.homePlaneNormal = initialForward.scale(-1);
    this.homeCameraRadius = this.camera.radius;
    this.mode = Types.Answer;
    this.attachEventListeners();
  }

  setMode(newMode: Mode): void {
    this.mode = newMode;
    console.log(`Mode set to: ${newMode}`);
  }

  getMode(): Mode | null {
    return this.mode;
  }

  private attachEventListeners(): void {
    window.addEventListener("keydown", (event) => this.handleKeydown(event));
    const canvas = this.engine.getRenderingCanvas();
    if (!canvas) {
      return;
    }

    canvas.addEventListener("pointerdown", (event) => this.handlePointerDown(event), false);
    canvas.addEventListener("pointermove", (event) => this.handlePointerMove(event), false);
    canvas.addEventListener("pointerup", (event) => this.handlePointerUp(event), false);
    canvas.addEventListener("wheel", (event) => this.handleWheel(event), false);
    canvas.addEventListener("contextmenu", (event) => event.preventDefault(), false);

    window.addEventListener("resize", () => this.handleWindowResize());
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (this.selectedConcept) {
      if (event.key === "Escape" || event.key === "Enter") {
        this.selectedConcept = null;
        return;
      }

      if (event.key === "Delete") {
        event.preventDefault();
        this.deleteSelectedConcept();
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        const current = this.selectedConcept.getOverlayText?.() ?? "";
        this.selectedConcept.setOverlayText?.(current.slice(0, -1));
        return;
      }

      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) {
        event.preventDefault();
        const current = this.selectedConcept.getOverlayText?.() ?? "";
        if (current.length < 12) {
          this.selectedConcept.setOverlayText?.(current + event.key);
        }
        return;
      }
    }

    const key = event.key.toLowerCase();
    const matchedMode = this.keyMap[key];
    if (matchedMode) {
      this.setMode(matchedMode);
      return;
    }

    console.log(`Unmapped key: ${key}`);
  }

  private handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0 && event.button !== 2) {
      return;
    }

    const pointer = this.getPointerPosition(event);
    if (!pointer) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    this.scene.pointerX = pointer.x;
    this.scene.pointerY = pointer.y;
    this.lastPointerX = pointer.x;
    this.lastPointerY = pointer.y;

    this.activePointerId = event.pointerId;
    this.activeButton = event.button;
    this.hasMoved = false;
    this.draggedSphere = null;
    this.dragPlane = null;
    this.dragOffset = Vector3.Zero();

    const canvas = this.engine.getRenderingCanvas();
    if (canvas?.setPointerCapture) {
      canvas.setPointerCapture(event.pointerId);
    }

    if (event.button === 2) {
      const spherePick = this.pickSphereAtScenePointer();
      if (spherePick && spherePick.hit && spherePick.pickedMesh) {
        // Ignore right-drag gestures that start on a sphere to avoid unintended artifacts.
        this.resetPointerInteraction();
        return;
      }
      this.inputState = InputState.Panning;
      return;
    }

    const spherePick = this.pickSphereAtScenePointer();
    if (spherePick && spherePick.hit && spherePick.pickedMesh) {
      this.draggedSphere = spherePick.pickedMesh as Mesh;
      // Mouse-down on sphere enters move mode; entry mode starts on release.
      this.selectedConcept = null;

      const dragPlaneNormal = this.camera.getTarget().subtract(this.camera.position).normalize();
      const dragPlaneOrigin = spherePick.pickedPoint ?? this.draggedSphere.position.clone();
      this.dragPlane = Plane.FromPositionAndNormal(dragPlaneOrigin, dragPlaneNormal);

      const ray = this.scene.createPickingRay(
        this.scene.pointerX,
        this.scene.pointerY,
        Matrix.Identity(),
        this.camera
      );
      const hitDistance = ray.intersectsPlane(this.dragPlane);
      if (hitDistance != null) {
        const hitPoint = ray.origin.add(ray.direction.scale(hitDistance));
        this.dragOffset = this.draggedSphere.position.subtract(hitPoint);
      }

      this.inputState = InputState.DraggingSphere;
      return;
    }

    this.selectedConcept = null;
    this.inputState = InputState.PointerArmed;
  }

  private handlePointerMove(event: PointerEvent): void {
    if (this.activePointerId !== null && event.pointerId !== this.activePointerId) {
      return;
    }

    const pointer = this.getPointerPosition(event);
    if (!pointer) {
      return;
    }

    this.scene.pointerX = pointer.x;
    this.scene.pointerY = pointer.y;

    if (this.inputState === InputState.Idle) {
      return;
    }

    const deltaX = pointer.x - this.lastPointerX;
    const deltaY = pointer.y - this.lastPointerY;

    if (Math.abs(deltaX) > DRAG_THRESHOLD_PX || Math.abs(deltaY) > DRAG_THRESHOLD_PX) {
      this.hasMoved = true;
      if (this.inputState === InputState.PointerArmed) {
        this.inputState = InputState.Rotating;
      }
    }

    if (this.inputState === InputState.DraggingSphere && this.draggedSphere && this.dragPlane) {
      const ray = this.scene.createPickingRay(
        this.scene.pointerX,
        this.scene.pointerY,
        Matrix.Identity(),
        this.camera
      );
      const dragDistance = ray.intersectsPlane(this.dragPlane);
      if (dragDistance != null) {
        const dragPoint = ray.origin.add(ray.direction.scale(dragDistance));
        const desiredWorldPos = dragPoint.add(this.dragOffset);
        this.draggedSphere.position = this.worldToRootLocal(desiredWorldPos);
      }
      this.lastPointerX = pointer.x;
      this.lastPointerY = pointer.y;
      return;
    }

    if (this.inputState === InputState.Panning) {
      const forward = this.camera.getTarget().subtract(this.camera.position).normalize();
      const worldUp = Vector3.Up();
      let right = Vector3.Cross(forward, worldUp);
      if (right.lengthSquared() < 1e-6) {
        right = Vector3.Right();
      } else {
        right.normalize();
      }
      const up = Vector3.Cross(right, forward).normalize();

      const panScale = this.camera.radius * 0.0006;
      const panOffset = right.scale(deltaX * panScale).add(up.scale(deltaY * panScale));
      this.worldRoot.position = this.worldRoot.position.add(panOffset);

      this.lastPointerX = pointer.x;
      this.lastPointerY = pointer.y;
      return;
    }

    if (this.inputState === InputState.Rotating) {
      this.rotateModel(deltaX, deltaY);
    }

    this.lastPointerX = pointer.x;
    this.lastPointerY = pointer.y;
  }

  private handlePointerUp(event: PointerEvent): void {
    if (this.activePointerId !== null && event.pointerId !== this.activePointerId) {
      return;
    }

    if (this.activeButton === 0 && this.inputState === InputState.DraggingSphere) {
      this.selectedConcept = this.getConceptFromSphere(this.draggedSphere);
    }

    if (this.activeButton === 0 && this.inputState === InputState.PointerArmed && !this.hasMoved) {
      this.createConceptAtPointer();
    }
    this.resetPointerInteraction();
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const zoomFactor = 1.1;
    const delta = event.deltaY > 0 ? zoomFactor : 1 / zoomFactor;
    this.camera.radius *= delta;

    if (this.camera.lowerRadiusLimit !== null) {
      this.camera.radius = Math.max(this.camera.radius, this.camera.lowerRadiusLimit);
    }
    if (this.camera.upperRadiusLimit !== null) {
      this.camera.radius = Math.min(this.camera.radius, this.camera.upperRadiusLimit);
    }
  }

  private handleWindowResize(): void {
    this.engine.resize();
  }

  private getPointerPosition(event: MouseEvent | PointerEvent): { x: number; y: number } | null {
    const canvas = this.engine.getRenderingCanvas();
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  private pickSphereAtScenePointer() {
    return this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => {
      return !!mesh && mesh.name.startsWith("sphere");
    });
  }

  private resetPointerInteraction(): void {
    const canvas = this.engine.getRenderingCanvas();
    if (canvas && this.activePointerId !== null && canvas.releasePointerCapture) {
      try {
        canvas.releasePointerCapture(this.activePointerId);
      } catch {
        // Ignore when capture was already released.
      }
    }

    this.inputState = InputState.Idle;
    this.activePointerId = null;
    this.activeButton = null;
    this.hasMoved = false;
    this.draggedSphere = null;
    this.dragPlane = null;
    this.dragOffset = Vector3.Zero();
  }

  private rotateModel(deltaX: number, deltaY: number): void {
    const baseRotationSpeed = 0.00045;
    const rotationSpeed = baseRotationSpeed * (100 / Math.max(this.camera.radius, 20));
    const yaw = -deltaX * rotationSpeed;
    const pitch = -deltaY * rotationSpeed;

    const viewDir = this.camera.getTarget().subtract(this.camera.position).normalize();
    let cameraRight = Vector3.Cross(viewDir, Vector3.Up());
    if (cameraRight.lengthSquared() < 1e-8) {
      cameraRight = Vector3.Right();
    } else {
      cameraRight.normalize();
    }

    const yawQ = Quaternion.RotationAxis(Vector3.Up(), yaw);
    const pitchQ = Quaternion.RotationAxis(cameraRight, pitch);
    const stepQ = yawQ.multiply(pitchQ);
    const currentQ = this.worldRoot.rotationQuaternion ?? Quaternion.Identity();
    this.worldRoot.rotationQuaternion = stepQ.multiply(currentQ).normalize();
  }

  // Home plane goes through origin and is parallel to the initial camera view.
  // Zoom shifts placement to parallel planes along the home-plane normal.
  private getPlacementPlane(): { origin: Vector3; normal: Vector3 } {
    const zoomDelta = (this.camera.radius - this.homeCameraRadius) * 0.5;
    const planeOrigin = this.homePlaneOrigin.add(this.homePlaneNormal.scale(zoomDelta));
    return {
      origin: planeOrigin,
      normal: this.homePlaneNormal,
    };
  }

  createConceptAtPointer(): void {
    const currentMode = this.getMode();
    if (!currentMode || !ConceptMap[currentMode]) {
      console.log("No mode selected or invalid mode.");
      return;
    }

    const ray = this.scene.createPickingRay(
      this.scene.pointerX,
      this.scene.pointerY,
      Matrix.Identity(),
      this.camera
    );

    const { origin: planeOrigin, normal: planeNormal } = this.getPlacementPlane();
    const plane = Plane.FromPositionAndNormal(planeOrigin, planeNormal);
    const distance = ray.intersectsPlane(plane);

    if (distance == null) {
      console.log("Could not determine position for new concept.");
      return;
    }

    const pos = ray.origin.add(ray.direction.scale(distance));
    const localPos = this.worldToRootLocal(pos);

    const ConceptClass = ConceptMap[currentMode];
    const createdObject = new ConceptClass(this.scene, {
      position: localPos,
      camera: this.camera,
      engine: this.engine,
    });

    if (createdObject?.sphere) {
      createdObject.sphere.parent = this.worldRoot;
      const metadata = createdObject.sphere.metadata ?? {};
      createdObject.sphere.metadata = { ...metadata, conceptRef: createdObject };
    }

    this.objects.push(createdObject);
    this.selectedConcept = createdObject;
    console.log(`Created ${currentMode} at`, pos.toString());
  }

  private getConceptFromSphere(sphere: Mesh | null): any | null {
    if (!sphere) {
      return null;
    }
    const metadataConcept = sphere.metadata?.conceptRef;
    if (metadataConcept) {
      return metadataConcept;
    }
    const matched = this.objects.find((object) => object?.sphere === sphere);
    return matched ?? null;
  }

  private worldToRootLocal(worldPos: Vector3): Vector3 {
    this.worldRoot.computeWorldMatrix(true);
    const inv = this.worldRoot.getWorldMatrix().clone();
    inv.invert();
    return Vector3.TransformCoordinates(worldPos, inv);
  }

  private deleteSelectedConcept(): void {
    if (!this.selectedConcept) {
      return;
    }
    const conceptToDelete = this.selectedConcept;
    this.objects = this.objects.filter((object) => object !== conceptToDelete);
    const sphere = conceptToDelete?.sphere as Mesh | undefined;
    if (sphere) {
      sphere.dispose(false, true);
    }
    if (this.draggedSphere === sphere) {
      this.draggedSphere = null;
    }
    this.selectedConcept = null;
  }

  updateObjects(): void {
    this.objects.forEach((object) => {
      if (typeof object.update === "function") {
        object.update();
      }
    });
  }
}

export default new ModeController();
