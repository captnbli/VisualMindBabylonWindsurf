import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Matrix, Quaternion } from "@babylonjs/core/Maths/math";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Plane } from "@babylonjs/core/Maths/math.plane";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import Connector from "./concepts/connector";

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
  ConnectorLinking = "connector_linking",
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
  private pointerStartX: number = 0;
  private pointerStartY: number = 0;
  private hasMoved: boolean = false;

  private draggedSphere: Mesh | null = null;
  private dragPlane: Plane | null = null;
  private dragOffset: Vector3 = Vector3.Zero();
  private connectorStartSphere: Mesh | null = null;
  private connectorDragPlane: Plane | null = null;
  private connectorHoverSphere: Mesh | null = null;
  private connectorLastEndLocal: Vector3 | null = null;
  private connectorPreview: Connector | null = null;

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
    this.pointerStartX = pointer.x;
    this.pointerStartY = pointer.y;

    this.activePointerId = event.pointerId;
    this.activeButton = event.button;
    this.hasMoved = false;
    this.draggedSphere = null;
    this.dragPlane = null;
    this.dragOffset = Vector3.Zero();
    this.connectorStartSphere = null;
    this.connectorDragPlane = null;
    this.connectorHoverSphere = null;
    this.connectorLastEndLocal = null;

    const canvas = this.engine.getRenderingCanvas();
    if (canvas?.setPointerCapture) {
      canvas.setPointerCapture(event.pointerId);
    }

    if (event.button === 2) {
      const spherePick = this.pickSphereAtScenePointer();
      if (spherePick && spherePick.hit && spherePick.pickedMesh) {
        this.connectorStartSphere = spherePick.pickedMesh as Mesh;
        const forward = this.camera.getTarget().subtract(this.camera.position).normalize();
        this.connectorDragPlane = Plane.FromPositionAndNormal(this.connectorStartSphere.getAbsolutePosition(), forward);
        this.inputState = InputState.ConnectorLinking;
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

    const totalDeltaX = pointer.x - this.pointerStartX;
    const totalDeltaY = pointer.y - this.pointerStartY;
    if (Math.abs(totalDeltaX) > DRAG_THRESHOLD_PX || Math.abs(totalDeltaY) > DRAG_THRESHOLD_PX) {
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
      const panOffset = right.scale(-deltaX * panScale).add(up.scale(-deltaY * panScale));
      this.worldRoot.position = this.worldRoot.position.add(panOffset);

      this.lastPointerX = pointer.x;
      this.lastPointerY = pointer.y;
      return;
    }

    if (this.inputState === InputState.ConnectorLinking && this.connectorStartSphere) {
      const startLocal = this.connectorStartSphere.position.clone();
      let endLocal: Vector3 | null = null;
      const targetPick = this.pickSphereAtScenePointer();
      if (targetPick && targetPick.hit && targetPick.pickedMesh && targetPick.pickedMesh !== this.connectorStartSphere) {
        this.connectorHoverSphere = targetPick.pickedMesh as Mesh;
        endLocal = this.connectorHoverSphere.position.clone();
      } else if (this.connectorDragPlane) {
        this.connectorHoverSphere = null;
        const ray = this.scene.createPickingRay(
          this.scene.pointerX,
          this.scene.pointerY,
          Matrix.Identity(),
          this.camera
        );
        const distance = ray.intersectsPlane(this.connectorDragPlane);
        if (distance != null) {
          const worldPoint = ray.origin.add(ray.direction.scale(distance));
          endLocal = this.worldToRootLocal(worldPoint);
        }
      }

      if (endLocal) {
        this.connectorLastEndLocal = endLocal.clone();
        this.updateConnectorPreview(startLocal, endLocal);
      }

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

    const pointer = this.getPointerPosition(event);
    if (pointer) {
      this.scene.pointerX = pointer.x;
      this.scene.pointerY = pointer.y;
    }

    if (this.activeButton === 0 && this.inputState === InputState.DraggingSphere) {
      this.selectedConcept = this.getConceptFromSphere(this.draggedSphere);
    }

    if (this.activeButton === 0 && this.inputState === InputState.PointerArmed && !this.hasMoved) {
      this.createConceptAtPointer();
    }
    if (this.activeButton === 2 && this.connectorPreview) {
      let targetSphere: Mesh | null = null;
      if (this.connectorStartSphere) {
        targetSphere = this.resolveConnectorTargetSphere(
          this.connectorStartSphere,
          this.connectorPreview.end ?? null
        );
      }
      if (this.connectorStartSphere && targetSphere) {
        const laneIndex = this.getNextConnectorLane(this.connectorStartSphere, targetSphere);
        this.connectorPreview.finalizeWithLane(this.connectorStartSphere, targetSphere, laneIndex);
        this.connectorPreview.connector.parent = this.worldRoot;
        this.connectorPreview.connector.metadata = {
          ...(this.connectorPreview.connector.metadata ?? {}),
          conceptRef: this.connectorPreview,
        };
        this.objects.push(this.connectorPreview);
        this.connectorPreview = null;
      }
    } else if (this.activeButton === 2 && this.inputState === InputState.ConnectorLinking && this.connectorStartSphere) {
      const targetSphere = this.resolveConnectorTargetSphere(this.connectorStartSphere);
      if (targetSphere) {
        this.createPermanentConnector(this.connectorStartSphere, targetSphere);
      }
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
    const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
    if (!pick || !pick.hit || !pick.pickedMesh) {
      return null;
    }
    const sphere = this.findSphereAncestor(pick.pickedMesh);
    if (!sphere) {
      return null;
    }
    return {
      ...pick,
      pickedMesh: sphere,
    };
  }

  private resolveConnectorTargetSphere(startSphere: Mesh, preferredEndLocal: Vector3 | null = null): Mesh | null {
    const targetPick = this.pickSphereAtScenePointer();
    if (targetPick && targetPick.hit && targetPick.pickedMesh && targetPick.pickedMesh !== startSphere) {
      return targetPick.pickedMesh as Mesh;
    }
    if (this.connectorHoverSphere && this.connectorHoverSphere !== startSphere) {
      return this.connectorHoverSphere;
    }

    // Final fallback: nearest sphere to the last preview endpoint.
    const fallbackEndLocal = preferredEndLocal ?? this.connectorLastEndLocal;
    if (fallbackEndLocal) {
      let nearest: { sphere: Mesh; dist: number } | null = null;
      for (const object of this.objects) {
        const sphere = object?.sphere as Mesh | undefined;
        if (!sphere || sphere === startSphere) {
          continue;
        }
        const dist = Vector3.Distance(sphere.position, fallbackEndLocal);
        if (!nearest || dist < nearest.dist) {
          nearest = { sphere, dist };
        }
      }
      if (nearest) {
        const radiusLocal = nearest.sphere.getBoundingInfo().boundingSphere.radius;
        // Intentionally strict: only count as a drop when very close to the target sphere.
        if (nearest.dist <= radiusLocal * 0.35) {
          return nearest.sphere;
        }
      }
    }

    return null;
  }

  private findSphereAncestor(mesh: any): Mesh | null {
    let current = mesh;
    while (current) {
      if (typeof current.name === "string" && current.name.startsWith("sphere")) {
        return current as Mesh;
      }
      current = current.parent;
    }
    return null;
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
    this.pointerStartX = 0;
    this.pointerStartY = 0;
    this.draggedSphere = null;
    this.dragPlane = null;
    this.dragOffset = Vector3.Zero();
    this.connectorStartSphere = null;
    this.connectorDragPlane = null;
    this.connectorHoverSphere = null;
    this.connectorLastEndLocal = null;
    this.disposeConnectorPreview();
  }

  private rotateModel(deltaX: number, deltaY: number): void {
    const baseRotationSpeed = 0.0025;
    const rotationSpeed = baseRotationSpeed;
    const yawMagnitude = Math.abs(deltaX) * rotationSpeed;
    const pitchMagnitude = Math.abs(deltaY) * rotationSpeed;
    const minStep = 0.0025;
    const yaw = deltaX === 0 ? 0 : -Math.sign(deltaX) * Math.max(yawMagnitude, minStep);
    const pitch = deltaY === 0 ? 0 : Math.sign(deltaY) * Math.max(pitchMagnitude, minStep);

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
  // Apply full zoom compensation so newly created spheres keep approximately
  // the same apparent size as at the initial zoom level.
  private getPlacementPlane(): { origin: Vector3; normal: Vector3 } {
    const zoomDelta = this.camera.radius - this.homeCameraRadius;
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
    if (typeof conceptToDelete?.dispose === "function") {
      conceptToDelete.dispose();
    } else {
      const sphere = conceptToDelete?.sphere as Mesh | undefined;
      if (sphere) {
        sphere.dispose(false, true);
      }
    }
    const sphere = conceptToDelete?.sphere as Mesh | undefined;
    if (this.draggedSphere === sphere) {
      this.draggedSphere = null;
    }
    this.selectedConcept = null;
  }

  private updateConnectorPreview(start: Vector3, end: Vector3): void {
    if (this.connectorPreview) {
      this.connectorPreview.updatePath(start, end);
      this.connectorPreview.connector.parent = this.worldRoot;
      return;
    }
    this.connectorPreview = new Connector(this.scene, {
      start,
      end,
      parent: this.worldRoot,
      preview: true,
    });
  }

  private createPermanentConnector(startSphere: Mesh, endSphere: Mesh): void {
    const laneIndex = this.getNextConnectorLane(startSphere, endSphere);
    const connector = new Connector(this.scene, {
      start: startSphere.position.clone(),
      end: endSphere.position.clone(),
      startSphere,
      endSphere,
      parent: this.worldRoot,
      preview: false,
      laneIndex,
    });
    connector.connector.metadata = { ...(connector.connector.metadata ?? {}), conceptRef: connector };
    this.objects.push(connector);
  }

  private getNextConnectorLane(startSphere: Mesh, endSphere: Mesh): number {
    const used = new Set<number>();
    for (const object of this.objects) {
      if (!(object instanceof Connector)) {
        continue;
      }
      if (!object.connectsPair(startSphere, endSphere)) {
        continue;
      }
      used.add(object.getLaneIndex());
    }

    let lane = 0;
    while (used.has(lane)) {
      lane += 1;
    }
    return lane;
  }

  private disposeConnectorPreview(): void {
    if (!this.connectorPreview) {
      return;
    }
    this.connectorPreview.dispose();
    this.connectorPreview = null;
  }

  updateObjects(): void {
    const alive: any[] = [];
    for (const object of this.objects) {
      if (typeof object.update === "function") {
        object.update();
      }
      if (typeof object.isDisposed === "function" && object.isDisposed()) {
        continue;
      }
      alive.push(object);
    }
    this.objects = alive;
  }
}

export default new ModeController();
