// ModeController class definition for Babylon.js
import Answer from './concepts/answer.js'; // Ensure Answer is adapted for Babylon.js
import Question from './concepts/question.js'; // Ensure Question is adapted for Babylon.js
import * as BABYLON from 'babylonjs';

class ModeController {
  constructor() {
    this.mode = null;
    this.scene = null;
    this.camera = null;
    this.engine = null; // Use engine instead of renderer
    this.objects = []; // Track objects created
    this.selectedObject = null; // Track selected object
  }

  init({ scene, camera, engine }) {
    this.scene = scene;
    this.camera = camera;
    this.engine = engine;
    this.attachEventListeners();
  }

  setMode(newMode) {
    this.mode = newMode;
    console.log(`Mode set to: ${newMode}`);
  }

  getMode() {
    return this.mode;
  }

  attachEventListeners() {
    window.addEventListener('keydown', (event) => this.handleKeydown(event));
    this.engine.getRenderingCanvas().addEventListener('pointerdown', (event) => this.handleMouseDown(event), false);
    window.addEventListener('resize', () => this.handleWindowResize());
  }

  handleKeydown(event) {
    // Implementation depends on specific text box handling in Babylon.js
    console.log('Key pressed:', event.key);
    // Process keyboard input similarly if text interaction is implemented
  }

  handleMouseDown(event) {
    event.preventDefault();

    const canvas = this.engine.getRenderingCanvas();
    const scene = this.scene;
    const pickResult = scene.pick(scene.pointerX, scene.pointerY);

    if (pickResult.hit) {
      this.selectedObject = pickResult.pickedMesh;
      console.log('Object selected:', this.selectedObject);
    } else {
      this.selectedObject = null;
      console.log('No object selected');
      // Create new objects depending on the mode
      const pos = pickResult.pickedPoint || new BABYLON.Vector3(0, 0, 0); // Default to origin if no hit
      let createdObject;
      switch (this.getMode()) {
        case 'answer':
          createdObject = new Answer(this.scene, pos); // Adapt constructor parameters as needed
          break;
        case 'question':
          createdObject = new Question(this.scene, pos); // Adapt constructor parameters as needed
          break;
        default:
          console.log('No mode selected');
      }
      if (createdObject) {
        this.objects.push(createdObject);
        this.selectedObject = createdObject;
      }
    }
  }

  handleWindowResize() {
    this.engine.resize();
  }

  updateObjects() {
    // Ensure each object has an update method that can be called here
    this.objects.forEach((object) => {
      if (typeof object.update === 'function') {
        object.update();
      }
    });
  }
}

export default new ModeController();
