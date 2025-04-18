import "./set_babylon_global";
import { Engine } from "babylonjs/Engines/engine";
import { Scene } from "babylonjs/scene";
import { Color3, Color4, Vector3, Matrix } from "babylonjs/Maths/math";
import { Camera, ArcRotateCamera, FreeCamera, TargetCamera } from "babylonjs/Cameras";
import { Mesh } from "babylonjs/Meshes/mesh";
import { DirectionalLight, HemisphericLight } from "babylonjs/Lights";
import { Plane } from "babylonjs/Maths/math.plane";
import { CubeTexture } from "babylonjs/Materials/Textures/cubeTexture";
import { ImageProcessingConfiguration } from "babylonjs/Materials/imageProcessingConfiguration";
import { computeOrthoMatchForPerspective } from '@babylonjs/core/Cameras/perspectiveConverters';
import ModeController from './mode_controller';

function createScene(engine: Engine): Scene {
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 1); // black background

  // Use a perspective ArcRotateCamera for more realistic 3D
  const arcCamera = new ArcRotateCamera("arcCamera", Math.PI / 2, Math.PI / 2.5, 600, Vector3.Zero(), scene);
  arcCamera.inputs.clear();
  arcCamera.inputs.addMouseWheel();
  arcCamera.panningSensibility = 0;
  arcCamera.allowUpsideDown = false;
  arcCamera.lowerBetaLimit = Math.PI / 2.5 - 0.01;
  arcCamera.upperBetaLimit = Math.PI / 2.5 + 0.01;

  // Create an orthographic camera
  const orthoCamera = new FreeCamera("orthoCamera", arcCamera.position.clone(), scene);
  orthoCamera.mode = Camera.ORTHOGRAPHIC_CAMERA;
  // Set ortho params based on viewport size and zoom
  function updateOrthoParams() {
    const zoom = 2.0; // adjust for orthographic zoom level
    orthoCamera.orthoLeft = -engine.getRenderWidth() / zoom;
    orthoCamera.orthoRight = engine.getRenderWidth() / zoom;
    orthoCamera.orthoTop = engine.getRenderHeight() / zoom;
    orthoCamera.orthoBottom = -engine.getRenderHeight() / zoom;
  }
  updateOrthoParams();
  orthoCamera.inputs.clear();
  orthoCamera.inputs.addMouseWheel();

  // Set initial active camera
  scene.activeCamera = arcCamera;
  arcCamera.attachControl(engine.getRenderingCanvas(), true);

  // Camera switch function
  function switchCamera(toOrtho: boolean) {
    if (toOrtho) {
      // Directly match ortho camera position, target, and upVector to arcCamera
      orthoCamera.position.copyFrom(arcCamera.position);
      orthoCamera.setTarget(arcCamera.target.clone());
      if (orthoCamera.upVector && arcCamera.upVector) {
        orthoCamera.upVector.copyFrom(arcCamera.upVector);
      }
      if (orthoCamera.upVector && arcCamera.upVector) {
        orthoCamera.upVector.copyFrom(arcCamera.upVector);
      }
      // --- Robust ortho match: use Babylon.js computeOrthoMatchForPerspective ---
      const orthoParams = computeOrthoMatchForPerspective(arcCamera, arcCamera.target, engine);
      orthoCamera.orthoLeft = orthoParams.orthoLeft;
      orthoCamera.orthoRight = orthoParams.orthoRight;
      orthoCamera.orthoTop = orthoParams.orthoTop;
      orthoCamera.orthoBottom = orthoParams.orthoBottom;
      orthoCamera.position.copyFrom(orthoParams.position);
      orthoCamera.setTarget(orthoParams.target);
      orthoCamera.upVector.copyFrom(orthoParams.upVector);
      // --- End robust match ---
      // --- End pixel-perfect match ---
      if (scene.activeCamera) {
        scene.activeCamera.detachControl(engine.getRenderingCanvas());
      }
      scene.activeCamera = orthoCamera;
      scene.activeCamera.attachControl(engine.getRenderingCanvas(), true);
    } else {
      // When returning to arcCamera, try to preserve the same target and distance
      const direction = orthoCamera.getTarget().subtract(orthoCamera.position).normalize();
      arcCamera.target.copyFrom(orthoCamera.getTarget());
      const distance = orthoCamera.position.subtract(orthoCamera.getTarget()).length();
      arcCamera.radius = distance;
      arcCamera.position = orthoCamera.position.clone(); // This will be overwritten by ArcRotateCamera's internal logic, but helps with smoothness
      if (arcCamera.upVector && orthoCamera.upVector) {
        arcCamera.upVector.copyFrom(orthoCamera.upVector);
      }
      if (scene.activeCamera) {
        scene.activeCamera.detachControl(engine.getRenderingCanvas());
      }
      scene.activeCamera = arcCamera;
      scene.activeCamera.attachControl(engine.getRenderingCanvas(), true);
    }
  }

  // Custom right mouse drag to pan (slide) the camera's view
  let isRightDragging = false;
  let panStartPointerX = 0;
  let panStartPointerY = 0;
  let panStartTarget = new Vector3();
  let panStartCameraPos = new Vector3();
  let panStartWorldPoint = new Vector3();
  const canvas = engine.getRenderingCanvas();
  // Helper to always get the current camera (arc or ortho)
  function getActiveCamera(): TargetCamera {
    return scene.activeCamera as TargetCamera;
  }
  if (canvas) {
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 2) {
        switchCamera(true); // Switch to 2D (orthographic) camera
        isRightDragging = true;
        panStartPointerX = e.clientX;
        panStartPointerY = e.clientY;
        const camera = getActiveCamera();
        panStartTarget.copyFrom(camera.target);
        panStartCameraPos.copyFrom(camera.position);
        // Record the world point under the pointer at drag start
        const scene = camera.getScene();
        const pickPlaneNormal = camera.getForwardRay().direction;
        const plane = Plane.FromPositionAndNormal(camera.target, pickPlaneNormal);
        const ray = scene.createPickingRay(
          panStartPointerX,
          panStartPointerY,
          Matrix.Identity(),
          camera
        );
        const dist = ray.intersectsPlane(plane);
        panStartWorldPoint = dist == null ? camera.target.clone() : ray.origin.add(ray.direction.scale(dist));
        e.preventDefault();
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (isRightDragging) {
        const camera = getActiveCamera();
        // Move the camera so the world point under the initial pointer stays under the pointer as you drag
        const scene = camera.getScene();
        const pickPlaneNormal = camera.getForwardRay().direction;
        const plane = Plane.FromPositionAndNormal(camera.target, pickPlaneNormal);
        // Get the world point under the current pointer
        const ray = scene.createPickingRay(
          e.clientX,
          e.clientY,
          Matrix.Identity(),
          camera
        );
        const dist = ray.intersectsPlane(plane);
        const worldNow = dist == null ? camera.target.clone() : ray.origin.add(ray.direction.scale(dist));
        // Compute translation needed to keep panStartWorldPoint under the pointer
        const delta = panStartWorldPoint.subtract(worldNow);
        camera.target.copyFrom(panStartTarget.add(delta));
        camera.position.copyFrom(panStartCameraPos.add(delta));
        e.preventDefault();
      }
    });
    canvas.addEventListener('pointerup', (e) => {
      if (e.button === 2) {
        isRightDragging = false;
        switchCamera(false); // Revert to 3D (perspective) camera
        e.preventDefault();
      }
    });
  }
  // Optionally, you can set camera.inertia = 0 for instant stops
  // getActiveCamera().inertia = 0;

  // Optionally, if you want to lock beta exactly:
  // getActiveCamera().lowerBetaLimit = getActiveCamera().upperBetaLimit = Math.PI / 2.5;

  // Set near/far plane and limits for the current active camera
  const camera = getActiveCamera();
  camera.minZ = 0.1;
  camera.maxZ = 2000;
  // Optionally, limit zoom and angles for usability
  if (camera instanceof ArcRotateCamera) {
    camera.lowerRadiusLimit = 50;
    camera.upperRadiusLimit = 1000;
    camera.lowerBetaLimit = 0.1;
    camera.upperBetaLimit = Math.PI - 0.1;
  }
  // Attach camera controls to the canvas for pointer input
  camera.attachControl(engine.getRenderingCanvas(), true);

  // Add a sun-like directional light: very far away, extremely bright, pointing toward the origin
  // Create a directional light that will follow the camera
  const dirLight = new DirectionalLight("dirLight", new Vector3(0, -1, 1), scene);
  dirLight.intensity = 100.0;

  // Helper: offset for the sun relative to the camera (behind and above)
  const sunOffset = new Vector3(0, 20, -40);

  // Update sun position/direction each frame so it always follows the camera
  scene.registerBeforeRender(() => {
    // Always use the current active camera for sun position
    const camera = scene.activeCamera as Camera;
    const forward = camera.getDirection(new Vector3(0, 0, 1));
    const sunPos = camera.position
      .add(forward.scale(-sunOffset.z)) // behind camera
      .add(new Vector3(0, sunOffset.y, 0)); // above camera
    dirLight.position.copyFrom(sunPos);
    // Point the light in the same direction the camera is looking (with a slight downward tilt)
    const sunDir = forward.add(new Vector3(0, -0.2, 0)).normalize();
    dirLight.direction.copyFrom(sunDir);
  });

  // Optionally, reduce hemispheric light to near zero for a more sun-dominated look
  const hemiLight = new HemisphericLight("hemiLight", new Vector3(0, 1, 0), scene);
  hemiLight.intensity = 0.05;

  // Add a default environment texture for PBR reflections
  // This uses Babylon's built-in environment texture from CDN
  CubeTexture.CreateFromPrefilteredData(
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
  scene.imageProcessingConfiguration.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = 1.0;
  scene.imageProcessingConfiguration.gammaCorrection = true;

  // Initialize mode controller
  ModeController.init({ scene, camera, engine });

  return scene;
}


const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
// Disable right-click context menu so Babylon camera orbit works
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
const engine = new Engine(canvas, true);
const scene = createScene(engine);

engine.runRenderLoop(() => {
  ModeController.updateObjects();
  scene.render();
});
