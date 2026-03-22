import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Matrix, Quaternion } from "@babylonjs/core/Maths/math";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Plane } from "@babylonjs/core/Maths/math.plane";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

import { bus } from './events';
import { graphManager } from './graph_manager';
import { ToolMode, KEY_MAP } from './types/graph_types';
import Connector from './concepts/connector';

const DRAG_THRESHOLD_PX = 5;

enum InputState {
  Idle           = 'idle',
  PointerArmed   = 'pointer_armed',
  Rotating       = 'rotating',
  Panning        = 'panning',
  DraggingSphere = 'dragging_sphere',
  ConnectorLinking = 'connector_linking',
}

export class InputHandler {
  private scene!: Scene;
  private camera!: ArcRotateCamera;
  private engine!: Engine;
  private worldRoot!: TransformNode;

  private toolMode: ToolMode = 'spin';
  private inputState: InputState = InputState.Idle;
  private activePointerId: number | null = null;
  private activeButton: number | null = null;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private pointerStartX = 0;
  private pointerStartY = 0;
  private hasMoved = false;

  // Node drag state
  private draggedNodeId: string | null = null;
  private dragPlane: Plane | null = null;
  private dragOffset: Vector3 = Vector3.Zero();

  // Connector linking state
  private connectorSourceId: string | null = null;
  private connectorRightClickId: string | null = null;
  private connectorClickId: string | null = null;
  private connectorDragPlane: Plane | null = null;
  private connectorHoverNodeId: string | null = null;
  private connectorLastEndLocal: Vector3 | null = null;
  private connectorPreview: Connector | null = null;

  // Pan velocity (pixel/frame, used for momentum on panEnd)
  private panVelX = 0;
  private panVelY = 0;

  // Placement plane — faces camera, passes through origin, compensates for zoom
  private readonly homePlaneOrigin: Vector3 = Vector3.Zero();
  private homePlaneNormal: Vector3 = Vector3.Forward();
  private homeCameraRadius = 100;

  // ─── Init ──────────────────────────────────────────────────────────────────

  init(config: { scene: Scene; camera: Camera; engine: Engine; worldRoot: TransformNode }): void {
    this.scene = config.scene;
    if (!(config.camera instanceof ArcRotateCamera)) {
      throw new Error('InputHandler requires ArcRotateCamera');
    }
    this.camera = config.camera;
    this.engine = config.engine;
    this.worldRoot = config.worldRoot;
    this.worldRoot.rotationQuaternion = this.worldRoot.rotationQuaternion ?? Quaternion.Identity();

    const initialForward = this.camera.getTarget().subtract(this.camera.position).normalize();
    this.homePlaneNormal = initialForward.scale(-1);
    this.homeCameraRadius = this.camera.radius;

    this.attachListeners();
    bus.on('toolModeChanged', ({ mode }) => { this.toolMode = mode; });
  }

  // ─── Attach DOM listeners ──────────────────────────────────────────────────

