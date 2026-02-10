import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color3, Vector3, Matrix } from "@babylonjs/core/Maths/math";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Plane } from "@babylonjs/core/Maths/math.plane";

import Answer from './concepts/answer';
import Question from './concepts/question';
import Note from './concepts/note';
import Plus from './concepts/plus';
import Minus from './concepts/minus';
import Link from './concepts/link';
import Reference from './concepts/reference';
import { ConceptMap } from './concepts/concept_map';

import { Mode, Types } from './concepts/types';

interface ModeControllerConfig {
  scene: Scene;
  camera: Camera;
  engine: Engine;
}

// Fixed distance from camera center to placement plane
const PLACEMENT_PLANE_DISTANCE = 20;

// Define a concept constructor type
type ConceptConstructor = new (
  scene: Scene,
  options?: Record<string, any>
) => any;

// Mapping from Mode → Concept class
const modeMap: Record<Mode, ConceptConstructor> = {
  [Types.Answer]: Answer,
  [Types.Question]: Question,
  [Types.Note]: Note,
  [Types.Plus]: Plus,
  [Types.Minus]: Minus,
  [Types.Link]: Link,
  [Types.Reference]: Reference
};

class ModeController {
  public get draggableObjects(): Mesh[] {
    return [];
  }
  private readonly keyMap: Record<string, Mode> = {
    a: Types.Answer,
    q: Types.Question,
    n: Types.Note,
    '+': Types.Plus,
    '-': Types.Minus,
    l: Types.Link,
    r: Types.Reference
  };
  
  private mode: Mode | null = null;
  private scene!: Scene;
  private camera!: ArcRotateCamera;
  private engine!: Engine;
  private objects: any[] = [];
  
  // Camera rotation state
  private _isRotating: boolean = false;
  private _isPanning: boolean = false;
  private _isPointerDown: boolean = false;
  private _activeButton: number | null = null;
  private _activePointerId: number | null = null;
  private _lastPointerX: number = 0;
  private _lastPointerY: number = 0;
  private _hasMoved: boolean = false;
  private _draggedSphere: Mesh | null = null;
  private _dragPlane: Plane | null = null;
  private _dragOffset: Vector3 = Vector3.Zero();
  private _selectedConcept: any | null = null;

  init({ scene, camera, engine }: ModeControllerConfig): void {
    this.scene = scene;
    if (!(camera instanceof ArcRotateCamera)) {
      throw new Error("Camera must be an ArcRotateCamera");
    }
    this.camera = camera;
    this.engine = engine;
    this.mode = Types.Answer;
    
    // Camera controls are handled manually - don't use default controls
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
    window.addEventListener('keydown', (event) => this.handleKeydown(event));
    const canvas = this.engine.getRenderingCanvas();
    if (canvas) {
      canvas.addEventListener('pointerdown', (event) => this.handlePointerDown(event), false);
      canvas.addEventListener('pointermove', (event) => this.handlePointerMove(event), false);
      canvas.addEventListener('pointerup', (event) => this.handlePointerUp(event), false);
      canvas.addEventListener('dblclick', (event) => this.handleDoubleClick(event), false);
      canvas.addEventListener('wheel', (event) => this.handleWheel(event), false);
      // Prevent context menu
      canvas.addEventListener('contextmenu', (event) => event.preventDefault(), false);
    }
    window.addEventListener('resize', () => this.handleWindowResize());
  }

  private handleKeydown(event: KeyboardEvent): void {
    if (this._selectedConcept) {
      if (event.key === 'Escape' || event.key === 'Enter') {
        this._selectedConcept = null;
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        const current = this._selectedConcept.getOverlayText?.() ?? '';
        this._selectedConcept.setOverlayText?.(current.slice(0, -1));
        return;
      }

      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) {
        event.preventDefault();
        const current = this._selectedConcept.getOverlayText?.() ?? '';
        if (current.length < 12) {
          this._selectedConcept.setOverlayText?.(current + event.key);
        }
        return;
      }
    }

