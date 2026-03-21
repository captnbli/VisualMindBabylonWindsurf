import "./set_babylon_global";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color4, Vector3 } from "@babylonjs/core/Maths/math";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { DirectionalLight, HemisphericLight } from "@babylonjs/core/Lights";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

import { bus } from './events';
import { graphManager } from './graph_manager';
import { inputHandler } from './input_handler';
import { cameraController } from './camera_controller';
import { selectionManager } from './selection_manager';
import { persistenceManager } from './persistence_manager';
import { panelController } from './ui/panel_controller';
import { toolbarController } from './ui/toolbar_controller';
import { DEMO_BRAIN } from './demo_brain';
import { Mode } from './concepts/types';

const APP_VERSION = 43;
document.title = `VisualMind v${APP_VERSION}`;

// ─── HMR ──────────────────────────────────────────────────────────────────────

const hmr = (import.meta as any).hot;
if (hmr) {
  hmr.accept(() => { window.location.reload(); });
}

// ─── Version badge ────────────────────────────────────────────────────────────

function addVersionBadge(): void {
  const badge = document.createElement('div');
  badge.id = 'app-version-badge';
  badge.textContent = `v${APP_VERSION}`;
  Object.assign(badge.style, {
    position:      'fixed',
    right:         '10px',
    bottom:        '10px',
    padding:       '3px 8px',
    border:        '1px solid rgba(255,255,255,0.2)',
    borderRadius:  '999px',
    background:    'rgba(0,0,0,0.4)',
    color:         '#fff',
    font:          '11px/1.2 monospace',
    pointerEvents: 'none',
    zIndex:        '9999',
  });
  document.body.appendChild(badge);
}

// ─── Scene bootstrap ──────────────────────────────────────────────────────────

function createScene(canvas: HTMLCanvasElement): Scene {
  const engine = new Engine(canvas, true);
  const scene  = new Scene(engine);
  scene.clearColor = new Color4(0.03, 0.03, 0.05, 1);

  // Exponential fog for depth cueing
  scene.fogMode    = Scene.FOGMODE_EXP2;
  scene.fogDensity = 0.008;
  scene.fogColor.set(0.03, 0.03, 0.05);

  const worldRoot = new TransformNode('worldRoot', scene);
  const rig       = new TransformNode('cameraRig',  scene);

  // ── Camera ─────────────────────────────────────────────────────────────────
  const camera = new ArcRotateCamera('camera', Math.PI / 2, Math.PI / 2, 50, Vector3.Zero(), scene);
  camera.mode             = Camera.PERSPECTIVE_CAMERA;
  camera.fov              = 0.5;
  camera.lowerRadiusLimit = 5;
  camera.upperRadiusLimit = 500;
  camera.lowerBetaLimit   = 0.05;
  camera.upperBetaLimit   = Math.PI - 0.05;
  camera.parent           = rig;
  // Disable built-in camera input — InputHandler owns all pointer events
  camera.inputs.clear();

  // ── Lights ─────────────────────────────────────────────────────────────────
  const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.4;
  ambient.parent    = rig;

  const fill = new DirectionalLight('fill', new Vector3(0, 0, -1), scene);
  fill.intensity = 1.2;
  fill.position  = new Vector3(0, 0, 100);
  fill.parent    = rig;

  scene.registerBeforeRender(() => {
    fill.direction = camera.getTarget().subtract(camera.position).normalize();
  });

  // ── Manager init ───────────────────────────────────────────────────────────
  graphManager.init({ scene, worldRoot, camera, engine });
  inputHandler.init({ scene, camera, worldRoot, engine });
  cameraController.init({ camera, worldRoot });
  selectionManager.init({ scene });
  persistenceManager.init();
  panelController.init();
  toolbarController.init();

  // ── Bus orchestration ─────────────────────────────────────────────────────
  wireOrchestration();

  // ── Load saved state or demo brain ────────────────────────────────────────
  const restored = persistenceManager.load();
  if (!restored) {
    graphManager.deserialize(DEMO_BRAIN);
  }

  // ── Render loop ───────────────────────────────────────────────────────────
  engine.runRenderLoop(() => {
    cameraController.update();
    scene.render();
  });

  return scene;
}

// ─── Orchestration ────────────────────────────────────────────────────────────
//
// main.ts is the wiring layer. It listens for semantic input events and
// delegates to the appropriate manager methods.

let currentNodeType: Mode = 'answer';

function wireOrchestration(): void {
  // Track active brush type
  bus.on('nodeTypeChanged', ({ nodeType }) => {
    currentNodeType = nodeType;
  });

  // Create a node when user clicks empty space, then immediately select it for input
  bus.on('createNodeRequest', ({ localX, localY, localZ }) => {
    const nodeId = graphManager.createNode({
      nodeType: currentNodeType,
      position: new Vector3(localX, localY, localZ),
    });
    selectionManager.selectNode(nodeId);
  });

  // Stream drag position to sphere
  bus.on('nodeDragMove', ({ nodeId, localX, localY, localZ }) => {
    graphManager.moveNode(nodeId, localX, localY, localZ);
  });

  // Create connector when a link gesture completes
  bus.on('connectRequest', ({ sourceId, targetId, relationshipType }) => {
    graphManager.createConnector({ sourceId, targetId, relationshipType });
  });

  // Delete selected node
  bus.on('deleteRequest', () => {
    const nodeId = selectionManager.getSelectedNodeId();
    if (nodeId) graphManager.deleteNode(nodeId);
  });
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
addVersionBadge();
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
createScene(canvas);
