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
  private _isPointerDown: boolean = false;
  private _lastPointerX: number = 0;
  private _lastPointerY: number = 0;
  private _hasMoved: boolean = false;

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
      canvas.addEventListener('wheel', (event) => this.handleWheel(event), false);
      // Prevent context menu
      canvas.addEventListener('contextmenu', (event) => event.preventDefault(), false);
    }
    window.addEventListener('resize', () => this.handleWindowResize());
  }

  private handleKeydown(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    const matchedMode = this.keyMap[key];
    if (matchedMode) {
      this.setMode(matchedMode);
    } else {
      console.log(`Unmapped key: ${key}`);
    }
  }

  private handlePointerDown(event: PointerEvent): void {
    // Only respond to left mouse button
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    // Mark pointer as down
    this._isPointerDown = true;

    // Update scene pointer position for picking
    const canvas = this.engine.getRenderingCanvas();
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    this.scene.pointerX = event.clientX - rect.left;
    this.scene.pointerY = event.clientY - rect.top;
    this._lastPointerX = event.clientX - rect.left;
    this._lastPointerY = event.clientY - rect.top;

    // Check if we clicked on a sphere - if so, do nothing (spheres don't move)
    const pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => {
      return mesh && mesh.name.startsWith('sphere');
    });

    if (pickResult && pickResult.hit && pickResult.pickedMesh) {
      // Sphere clicked - do nothing, spheres are fixed
      this._isPointerDown = false;
      return;
    }

    // Reset rotation state - we'll create concept on pointer up if not dragged
    this._isRotating = false; // Start as false, will be set to true on drag
    this._hasMoved = false; // Track if mouse moved during this click
  }
  private handleWindowResize(): void {
    this.engine.resize();
  }

  private handlePointerMove(event: PointerEvent): void {
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
      // Start rotating if we're dragging
      if (!this._isRotating) {
        this._isRotating = true;
      }
    }
    
    if (!this._isRotating) return;
    
    // Convert pixel movement to camera rotation
    // Horizontal movement rotates around Y axis (alpha)
    // Vertical movement rotates around X axis (beta)
    const rotationSpeed = 0.01;
    this.camera.alpha -= deltaX * rotationSpeed;
    this.camera.beta += deltaY * rotationSpeed;
    
    // Clamp beta to reasonable limits
    this.camera.beta = Math.max(0.01, Math.min(Math.PI / 2.2, this.camera.beta));
    
    this._lastPointerX = currentX;
    this._lastPointerY = currentY;
  }

  private handlePointerUp(event: PointerEvent): void {
    // Only handle if this was the left button we were tracking
    if (!this._isPointerDown) return;
    
    // If we didn't move much and a mode is active, create a concept
    if (!this._hasMoved && !this._isRotating) {
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
    this._hasMoved = false;
  }

  private handleWheel(event: WheelEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    // Zoom camera forward/back by changing radius
    const zoomSpeed = 2;
    const delta = event.deltaY > 0 ? zoomSpeed : -zoomSpeed;
    
    this.camera.radius += delta;
    
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
    this.objects.push(createdObject);
    console.log(`Created ${currentMode} at`, pos.toString());
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
