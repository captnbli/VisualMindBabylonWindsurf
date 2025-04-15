import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';

import Answer from './concepts/answer';
import Question from './concepts/question';
import ModeController from './mode_controller';

// Get the canvas DOM element and assert type
const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;

// Load the Babylon engine
const engine = new BABYLON.Engine(canvas, true);

// Create and return the Babylon scene
const createScene = (): BABYLON.Scene => {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 1); // RGBA: pure black

  // Create an orthographic camera
  const camera = new BABYLON.UniversalCamera('UniversalCamera', new BABYLON.Vector3(0, 0, -50), scene);
  camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
  const aspect = window.innerWidth / window.innerHeight;
  camera.orthoLeft = -20 * aspect;
  camera.orthoRight = 20 * aspect;
  camera.orthoTop = 20;
  camera.orthoBottom = -20;
  camera.attachControl(canvas, false);

  // Create a light
  const light = new BABYLON.HemisphericLight('hemiLight', new BABYLON.Vector3(5, 10, 50), scene);
  light.intensity = 5;

  // Initialize controller
  ModeController.init({ scene, camera, engine });
  ModeController.setMode('answer'); // or: Types.Answer
  
  return scene;
};

// Set up the scene
const scene = createScene();

// Start render loop
engine.runRenderLoop(() => {
  ModeController.updateObjects();
  scene.render();
});

// Handle browser resizes
window.addEventListener('resize', () => {
  engine.resize();
});
