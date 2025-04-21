import "./set_babylon_global";
import { Engine } from "../../Babylon.js/packages/dev/core/dist/Engines/engine";
import { Scene } from "../../Babylon.js/packages/dev/core/dist/scene";
import { Color3, Color4, Vector3, Matrix } from "../../Babylon.js/packages/dev/core/dist/Maths/math";
import { Viewport } from "../../Babylon.js/packages/dev/core/dist/Maths/math.viewport";
import { Camera, ArcRotateCamera, FreeCamera, TargetCamera } from "../../Babylon.js/packages/dev/core/dist/Cameras";
import { Mesh } from "../../Babylon.js/packages/dev/core/dist/Meshes/mesh";
import { DirectionalLight, HemisphericLight } from "../../Babylon.js/packages/dev/core/dist/Lights";
import { Plane } from "../../Babylon.js/packages/dev/core/dist/Maths/math.plane";
import { CubeTexture } from "../../Babylon.js/packages/dev/core/dist/Materials/Textures/cubeTexture";
import { ImageProcessingConfiguration } from "../../Babylon.js/packages/dev/core/dist/Materials/imageProcessingConfiguration";
import { computeOrthoMatchForPerspective } from "../../Babylon.js/packages/dev/core/dist/Cameras/perspectiveConverters";
import ModeController from './mode_controller';

