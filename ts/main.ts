import "./set_babylon_global";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color4, Vector3 } from "@babylonjs/core/Maths/math";
import { Camera, ArcRotateCamera } from "@babylonjs/core/Cameras";
import { DirectionalLight, HemisphericLight } from "@babylonjs/core/Lights";
import ModeController from './mode_controller';
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

const APP_VERSION = 12;
document.title = `VisualMind Test v${APP_VERSION}`;

function addAppVersionBadge(): void {
  const existing = document.getElementById("app-version-badge");
  const badge = existing ?? document.createElement("div");
  badge.id = "app-version-badge";
  badge.textContent = `v${APP_VERSION}`;
  if (!existing) {
    badge.style.position = "fixed";
    badge.style.right = "10px";
    badge.style.bottom = "10px";
    badge.style.padding = "3px 8px";
    badge.style.border = "1px solid rgba(255,255,255,0.4)";
    badge.style.borderRadius = "999px";
    badge.style.background = "rgba(0,0,0,0.45)";
    badge.style.color = "#fff";
    badge.style.font = "12px/1.2 monospace";
    badge.style.pointerEvents = "none";
    badge.style.zIndex = "9999";
    document.body.appendChild(badge);
  }
}

const hmr = (import.meta as any).hot;
if (hmr) {
  hmr.accept(() => {
    window.location.reload();
  });
}

export function createScene(canvas: HTMLCanvasElement): Scene {
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0, 0, 0, 1);

  // Create a rig node to parent camera and lights
  const rig = new TransformNode("cameraRig", scene);
  const worldRoot = new TransformNode("worldRoot", scene);

  // ArcRotateCamera around origin
  const camera = new ArcRotateCamera(
    "camera",
    Math.PI / 2, // alpha (horizontal rotation)
    Math.PI / 2, // beta (vertical angle at equator)
    50,          // radius
    Vector3.Zero(), // target
    scene
  );
  // Don't attach default controls - ModeController handles input
  camera.mode = Camera.PERSPECTIVE_CAMERA;
  // Use a narrower FOV to reduce perspective distortion at edges
  camera.fov = 0.5; // Narrow FOV (in radians, ~28 degrees) for less distortion
  camera.parent = rig;

  // Limit zoom and rotation
  camera.lowerRadiusLimit = 20;
  camera.upperRadiusLimit = 500;
  // Allow full orbit around the model (avoid exact poles to prevent singularity).
  camera.lowerBetaLimit = 0.05;
  camera.upperBetaLimit = Math.PI - 0.05;

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
  ModeController.init({ scene, camera, engine, worldRoot });

  engine.runRenderLoop(() => {
    ModeController.updateObjects();
    scene.render();
  });

  window.addEventListener("resize", () => engine.resize());

  return scene;
}


const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
addAppVersionBadge();
// Disable right-click context menu
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
const scene = createScene(canvas);