  private attachListeners(): void {
    window.addEventListener('keydown', (e) => this.onKeydown(e));

    const canvas = this.engine.getRenderingCanvas();
    if (!canvas) return;
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e), false);
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e), false);
    canvas.addEventListener('pointerup',   (e) => this.onPointerUp(e),   false);
    canvas.addEventListener('wheel',       (e) => this.onWheel(e), { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault(), false);
    window.addEventListener('resize', () => this.engine.resize());
  }

  // ─── Keyboard ──────────────────────────────────────────────────────────────

  private onKeydown(e: KeyboardEvent): void {
    // Let panel text fields handle their own input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if (e.key === 'Escape') {
      bus.emit('selectionChanged', { nodeId: null });
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      bus.emit('deleteRequest', {});
      return;
    }

    const matched = KEY_MAP[e.key.toLowerCase()];
    if (matched) {
      bus.emit('nodeTypeChanged', { nodeType: matched });
    }
  }

  // ─── Pointer down ──────────────────────────────────────────────────────────

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.button !== 2) return;

    const pos = this.canvasPos(e);
    if (!pos) return;

    e.preventDefault();
    e.stopPropagation();

    this.scene.pointerX = pos.x;
    this.scene.pointerY = pos.y;
    this.lastPointerX  = pos.x;
    this.lastPointerY  = pos.y;
    this.pointerStartX = pos.x;
    this.pointerStartY = pos.y;
    this.activePointerId = e.pointerId;
    this.activeButton    = e.button;
    this.hasMoved  = false;
    this.panVelX   = 0;
    this.panVelY   = 0;

    const canvas = this.engine.getRenderingCanvas();
    canvas?.setPointerCapture?.(e.pointerId);

    // Single pick, shared between button branches
    const pick = this.scene.pick(pos.x, pos.y);
    const sphereAncestor = pick?.hit && pick.pickedMesh
      ? this.findSphereAncestor(pick.pickedMesh)
      : null;
    const nodeId = sphereAncestor ? graphManager.nodeIdFromSphere(sphereAncestor) : null;
    const pickedConnId = !nodeId && pick?.hit
      ? (pick.pickedMesh?.metadata?.connectorId as string | undefined) ?? null
      : null;

    // ── Right button ──────────────────────────────────────────────────────────
    if (e.button === 2) {
      if (nodeId) {
        // Start connector preview
        const sphere = this.nodeIdToSphere(nodeId);
        if (sphere) {
          const fwd = this.camera.getTarget().subtract(this.camera.position).normalize();
          this.connectorDragPlane = Plane.FromPositionAndNormal(sphere.getAbsolutePosition(), fwd);
        }
        this.connectorSourceId    = nodeId;
        this.connectorHoverNodeId = null;
        this.connectorLastEndLocal = null;
        this.inputState = InputState.ConnectorLinking;
        bus.emit('nodePointerDown', { nodeId });
      } else {
        // Check if a connector arc or label was right-clicked
        const connId = pickedConnId;
        if (connId) {
          this.connectorRightClickId = connId;
          // No state change — just wait for pointer up
        } else {
          this.inputState = InputState.Panning;
          const w = this.pointerToWorld(pos.x, pos.y);
          bus.emit('emptyPointerDown', w);
        }
      }
      return;
    }

    // ── Left button ───────────────────────────────────────────────────────────
    if (pickedConnId && !nodeId) {
      // Clicked on a connector arc — will select source node on pointer-up.
      this.connectorClickId = pickedConnId;
      this.inputState = InputState.PointerArmed;
      return;
    }

    if (nodeId) {
      const sphere = this.nodeIdToSphere(nodeId);
      if (sphere) {
        const worldPos  = sphere.getAbsolutePosition();
        const dragNormal = this.camera.getTarget().subtract(this.camera.position).normalize();
        const origin    = pick?.pickedPoint ?? worldPos;
        this.dragPlane  = Plane.FromPositionAndNormal(origin, dragNormal);
        const ray = this.scene.createPickingRay(pos.x, pos.y, Matrix.Identity(), this.camera);
        const dist = ray.intersectsPlane(this.dragPlane);
        if (dist != null) {
          this.dragOffset = worldPos.subtract(ray.origin.add(ray.direction.scale(dist)));
        }
      }
      this.draggedNodeId = nodeId;
      this.inputState    = InputState.DraggingSphere;
      bus.emit('nodePointerDown', { nodeId });
    } else {
      this.inputState = InputState.PointerArmed;
      const w = this.pointerToWorld(pos.x, pos.y);
      bus.emit('emptyPointerDown', w);
    }
  }

  // ─── Pointer move ──────────────────────────────────────────────────────────

  private onPointerMove(e: PointerEvent): void {
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;

    const pos = this.canvasPos(e);
    if (!pos) return;

    this.scene.pointerX = pos.x;
    this.scene.pointerY = pos.y;

    if (this.inputState === InputState.Idle) return;

    const dx = pos.x - this.lastPointerX;
    const dy = pos.y - this.lastPointerY;

    // Threshold check: promote PointerArmed → Rotating once dragged far enough
    if (!this.hasMoved) {
      const tdx = pos.x - this.pointerStartX;
      const tdy = pos.y - this.pointerStartY;
      if (Math.abs(tdx) > DRAG_THRESHOLD_PX || Math.abs(tdy) > DRAG_THRESHOLD_PX) {
        this.hasMoved = true;
        if (this.inputState === InputState.PointerArmed) {
          this.inputState = this.toolMode === 'pan' ? InputState.Panning : InputState.Rotating;
        }
      }
    }

    if (this.inputState === InputState.DraggingSphere && this.draggedNodeId && this.dragPlane) {
      const ray  = this.scene.createPickingRay(pos.x, pos.y, Matrix.Identity(), this.camera);
      const dist = ray.intersectsPlane(this.dragPlane);
      if (dist != null) {
        const local = this.worldToLocal(ray.origin.add(ray.direction.scale(dist)).add(this.dragOffset));
        bus.emit('nodeDragMove', { nodeId: this.draggedNodeId, localX: local.x, localY: local.y, localZ: local.z });
      }
    }

    if (this.inputState === InputState.Panning) {
      this.panVelX = dx;
      this.panVelY = dy;
      bus.emit('panMove', { deltaX: dx, deltaY: dy });
    }

    if (this.inputState === InputState.ConnectorLinking && this.connectorSourceId) {
      const sourceSphere = this.nodeIdToSphere(this.connectorSourceId);
      if (sourceSphere) {
        const startLocal  = sourceSphere.position.clone();
        let   endLocal: Vector3 | null = null;

        // Re-pick to find hover target
        const hoverPick = this.scene.pick(pos.x, pos.y);
        const hoverId = hoverPick?.hit && hoverPick.pickedMesh
          ? graphManager.nodeIdFromSphere(this.findSphereAncestor(hoverPick.pickedMesh) as Mesh)
          : null;

        if (hoverId && hoverId !== this.connectorSourceId) {
          this.connectorHoverNodeId = hoverId;
          const hSphere = this.nodeIdToSphere(hoverId);
          if (hSphere) endLocal = hSphere.position.clone();
        } else {
          this.connectorHoverNodeId = null;
          if (this.connectorDragPlane) {
            const ray  = this.scene.createPickingRay(pos.x, pos.y, Matrix.Identity(), this.camera);
            const dist = ray.intersectsPlane(this.connectorDragPlane);
            if (dist != null) endLocal = this.worldToLocal(ray.origin.add(ray.direction.scale(dist)));
          }
        }

        if (endLocal) {
          this.connectorLastEndLocal = endLocal.clone();
          this.updateConnectorPreview(startLocal, endLocal, sourceSphere);
        }
      }
    }

    if (this.inputState === InputState.Rotating) {
      bus.emit('rotateMove', { deltaX: dx, deltaY: dy });
    }

    this.lastPointerX = pos.x;
    this.lastPointerY = pos.y;
  }

  // ─── Pointer up ────────────────────────────────────────────────────────────

  private onPointerUp(e: PointerEvent): void {
    if (this.activePointerId !== null && e.pointerId !== this.activePointerId) return;

    const pos = this.canvasPos(e);
    if (pos) {
      this.scene.pointerX = pos.x;
      this.scene.pointerY = pos.y;
    }

    if (this.activeButton === 0) {
      if (this.inputState === InputState.DraggingSphere && this.draggedNodeId) {
        bus.emit('nodeDragEnd', { nodeId: this.draggedNodeId });
      }
      if (this.inputState === InputState.PointerArmed && !this.hasMoved) {
        if (this.connectorClickId) {
          bus.emit('connectorSelected', { connectionId: this.connectorClickId });
        } else {
          const local = pos ? this.pointerToLocal(pos.x, pos.y) : null;
          if (local) {
            bus.emit('createNodeRequest', { localX: local.x, localY: local.y, localZ: local.z });
          }
        }
      }
    }

    if (this.activeButton === 0 && this.inputState === InputState.Rotating) {
      bus.emit('rotateEnd', {});
    }

    if (this.activeButton === 2) {
      // Right-click tap on a connector label → connector context menu
      if (this.connectorRightClickId && !this.hasMoved) {
        bus.emit('showConnectorContextMenu', {
          connectionId: this.connectorRightClickId,
          screenX: e.clientX,
          screenY: e.clientY,
        });
      }

      if (this.inputState === InputState.ConnectorLinking && this.connectorSourceId) {
        if (!this.hasMoved) {
          // Right-click tap on node → context menu
          bus.emit('showContextMenu', {
            nodeId: this.connectorSourceId,
            screenX: e.clientX,
            screenY: e.clientY,
          });
        } else {
          const targetId = this.resolveConnectorTarget();
          if (targetId) {
            bus.emit('connectRequest', {
              sourceId: this.connectorSourceId,
              targetId,
              relationshipType: 'leads to',
            });
          }
        }
      }
      if (this.inputState === InputState.Panning) {
        bus.emit('panEnd', { vx: this.panVelX, vy: this.panVelY });
      }
    }

    this.resetState();
  }

  // ─── Wheel ─────────────────────────────────────────────────────────────────

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const raw    = Math.exp(e.deltaY * 0.0003);
    const factor = Math.min(Math.max(raw, 0.97), 1.03);
    bus.emit('zoom', { factor });
  }

  // ─── Connector preview ─────────────────────────────────────────────────────

  private updateConnectorPreview(start: Vector3, end: Vector3, startSphere: Mesh): void {
    if (this.connectorPreview) {
      this.connectorPreview.setSourceSphere(startSphere);
      this.connectorPreview.updatePath(start, end);
      this.connectorPreview.connector.parent = this.worldRoot;
      return;
    }
    this.connectorPreview = new Connector(this.scene, {
      start,
      end,
      startSphere,
      parent: this.worldRoot,
      preview: true,
    });
  }

  private disposeConnectorPreview(): void {
    this.connectorPreview?.dispose();
    this.connectorPreview = null;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private canvasPos(e: MouseEvent): { x: number; y: number } | null {
    const canvas = this.engine.getRenderingCanvas();
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private nodeIdToSphere(nodeId: string): Mesh | null {
    return graphManager.getNode(nodeId)?.concept.sphere ?? null;
  }

  private resolveConnectorTarget(): string | null {
    // Direct pick under cursor wins
    const pick = this.scene.pick(this.scene.pointerX, this.scene.pointerY);
    if (pick?.hit && pick.pickedMesh) {
      const id = graphManager.nodeIdFromSphere(this.findSphereAncestor(pick.pickedMesh) as Mesh);
      if (id && id !== this.connectorSourceId) return id;
    }

    // Last hover sphere
    if (this.connectorHoverNodeId && this.connectorHoverNodeId !== this.connectorSourceId) {
      return this.connectorHoverNodeId;
    }

    // Proximity fallback: nearest sphere to last preview endpoint
    if (this.connectorLastEndLocal) {
      let nearest: { id: string; dist: number } | null = null;
      for (const sphere of graphManager.getNodeSpheres()) {
        const id = graphManager.nodeIdFromSphere(sphere);
        if (!id || id === this.connectorSourceId) continue;
        const dist = Vector3.Distance(sphere.position, this.connectorLastEndLocal);
        if (!nearest || dist < nearest.dist) nearest = { id, dist };
      }
      if (nearest) {
        const sphere = this.nodeIdToSphere(nearest.id);
        if (sphere) {
          const r = sphere.getBoundingInfo().boundingSphere.radius;
          if (nearest.dist <= r * 0.35) return nearest.id;
        }
      }
    }

    return null;
  }

  private findSphereAncestor(mesh: any): Mesh | null {
    let cur = mesh;
    while (cur) {
      if (typeof cur.name === 'string' && cur.name.startsWith('sphere')) return cur as Mesh;
      cur = cur.parent;
    }
    return null;
  }

  private worldToLocal(worldPos: Vector3): Vector3 {
    this.worldRoot.computeWorldMatrix(true);
    const inv = this.worldRoot.getWorldMatrix().clone();
    inv.invert();
    return Vector3.TransformCoordinates(worldPos, inv);
  }

  /** Convert screen coords to worldRoot-local position on the placement plane. */
  private pointerToLocal(x: number, y: number): Vector3 | null {
    const zoomDelta   = this.camera.radius - this.homeCameraRadius;
    const planeOrigin = this.homePlaneOrigin.add(this.homePlaneNormal.scale(zoomDelta));
    const plane = Plane.FromPositionAndNormal(planeOrigin, this.homePlaneNormal);
    const ray   = this.scene.createPickingRay(x, y, Matrix.Identity(), this.camera);
    const dist  = ray.intersectsPlane(plane);
    if (dist == null) return null;
    return this.worldToLocal(ray.origin.add(ray.direction.scale(dist)));
  }

  /** Same as pointerToLocal but returns as world coords for emptyPointerDown. */
  private pointerToWorld(x: number, y: number): { worldX: number; worldY: number; worldZ: number } {
    const local = this.pointerToLocal(x, y);
    if (!local) return { worldX: 0, worldY: 0, worldZ: 0 };
    // Re-express in world space for the event payload
    const world = Vector3.TransformCoordinates(local, this.worldRoot.getWorldMatrix());
    return { worldX: world.x, worldY: world.y, worldZ: world.z };
  }

  // ─── Reset ─────────────────────────────────────────────────────────────────

  private resetState(): void {
    const canvas = this.engine.getRenderingCanvas();
    if (canvas && this.activePointerId !== null) {
      try { canvas.releasePointerCapture(this.activePointerId); } catch { /* already released */ }
    }

    this.disposeConnectorPreview();
    this.inputState        = InputState.Idle;
    this.activePointerId   = null;
    this.activeButton      = null;
    this.hasMoved          = false;
    this.pointerStartX     = 0;
    this.pointerStartY     = 0;
    this.draggedNodeId     = null;
    this.dragPlane         = null;
    this.dragOffset        = Vector3.Zero();
    this.connectorSourceId    = null;
    this.connectorRightClickId = null;
    this.connectorClickId      = null;
    this.connectorDragPlane   = null;
    this.connectorHoverNodeId = null;
    this.connectorLastEndLocal = null;
    this.panVelX = 0;
    this.panVelY = 0;
  }
}

export const inputHandler = new InputHandler();
