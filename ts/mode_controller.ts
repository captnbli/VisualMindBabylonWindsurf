import * as BABYLON from 'babylonjs';

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
  scene: BABYLON.Scene;
  camera: BABYLON.Camera;
  engine: BABYLON.Engine;
}

// Define a concept constructor type
type ConceptConstructor = new (
  scene: BABYLON.Scene,
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
  private scene!: BABYLON.Scene;
  private camera!: BABYLON.Camera;
  private engine!: BABYLON.Engine;
  private objects: any[] = [];
  private selectedObject: BABYLON.AbstractMesh | null = null;

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
    this.engine.getRenderingCanvas()?.addEventListener('pointerdown', (event) => this.handleMouseDown(event), false);
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
    event.preventDefault();

    let pos: BABYLON.Vector3 | null = null;
    const canvas = this.engine.getRenderingCanvas();
    if (this.camera.mode === BABYLON.Camera.ORTHOGRAPHIC_CAMERA && canvas) {
      // Map pointer X/Y to world X/Y in the ortho camera's visible region
      const rect = canvas.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const ndcX = (pointerX / canvas.width) * 2 - 1; // [-1, 1]
      const ndcY = 1 - (pointerY / canvas.height) * 2; // [1, -1]

      // Get ortho bounds
      const orthoLeft = (this.camera as any).orthoLeft;
      const orthoRight = (this.camera as any).orthoRight;
      const orthoTop = (this.camera as any).orthoTop;
      const orthoBottom = (this.camera as any).orthoBottom;
      const worldX = orthoLeft + (ndcX + 1) * (orthoRight - orthoLeft) / 2;
      const worldY = orthoBottom + (ndcY + 1) * (orthoTop - orthoBottom) / 2;
      // Place at 20 units in front of camera (Z = camera.position.z + 20 * forward.z)
      const forward = this.camera.getForwardRay().direction.normalize();
      const worldZ = this.camera.position.z + 20 * forward.z;
      pos = new BABYLON.Vector3(worldX, worldY, worldZ);
      console.log("[ORTHO] pointerX, pointerY:", pointerX, pointerY);
      console.log("[ORTHO] ndcX, ndcY:", ndcX, ndcY);
      console.log("[ORTHO] ortho bounds:", orthoLeft, orthoRight, orthoTop, orthoBottom);
      console.log("[ORTHO] Computed world position:", pos.toString());
    } else {
      // Fallback for perspective or other cameras: use ray-plane intersection
      const ray = this.scene.createPickingRay(
        this.scene.pointerX,
        this.scene.pointerY,
        BABYLON.Matrix.Identity(),
        this.camera
      );
      const forward = this.camera.getForwardRay().direction.normalize();
      const planeOrigin = this.camera.position.add(forward.scale(20));
      const plane = BABYLON.Plane.FromPositionAndNormal(planeOrigin, forward);
      const distance = ray.intersectsPlane(plane);
      if (distance == null) {
        console.warn("Ray did not intersect the placement plane. Placing concept exactly 20 units in front of camera.");
        pos = planeOrigin.clone();
      } else {
        pos = ray.origin.add(ray.direction.scale(distance));
      }
      console.log("[PERSPECTIVE] Computed world position:", pos.toString());
    }

    // TEMP: Add a debug sphere at the placement position
    const debugSphere = BABYLON.MeshBuilder.CreateSphere("debugSphere", { diameter: 2 }, this.scene);
    const debugMat = new BABYLON.StandardMaterial("debugMat", this.scene);
    debugMat.diffuseColor = new BABYLON.Color3(1, 1, 0); // Bright yellow
    debugSphere.material = debugMat;
    debugSphere.position = pos;
    setTimeout(() => {
      debugSphere.dispose();
    }, 1000);

    const currentMode = this.getMode();
    if (!currentMode || !ConceptMap[currentMode]) {
      console.log("No mode selected or invalid mode.");
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

  updateObjects(): void {
    this.objects.forEach((object) => {
      if (typeof object.update === 'function') {
        object.update();
      }
    });
  }

}

export default new ModeController();
