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

    const pickResult = this.scene.pick(this.scene.pointerX, this.scene.pointerY);

    if (pickResult?.hit && pickResult.pickedMesh) {
      this.selectedObject = pickResult.pickedMesh;
      console.log('Object selected:', this.selectedObject);
    } else {
      this.selectedObject = null;
      console.log('No object selected');

      const pos = pickResult?.pickedPoint || new BABYLON.Vector3(0, 0, 0);
      const currentMode = this.getMode();

      if (currentMode && ConceptMap[currentMode]) {
        const ConceptClass = ConceptMap[currentMode];
        const createdObject = new ConceptClass(this.scene, {
          position: pos,
          camera: this.camera,
          engine: this.engine
        });
      
        this.objects.push(createdObject);
        this.selectedObject = createdObject;
      } else {
        console.log('No mode selected or invalid mode');
      }
      
    }
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
