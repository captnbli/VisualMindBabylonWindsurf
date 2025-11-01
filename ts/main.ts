import "./set_babylon_global";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color3, Color4, Vector3, Matrix } from "@babylonjs/core/Maths/math";
import { Viewport } from "@babylonjs/core/Maths/math.viewport";
import { Camera, ArcRotateCamera, FreeCamera, TargetCamera } from "@babylonjs/core/Cameras";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { DirectionalLight, HemisphericLight } from "@babylonjs/core/Lights";
import { Plane } from "@babylonjs/core/Maths/math.plane";
import { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { computeOrthoMatchForPerspective } from "@babylonjs/core/Cameras/perspectiveConverters";
import ModeController from './mode_controller';
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

export function createScene(canvas: HTMLCanvasElement): Scene {
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 1);

  // Create a rig node to parent camera and lights
  const rig = new TransformNode("cameraRig", scene);

  // ArcRotateCamera around origin
  const camera = new ArcRotateCamera(
    "camera",
    Math.PI / 2, // alpha (horizontal rotation)
    Math.PI / 3, // beta (vertical angle)
    100,         // radius
    Vector3.Zero(), // target
    scene
  );
  camera.attachControl(canvas, true);
  camera.mode = Camera.ORTHOGRAPHIC_CAMERA; // Enable ortho mode
  camera.parent = rig;

  // Limit zoom and rotation
  camera.lowerRadiusLimit = 20;
  camera.upperRadiusLimit = 500;
  camera.lowerBetaLimit = 0.01;
  camera.upperBetaLimit = Math.PI / 2.2;

  // Ambient hemispheric light for soft fill
  const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.4;
  ambient.parent = rig;

  // Directional fill light, aligned with camera forward direction
  const fill = new DirectionalLight("fillLight", new Vector3(0, 0, -1), scene);
  fill.intensity = 1.2;
  fill.position = new Vector3(0, 0, 100); // In front of camera
  fill.parent = rig;

  // Keep light always facing the scene target
  scene.registerBeforeRender(() => {
    const dir = camera.getTarget().subtract(camera.position).normalize();
    fill.direction = dir;
  });

  // ModeController handles input and concept spawning
  ModeController.init({ scene, camera, engine });

  // Add visual indicator for camera mode
  const modeIndicator = document.createElement('div');
  modeIndicator.style.position = 'absolute';
  modeIndicator.style.top = '10px';
  modeIndicator.style.left = '10px';
  modeIndicator.style.color = 'white';
  modeIndicator.style.fontFamily = 'Arial, sans-serif';
  modeIndicator.style.fontSize = '14px';
  modeIndicator.style.backgroundColor = 'rgba(0,0,0,0.5)';
  modeIndicator.style.padding = '5px 10px';
  modeIndicator.style.borderRadius = '3px';
  modeIndicator.textContent = 'Camera Mode: Orthographic (Right-click to toggle)';
  document.body.appendChild(modeIndicator);

  // Update indicator when camera mode changes
  scene.registerBeforeRender(() => {
    const mode = camera.mode === Camera.ORTHOGRAPHIC_CAMERA ? 'Orthographic' : 'Perspective';
    modeIndicator.textContent = `Camera Mode: ${mode} (Right-click to toggle)`;
  });

  engine.runRenderLoop(() => {
    ModeController.updateObjects();
    scene.render();
  });

  window.addEventListener("resize", () => engine.resize());

  return scene;
}


const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
// Disable right-click context menu so Babylon camera orbit works
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
const scene = createScene(canvas);
