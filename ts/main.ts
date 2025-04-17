import * as BABYLON from 'babylonjs';
import ModeController from './mode_controller';

function createScene(engine: BABYLON.Engine): BABYLON.Scene {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 1); // black background

  // Use a perspective ArcRotateCamera for more realistic 3D
  const camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2.5, 200, BABYLON.Vector3.Zero(), scene);
  camera.attachControl(engine.getRenderingCanvas(), true);
  camera.minZ = 0.1;
  camera.maxZ = 2000;

  // Optionally, limit zoom and angles for usability
  camera.lowerRadiusLimit = 50;
  camera.upperRadiusLimit = 1000;
  camera.lowerBetaLimit = 0.1;
  camera.upperBetaLimit = Math.PI - 0.1;


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
  // Create a directional light that will follow the camera
  const dirLight = new BABYLON.DirectionalLight("dirLight", new BABYLON.Vector3(0, -1, 1), scene);
  dirLight.intensity = 100.0;

  // Helper: offset for the sun relative to the camera (behind and above)
  const sunOffset = new BABYLON.Vector3(0, 20, -40);

  // Update sun position/direction each frame so it always follows the camera
  scene.registerBeforeRender(() => {
    // Compute the camera's forward direction
    const forward = camera.getDirection(new BABYLON.Vector3(0, 0, 1));
    // Compute the "behind and above" position
    const sunPos = camera.position
      .add(forward.scale(-sunOffset.z)) // behind camera
      .add(new BABYLON.Vector3(0, sunOffset.y, 0)); // above camera
    dirLight.position.copyFrom(sunPos);
    // Point the light in the same direction the camera is looking (with a slight downward tilt)
    const sunDir = forward.add(new BABYLON.Vector3(0, -0.2, 0)).normalize();
    dirLight.direction.copyFrom(sunDir);
  });

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

  // Enable tone mapping and gamma correction for more realistic rendering
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = 1.0;
  scene.imageProcessingConfiguration.gammaCorrection = true;

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
