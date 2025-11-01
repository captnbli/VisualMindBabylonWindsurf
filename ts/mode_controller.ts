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
    return this.objects;
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
  private camera!: Camera;
  private engine!: Engine;
  private objects: any[] = [];
  private selectedObject: any | null = null;

  init({ scene, camera, engine }: ModeControllerConfig): void {
    this.scene = scene;
    this.camera = camera;
    this.engine = engine;
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
    window.addEventListener('keydown', (event) => this.handleKeydown(event));
    const canvas = this.engine.getRenderingCanvas();
    if (canvas) {
      canvas.addEventListener('pointerdown', (event) => this.handleMouseDown(event), false);
      canvas.addEventListener('pointermove', (event) => this.handlePointerMove(event), false);
      canvas.addEventListener('pointerup', (event) => this.handlePointerUp(event), false);
      // Add right-click handler for camera mode switching
      canvas.addEventListener('contextmenu', (event) => this.handleRightClick(event), false);
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

  private handleMouseDown(event: PointerEvent): void {
    // Only respond to left mouse button (0 = left, 1 = middle, 2 = right)
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    // Pick mesh under pointer
    const pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY, (mesh) => {
      // Only pick spheres (Concepts)
      return mesh && mesh.name.startsWith('sphere');
    });

    if (pickResult && pickResult.hit && pickResult.pickedMesh) {
      // Select the sphere for dragging
      this.selectedObject = pickResult.pickedMesh;
      this._dragging = true;
      this._dragOffset = pickResult.pickedPoint ? pickResult.pickedPoint.subtract(this.selectedObject.position) : Vector3.Zero();
      // Set drag plane to go through the sphere's original position, perpendicular to camera's forward
      this._dragPlaneOrigin = this.selectedObject.position.clone();
      this._dragPlaneNormal = this.camera.getForwardRay().direction.normalize();
      return;
    }

    // Otherwise, create a new concept at the pointer position
    let pos: Vector3 | null = null;
    const canvas = this.engine.getRenderingCanvas();
    if (this.camera.mode === Camera.ORTHOGRAPHIC_CAMERA && canvas) {
      // Map pointer X/Y to world X/Y in the ortho camera's visible region
      const rect = canvas.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const ndcX = (pointerX / canvas.width) * 2 - 1; // [-1, 1]
      const ndcY = 1 - (pointerY / canvas.height) * 2; // [1, -1]
      
      // Get orthographic bounds from camera
      const orthoLeft = this.camera.orthoLeft || -100;
      const orthoRight = this.camera.orthoRight || 100;
      const orthoTop = this.camera.orthoTop || 100;
      const orthoBottom = this.camera.orthoBottom || -100;
      
      const worldX = orthoLeft + (ndcX + 1) * (orthoRight - orthoLeft) / 2;
      const worldY = orthoBottom + (ndcY + 1) * (orthoTop - orthoBottom) / 2;
      const forward = this.camera.getForwardRay().direction.normalize();
      const worldZ = this.camera.position.z + 20 * forward.z;
      pos = new Vector3(worldX, worldY, worldZ);
    } else {
      // Perspective: ray-plane intersection
      const ray = this.scene.createPickingRay(
        this.scene.pointerX,
        this.scene.pointerY,
        Matrix.Identity(),
        this.camera
      );
      const forward = this.camera.getForwardRay().direction.normalize();
      const planeOrigin = this.camera.position.add(forward.scale(20));
      const plane = Plane.FromPositionAndNormal(planeOrigin, forward);
      const distance = ray.intersectsPlane(plane);
      pos = distance == null ? planeOrigin.clone() : ray.origin.add(ray.direction.scale(distance));
    }

    const currentMode = this.getMode();
    if (!currentMode || !ConceptMap[currentMode]) {
      console.log("No mode selected or invalid mode.");
      return;
    }
    
    if (!pos) {
      console.log("Could not determine position for new concept.");
      return;
    }
    
    const ConceptClass = ConceptMap[currentMode];
    const createdObject = new ConceptClass(this.scene, {
      position: pos,
      camera: this.camera,
      engine: this.engine
    });
    this.objects.push(createdObject);
    this.selectedObject = createdObject.sphere;
    console.log(`Created ${currentMode} at`, pos.toString());
  }
    private handleWindowResize(): void {
    this.engine.resize();
  }

  private _dragging: boolean = false;
  private _dragOffset: Vector3 = Vector3.Zero();
  private _dragPlaneOrigin: Vector3 | null = null;
  private _dragPlaneNormal: Vector3 | null = null;

  private handlePointerMove(event: PointerEvent): void {
    if (!this._dragging || !this.selectedObject || !this._dragPlaneOrigin || !this._dragPlaneNormal) return;
    // Move selected object to new pointer position (keep offset)
    const ray = this.scene.createPickingRay(
      this.scene.pointerX,
      this.scene.pointerY,
      Matrix.Identity(),
      this.camera
    );
    const plane = Plane.FromPositionAndNormal(this._dragPlaneOrigin, this._dragPlaneNormal);
    const distance = ray.intersectsPlane(plane);
    const newPos = distance == null ? this._dragPlaneOrigin.clone() : ray.origin.add(ray.direction.scale(distance));
    if (newPos) {
      this.selectedObject.position.copyFrom(newPos.subtract(this._dragOffset));
    }
  }

  private handlePointerUp(event: PointerEvent): void {
    if (this._dragging) {
      this._dragging = false;
      this._dragOffset = Vector3.Zero();
      this._dragPlaneOrigin = null;
      this._dragPlaneNormal = null;
    }
    this.selectedObject = null;
  }

  private handleRightClick(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    // Toggle between orthographic and perspective modes
    if (this.camera.mode === Camera.ORTHOGRAPHIC_CAMERA) {
      // Switch to perspective mode
      this.camera.mode = Camera.PERSPECTIVE_CAMERA;
      console.log('Switched to Perspective mode');
    } else {
      // Switch to orthographic mode
      this.camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
      // Configure orthographic camera properly
      this.configureOrthographicCamera();
      console.log('Switched to Orthographic mode');
    }
    
    // Dispatch custom event for UI updates
    window.dispatchEvent(new CustomEvent('cameraModeChanged', {
      detail: { mode: this.camera.mode }
    }));
  }

  private configureOrthographicCamera(): void {
    if (this.camera instanceof ArcRotateCamera) {
      // Set orthographic camera parameters
      const aspectRatio = this.engine.getAspectRatio(this.camera);
      const radius = this.camera.radius;
      
      // Calculate orthographic bounds based on camera radius
      const orthoSize = radius * 0.8; // Adjust this multiplier as needed
      
      this.camera.orthoLeft = -orthoSize * aspectRatio;
      this.camera.orthoRight = orthoSize * aspectRatio;
      this.camera.orthoTop = orthoSize;
      this.camera.orthoBottom = -orthoSize;
    }
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
