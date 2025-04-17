import * as BABYLON from 'babylonjs';
import ModeController from './mode_controller';

function createScene(engine: BABYLON.Engine): BABYLON.Scene {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 1); // black background

  // Create orthographic camera at Z = -100
  const camera = new BABYLON.UniversalCamera("camera", new BABYLON.Vector3(0, 0, -100), scene);

  // Set camera near/far planes to ensure all objects are visible
  camera.minZ = 0.1;
  camera.maxZ = 1000;

  // Target a point 20 units in front (where concepts will be placed)
  const conceptZ = -80;
  camera.setTarget(new BABYLON.Vector3(0, 0, conceptZ));
  camera.upVector = new BABYLON.Vector3(0, 1, 0);
  camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;


  // Set orthographic bounds based on screen size
  const setOrthoBounds = () => {
    const aspect = engine.getRenderWidth() / engine.getRenderHeight();
    const size = 50;
    camera.orthoLeft = -size * aspect;
    camera.orthoRight = size * aspect;
    camera.orthoTop = size;
    camera.orthoBottom = -size;
  };

  setOrthoBounds();
  window.addEventListener("resize", () => {
    engine.resize();
    setOrthoBounds();
  });

  // Initialize mode controller
  ModeController.init({ scene, camera, engine });

  return scene;
}


const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const engine = new BABYLON.Engine(canvas, true);
const scene = createScene(engine);

engine.runRenderLoop(() => {
  ModeController.updateObjects();
  scene.render();
});
