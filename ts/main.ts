import * as BABYLON from 'babylonjs';
import ModeController from './mode_controller';

function createScene(engine: BABYLON.Engine): BABYLON.Scene {
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0, 0, 0, 1); // black background

  // Use a perspective ArcRotateCamera for more realistic 3D
  const camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2.5, 600, BABYLON.Vector3.Zero(), scene);
  // Remove all default camera inputs
  camera.inputs.clear();

  // Remove all default camera inputs (including orbit on right mouse)
  camera.inputs.clear();

  // Add mouse wheel for zoom
  camera.inputs.addMouseWheel();

  // Restrict camera controls to x/y plane and zoom only
  camera.panningSensibility = 0; // Disable built-in panning
  camera.allowUpsideDown = false; // Prevent flipping
  camera.lowerBetaLimit = Math.PI / 2.5 - 0.01; // Lock beta to a narrow range around initial value
  camera.upperBetaLimit = Math.PI / 2.5 + 0.01;

  // Custom right mouse drag to pan (slide) the camera's view
  let isRightDragging = false;
  let panStartPointerX = 0;
  let panStartPointerY = 0;
  let panStartTarget = new BABYLON.Vector3();
  let panStartCameraPos = new BABYLON.Vector3();
  const canvas = engine.getRenderingCanvas();
  if (canvas) {
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 2) {
        isRightDragging = true;
        panStartPointerX = e.clientX;
        panStartPointerY = e.clientY;
        panStartTarget.copyFrom(camera.target);
        panStartCameraPos.copyFrom(camera.position);
        e.preventDefault();
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (isRightDragging) {
        // Project pointer movement to world-space movement on the camera's view plane at the target depth
        const scene = camera.getScene();
        const pickPlaneNormal = camera.getForwardRay().direction;
        const plane = BABYLON.Plane.FromPositionAndNormal(panStartTarget, pickPlaneNormal);

        // Get world point under initial pointer
        const ray0 = scene.createPickingRay(
          panStartPointerX,
          panStartPointerY,
          BABYLON.Matrix.Identity(),
          camera
        );
        const dist0 = ray0.intersectsPlane(plane);
        const world0 = dist0 == null ? panStartTarget : ray0.origin.add(ray0.direction.scale(dist0));

        // Get world point under current pointer
        const ray1 = scene.createPickingRay(
          e.clientX,
          e.clientY,
          BABYLON.Matrix.Identity(),
          camera
        );
        const dist1 = ray1.intersectsPlane(plane);
        const world1 = dist1 == null ? panStartTarget : ray1.origin.add(ray1.direction.scale(dist1));

        // Compute world-space translation
        const delta = world0.subtract(world1);
        camera.target.copyFrom(panStartTarget.add(delta));
        camera.position.copyFrom(panStartCameraPos.add(delta));
        e.preventDefault();
      }
    });
    canvas.addEventListener('pointerup', (e) => {
      if (e.button === 2) {
        isRightDragging = false;
        e.preventDefault();
      }
    });
  }
  // Optionally, you can set camera.inertia = 0 for instant stops
  // camera.inertia = 0;

  // Optionally, if you want to lock beta exactly:
  // camera.lowerBetaLimit = camera.upperBetaLimit = Math.PI / 2.5;

  camera.minZ = 0.1;
  camera.maxZ = 2000;

  // Optionally, limit zoom and angles for usability
  camera.lowerRadiusLimit = 50;
  camera.upperRadiusLimit = 1000;
  camera.lowerBetaLimit = 0.1;
  camera.upperBetaLimit = Math.PI - 0.1;

  // Attach camera controls to the canvas for pointer input
  camera.attachControl(engine.getRenderingCanvas(), true);

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
// Disable right-click context menu so Babylon camera orbit works
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
const engine = new BABYLON.Engine(canvas, true);
const scene = createScene(engine);

engine.runRenderLoop(() => {
  ModeController.updateObjects();
  scene.render();
});