function createScene(engine: Engine): Scene {
  const scene = new Scene(engine);
  // IMPORTANT: Set right-handed system BEFORE creating cameras or meshes
  scene.useRightHandedSystem = true;
  scene.clearColor = new Color4(0, 0, 0, 1); // black background

  // Add a HemisphericLight for ambient lighting (required for right-handed system)
  const hemiLight = new HemisphericLight("hemiLight", new Vector3(0, -1, 0), scene);
  hemiLight.intensity = 0.8;

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
      // Use panStartWorldPoint as the target if available, otherwise fall back to arcCamera.target
      let focusTarget = (typeof panStartWorldPoint !== 'undefined' && panStartWorldPoint && (panStartWorldPoint.x !== undefined)) ? panStartWorldPoint : arcCamera.target;
      console.log('[DEBUG] switchCamera: using target for computeOrthoMatchForPerspective:', focusTarget);
      // Directly match ortho camera position, target, and upVector to arcCamera
      orthoCamera.position.copyFrom(arcCamera.position);
      orthoCamera.setTarget(focusTarget.clone());
      if (orthoCamera.upVector && arcCamera.upVector) {
        orthoCamera.upVector.copyFrom(arcCamera.upVector);
      }
      if (orthoCamera.upVector && arcCamera.upVector) {
        orthoCamera.upVector.copyFrom(arcCamera.upVector);
      }
      // --- Robust ortho match: use Babylon.js computeOrthoMatchForPerspective ---
      const orthoParams = computeOrthoMatchForPerspective(arcCamera, focusTarget, engine);
      console.log('[DEBUG] computeOrthoMatchForPerspective result:', JSON.stringify({
        orthoLeft: orthoParams.orthoLeft,
        orthoRight: orthoParams.orthoRight
      }));
      console.log('[DEBUG] orthoCamera AFTER switch:', JSON.stringify({
        position: orthoCamera.position,
        target: orthoCamera.target,
        upVector: orthoCamera.upVector,
        orthoLeft: orthoCamera.orthoLeft,
        orthoRight: orthoCamera.orthoRight,
        orthoTop: orthoCamera.orthoTop,
        orthoBottom: orthoCamera.orthoBottom
      }));
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

  // Custom right mouse drag to move all objects in world space
  let isRightDragging = false;
  let panStartPointerX = 0;
  let panStartPointerY = 0;
  let panStartWorldPoint = new Vector3();
  let objectsStartPositions: Vector3[] = [];
  let objectsStartScreenPositions: { x: number, y: number, z: number }[] = [];
  const canvas = engine.getRenderingCanvas();
  // Helper to always get the current camera (arc or ortho)
  function getActiveCamera(): TargetCamera {
    return scene.activeCamera as TargetCamera;
  }
  if (canvas) {
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 2) {
        // Extra: Try to pick a mesh under the pointer for debug
        let pickedMesh = null;
        if (scene) {
          const pickResult = scene.pick(scene.pointerX, scene.pointerY);
          if (pickResult && pickResult.hit && pickResult.pickedMesh) {
            pickedMesh = {
              name: pickResult.pickedMesh.name,
              position: pickResult.pickedMesh.position
            };
          }
        }
        isRightDragging = true;
        panStartPointerX = e.clientX;
        panStartPointerY = e.clientY;
        // Get the world point under the pointer at drag start
        const camera = getActiveCamera();
        const currentScene = camera.getScene();
        const pickPlaneNormal = camera.getForwardRay().direction;
        const plane = Plane.FromPositionAndNormal(camera.target, pickPlaneNormal);
        const ray = currentScene.createPickingRay(
          panStartPointerX,
          panStartPointerY,
          Matrix.Identity(),
          camera
        );
        const dist = ray.intersectsPlane(plane);
        console.log('[DEBUG] drag start dist:', dist);
        panStartWorldPoint = dist == null ? camera.target.clone() : ray.origin.add(ray.direction.scale(dist));
        console.log('[DEBUG] drag start panStartWorldPoint:', panStartWorldPoint);
        // Store each object's original position and screen position
        objectsStartPositions = ModeController.objects.map(obj => obj.sphere.position.clone());
        objectsStartScreenPositions = [];

        ModeController.objects.forEach(obj => {
          const pos = obj.sphere.position;
          const camera = scene.activeCamera!;
          // Log camera and sphere state with actual numbers for debugging
          const camPos = camera.globalPosition;
          let camTarget = (camera as any).target ? (camera as any).target : undefined;
          console.log('[DEBUG] Camera state NUMBERS:', {
            camPos: camPos && { x: camPos.x, y: camPos.y, z: camPos.z },
            camTarget: camTarget && { x: camTarget.x, y: camTarget.y, z: camTarget.z }
          });
          console.log('[DEBUG] Camera viewMatrix:', camera.getViewMatrix().toArray());
          console.log('[DEBUG] Camera projectionMatrix:', camera.getProjectionMatrix().toArray());
          console.log('[DEBUG] Sphere position:', { x: pos.x, y: pos.y, z: pos.z });
          // Project world to canvas pixel coordinates
          // Debug: print types before projection
          console.log('[DEBUG] Types:', { Vector3: Vector3 });
          const worldMatrix = obj.sphere.getWorldMatrix();
          const viewMatrix = camera.getViewMatrix();
          const projMatrix = camera.getProjectionMatrix();
          const viewport = new Viewport(0, 0, engine.getRenderWidth(), engine.getRenderHeight());
          console.log('[DEBUG] World matrix:', worldMatrix.toArray());
          console.log('[DEBUG] View matrix:', viewMatrix.toArray());
          console.log('[DEBUG] Projection matrix:', projMatrix.toArray());
          console.log('[DEBUG] Viewport:', viewport);
          console.log('[DEBUG] Camera type:', camera.getClassName ? camera.getClassName() : (camera.constructor && camera.constructor.name));
          console.log('[DEBUG] Camera handedness:', camera.getScene().useRightHandedSystem);
          const projected = Vector3.Project(
            pos,
            Matrix.Identity(),
            scene.getTransformMatrix(),
            scene.activeCamera!.viewport.toGlobal(
              engine.getRenderWidth(),
              engine.getRenderHeight()
            )
          );
          if (
            !isFinite(projected.x) || !isFinite(projected.y) || !isFinite(projected.z) ||
            isNaN(projected.x) || isNaN(projected.y) || isNaN(projected.z)
          ) {
            console.warn('[WARNING] Skipping object for drag: projection invalid', { pos, projected });
            // Do NOT push placeholders; skip this object entirely for this drag
            return;
          }
          // Clamp projected.z to [0, 0.99] for valid unprojection
          const clampedZ = Math.max(0, Math.min(0.99, projected.z));
          objectsStartWorldPositions.push(pos.clone());
          const cam = scene.activeCamera!;
          const depth = Vector3.Distance(cam.position, pos);
          objectsStartDepths.push(depth);
          const ray = scene.createPickingRay(panStartPointerX, panStartPointerY, Matrix.Identity(), cam);
          const rayPoint = ray.origin.add(ray.direction.scale(depth));
          const offset = pos.subtract(rayPoint);
          objectsStartOffsets.push(offset);
          objectsStartScreenPositions.push({ x: projected.x, y: projected.y, z: clampedZ });
        });
        console.log('[DEBUG] pointerdown (move objects):', {
          panStartWorldPoint,
          panStartPointerX,
          panStartPointerY,
          pickedMesh
        });
        e.preventDefault();
      }
    });
    // Drag state arrays (move to appropriate outer scope)
    const objectsStartWorldPositions: Vector3[] = [];
    const objectsStartDepths: number[] = [];
    const objectsStartOffsets: Vector3[] = [];

    canvas.addEventListener('pointermove', (e) => {
      if (isRightDragging) {
        // Move all objects to follow the mouse, preserving their original depth and offset
        const cam = scene.activeCamera!;
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        ModeController.draggableObjects.forEach((obj: Mesh, i: number) => {
          const depth = objectsStartDepths[i];
          const offset = objectsStartOffsets[i];
          // Defensive: skip if drag state is missing
          if (depth === undefined || offset === undefined) return;
          const ray = scene.createPickingRay(mouseX, mouseY, Matrix.Identity(), cam);
          const rayPoint = ray.origin.add(ray.direction.scale(depth));
          obj.position.copyFrom(rayPoint.add(offset));
        });
        // You may want to update the following block to also use only valid objects, or remove it if redundant
        /*
        const dx = e.clientX - panStartPointerX;
        const dy = e.clientY - panStartPointerY;
        ModeController.objects.forEach((obj, i) => {
          const origScreen = objectsStartScreenPositions[i];
          if (!origScreen) {
            // Skip this object, projection was invalid
            return;
          }
          // Add mouse delta to original pixel screen position
        });
        */
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
