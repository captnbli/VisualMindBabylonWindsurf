import * as BABYLON from 'babylonjs';
import ModeController from './mode_controller';

function createScene(engine: BABYLON.Engine): BABYLON.Scene {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 1); // black background

  // Move camera further away at Z = -200
  const camera = new BABYLON.UniversalCamera("camera", new BABYLON.Vector3(0, 0, -200), scene);

  // Set camera near/far planes to ensure all objects are visible
  camera.minZ = 0.1;
  camera.maxZ = 2000;

  // Target a point 20 units in front (where concepts will be placed)
  const conceptZ = -180;
  camera.setTarget(new BABYLON.Vector3(0, 0, conceptZ));
  camera.upVector = new BABYLON.Vector3(0, 1, 0);
  camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;


  // Set orthographic bounds based on screen size (double the size for larger objects)
  const setOrthoBounds = () => {
    const aspect = engine.getRenderWidth() / engine.getRenderHeight();
    const size = 100;
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

  // Add a sun-like directional light: very far away, extremely bright, pointing toward the origin
  const sunDirection = new BABYLON.Vector3(0, -1, 1).normalize(); // Sun above and behind camera
  const dirLight = new BABYLON.DirectionalLight("dirLight", sunDirection, scene);
  dirLight.position = new BABYLON.Vector3(0, 10000, -10000); // Very far away
  dirLight.intensity = 100.0;

  // Optionally, reduce hemispheric light to near zero for a more sun-dominated look
  const hemiLight = new BABYLON.HemisphericLight("hemiLight", new BABYLON.Vector3(0, 1, 0), scene);
  hemiLight.intensity = 0.05;

  // Add a default environment texture for PBR reflections
  // This uses Babylon's built-in environment texture from CDN
  BABYLON.CubeTexture.CreateFromPrefilteredData(
    "https://playground.babylonjs.com/textures/environment.env",
    scene,
    undefined,
    false,
    () => {
      scene.environmentTexture = scene.textures[scene.textures.length - 1];
      scene.environmentIntensity = 1.5;
    }
  );

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