    const key = event.key.toLowerCase();
    const matchedMode = this.keyMap[key];
    if (matchedMode) {
      this.setMode(matchedMode);
    } else {
      console.log(`Unmapped key: ${key}`);
    }
  }

  private handlePointerDown(event: PointerEvent): void {
    // Left button: create/rotate behavior. Right button: pan behavior.
    if (event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    event.stopPropagation();

    // Mark pointer as down
    this._isPointerDown = true;
    this._activeButton = event.button;
    this._activePointerId = event.pointerId;
    this._isPanning = event.button === 2;
    this._draggedSphere = null;
    this._dragPlane = null;
    this._dragOffset = Vector3.Zero();

    // Update scene pointer position for picking
    const canvas = this.engine.getRenderingCanvas();
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    this.scene.pointerX = event.clientX - rect.left;
    this.scene.pointerY = event.clientY - rect.top;
    this._lastPointerX = event.clientX - rect.left;
    this._lastPointerY = event.clientY - rect.top;
    if (canvas.setPointerCapture) {
      canvas.setPointerCapture(event.pointerId);
    }

    // For right-click pan, do not run placement/mesh checks.
    if (event.button === 2) {
      this._isRotating = false;
      this._hasMoved = false;
      return;
    }

    // Check if we clicked on a sphere - if so, start dragging it.
    const pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => {
      return mesh && mesh.name.startsWith('sphere');
    });

    if (pickResult && pickResult.hit && pickResult.pickedMesh) {
      this._draggedSphere = pickResult.pickedMesh as Mesh;
      this._selectedConcept = this.getConceptFromSphere(this._draggedSphere);
      const dragPlaneNormal = this.camera.getTarget().subtract(this.camera.position).normalize();
      const dragPlaneOrigin = pickResult.pickedPoint ?? this._draggedSphere.position.clone();
      this._dragPlane = Plane.FromPositionAndNormal(dragPlaneOrigin, dragPlaneNormal);
      const ray = this.scene.createPickingRay(
        this.scene.pointerX,
        this.scene.pointerY,
        Matrix.Identity(),
        this.camera
      );
      const hitDistance = ray.intersectsPlane(this._dragPlane);
      if (hitDistance != null) {
        const hitPoint = ray.origin.add(ray.direction.scale(hitDistance));
        this._dragOffset = this._draggedSphere.position.subtract(hitPoint);
      } else {
        this._dragOffset = Vector3.Zero();
      }
      this._isRotating = false;
      this._hasMoved = false;
      return;
    }

    this._selectedConcept = null;

    // Reset rotation state - we'll create concept on pointer up if not dragged
    this._isRotating = false; // Start as false, will be set to true on drag
    this._hasMoved = false; // Track if mouse moved during this click
  }
  private handleWindowResize(): void {
    this.engine.resize();
  }

  private handleDoubleClick(event: MouseEvent): void {
    if (event.button !== 0) return;
    const canvas = this.engine.getRenderingCanvas();
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    this.scene.pointerX = event.clientX - rect.left;
    this.scene.pointerY = event.clientY - rect.top;

    const pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => {
      return mesh && mesh.name.startsWith('sphere');
    });

    if (pickResult && pickResult.hit && pickResult.pickedMesh) {
      const concept = this.getConceptFromSphere(pickResult.pickedMesh as Mesh);
      if (concept) {
        this._selectedConcept = concept;
        this._selectedConcept.setOverlayText?.('');
      }
    }
  }

  private handlePointerMove(event: PointerEvent): void {
    if (this._activePointerId !== null && event.pointerId !== this._activePointerId) return;
    const canvas = this.engine.getRenderingCanvas();
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const currentX = event.clientX - rect.left;
    const currentY = event.clientY - rect.top;
    
    // Update scene pointer position (needed for picking)
    this.scene.pointerX = currentX;
    this.scene.pointerY = currentY;
    
    // Only handle camera rotation if pointer is down (dragging)
    if (!this._isPointerDown) return;
    
    // Check if mouse has moved significantly (more than a few pixels)
    const deltaX = currentX - this._lastPointerX;
    const deltaY = currentY - this._lastPointerY;
    const moveThreshold = 3; // pixels
    
    if (Math.abs(deltaX) > moveThreshold || Math.abs(deltaY) > moveThreshold) {
      this._hasMoved = true;
      // Start rotating only when not panning or dragging a sphere.
      if (!this._isRotating && !this._isPanning && !this._draggedSphere) {
        this._isRotating = true;
      }
    }

    // Left mouse drag moves the picked sphere in a camera-facing plane.
    if (this._draggedSphere && this._dragPlane) {
      const ray = this.scene.createPickingRay(
        this.scene.pointerX,
        this.scene.pointerY,
        Matrix.Identity(),
        this.camera
      );
      const dragDistance = ray.intersectsPlane(this._dragPlane);
      if (dragDistance != null) {
        const dragPoint = ray.origin.add(ray.direction.scale(dragDistance));
        this._draggedSphere.position = dragPoint.add(this._dragOffset);
      }
      this._lastPointerX = currentX;
      this._lastPointerY = currentY;
      return;
    }
    
    // Right mouse drag pans camera target in camera plane.
    if (this._isPanning) {
      const target = this.camera.getTarget();
      const forward = target.subtract(this.camera.position).normalize();
      const worldUp = Vector3.Up();
      let right = Vector3.Cross(forward, worldUp);
      if (right.lengthSquared() < 1e-6) {
        right = Vector3.Right();
      } else {
        right.normalize();
      }
      const up = Vector3.Cross(right, forward).normalize();

      const panScale = this.camera.radius * 0.0006;
      // Drag-to-pan: scene content follows mouse direction on screen.
      const panOffset = right.scale(deltaX * panScale).add(up.scale(-deltaY * panScale));
      this.camera.setTarget(target.add(panOffset));

      this._lastPointerX = currentX;
      this._lastPointerY = currentY;
      return;
    }

    if (!this._isRotating) return;
    
    // Rotation speed scales with zoom level for a more natural feel.
    const baseRotationSpeed = 0.001;
    const rotationSpeed = baseRotationSpeed * (100 / Math.max(this.camera.radius, 20));
    this.camera.alpha -= deltaX * rotationSpeed;
    this.camera.beta += deltaY * rotationSpeed;
    
    // Clamp beta using camera limits so startup/view constraints stay consistent.
    const lowerBeta = this.camera.lowerBetaLimit ?? 0.01;
    const upperBeta = this.camera.upperBetaLimit ?? Math.PI / 2;
    this.camera.beta = Math.max(lowerBeta, Math.min(upperBeta, this.camera.beta));
    
    this._lastPointerX = currentX;
    this._lastPointerY = currentY;
  }

  private handlePointerUp(event: PointerEvent): void {
    if (this._activePointerId !== null && event.pointerId !== this._activePointerId) return;
    // Only handle if this was the button we were tracking
    if (!this._isPointerDown) return;
    
    if (this._activeButton === 0 && !this._hasMoved && this._draggedSphere) {
      this._selectedConcept = this.getConceptFromSphere(this._draggedSphere);
    }

    // If we didn't move much and a mode is active, create a concept
    if (this._activeButton === 0 && !this._hasMoved && !this._isRotating && !this._draggedSphere) {
      const currentMode = this.getMode();
      if (currentMode && ConceptMap[currentMode]) {
        // Update pointer position one more time
        const canvas = this.engine.getRenderingCanvas();
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          this.scene.pointerX = event.clientX - rect.left;
          this.scene.pointerY = event.clientY - rect.top;
          this.createConceptAtPointer();
        }
      }
    }
    
    // Reset all state
    this._isPointerDown = false;
    this._isRotating = false;
    this._isPanning = false;
    this._hasMoved = false;
    this._draggedSphere = null;
    this._dragPlane = null;
    this._dragOffset = Vector3.Zero();
    this._activeButton = null;
    if (this._activePointerId !== null) {
      const canvas = this.engine.getRenderingCanvas();
      if (canvas && canvas.releasePointerCapture) {
        try {
          canvas.releasePointerCapture(this._activePointerId);
        } catch {
          // Ignore if not captured.
        }
      }
    }
    this._activePointerId = null;
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    // Multiplicative zoom feels natural at both near and far distances.
    const zoomFactor = 1.1;
    const delta = event.deltaY > 0 ? zoomFactor : 1 / zoomFactor;
    this.camera.radius *= delta;
    
    // Clamp radius to limits
    if (this.camera.lowerRadiusLimit !== null) {
      this.camera.radius = Math.max(this.camera.radius, this.camera.lowerRadiusLimit);
    }
    if (this.camera.upperRadiusLimit !== null) {
      this.camera.radius = Math.min(this.camera.radius, this.camera.upperRadiusLimit);
    }
  }

  // Get the placement plane position (20 units from camera to center)
  private getPlacementPlane(): { origin: Vector3; normal: Vector3 } {
    // Get forward direction from camera position toward target (center)
    const forward = this.camera.getTarget().subtract(this.camera.position).normalize();
    // Plane is at fixed distance (20 units) from camera along forward direction
    const planeOrigin = this.camera.position.add(forward.scale(PLACEMENT_PLANE_DISTANCE));
    // Normal points in forward direction (away from camera)
    return {
      origin: planeOrigin,
      normal: forward
    };
  }

  // Create a new concept at the clicked position on the placement plane
  createConceptAtPointer(): void {
    const currentMode = this.getMode();
    if (!currentMode || !ConceptMap[currentMode]) {
      console.log("No mode selected or invalid mode.");
      return;
    }

    // Ray-plane intersection with placement plane
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
    
    const ConceptClass = ConceptMap[currentMode];
    const createdObject = new ConceptClass(this.scene, {
      position: pos,
      camera: this.camera,
      engine: this.engine
    });
    if (createdObject?.sphere) {
      const metadata = createdObject.sphere.metadata ?? {};
      createdObject.sphere.metadata = { ...metadata, conceptRef: createdObject };
    }
    this.objects.push(createdObject);
    this._selectedConcept = createdObject;
    console.log(`Created ${currentMode} at`, pos.toString());
  }

  private getConceptFromSphere(sphere: Mesh | null): any | null {
    if (!sphere) return null;
    const metadataConcept = sphere.metadata?.conceptRef;
    if (metadataConcept) return metadataConcept;
    const matched = this.objects.find((object) => object?.sphere === sphere);
    return matched ?? null;
  }

  updateObjects(): void {
    this.objects.forEach((object) => {
      if (typeof object.update === 'function') {
        object.update();
      }
    });
  }

}

export default new ModeController();
