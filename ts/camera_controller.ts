import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3, Quaternion } from "@babylonjs/core/Maths/math";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

import { bus } from './events';
import { graphManager } from './graph_manager';

// Camera radius when focused on a node
const FLY_TO_RADIUS = 10;

// Pan: world units per pixel (scale by camera radius each frame)
const PAN_SCALE = 0.0006;

// Momentum: velocity decay multiplier per frame
const MOMENTUM_DECAY = 0.88;
const MOMENTUM_STOP_THRESHOLD = 0.05;

// Rotation speed radians per pixel
const ROTATION_SPEED = 0.0025;
const ROTATION_MIN_STEP = 0.0025;

// Fly-to lerp factor per frame
const FLY_LERP = 0.08;
const FLY_DONE_THRESHOLD = 0.01;

export class CameraController {
  private camera!: ArcRotateCamera;
  private worldRoot!: TransformNode;

  // Fly-to animation state
  private flyActive = false;
  private flyTargetWorldRootPos: Vector3 = Vector3.Zero();
  private flyTargetRadius = FLY_TO_RADIUS;

  // Momentum state (worldRoot translation)
  private momVelX = 0;
  private momVelY = 0;
  private momActive = false;

  // ─── Init ──────────────────────────────────────────────────────────────────

  init(config: { camera: ArcRotateCamera; worldRoot: TransformNode }): void {
    this.camera    = config.camera;
    this.worldRoot = config.worldRoot;
    this.subscribeEvents();
  }

  // ─── Event subscriptions ───────────────────────────────────────────────────

  private subscribeEvents(): void {
    bus.on('panMove',   ({ deltaX, deltaY }) => this.applyPan(deltaX, deltaY));
    bus.on('panEnd',    ({ vx, vy })         => this.startMomentum(vx, vy));
    bus.on('rotateMove',({ deltaX, deltaY }) => this.applyRotation(deltaX, deltaY));
    bus.on('rotateEnd', ()                   => this.onRotateEnd());
    bus.on('zoom',      ({ factor })         => this.applyZoom(factor));
    bus.on('flyToNode', ({ nodeId })         => this.startFlyTo(nodeId));

    // Any direct pointer interaction cancels momentum and fly-to
    bus.on('nodePointerDown',  () => this.cancelFlyAndMomentum());
    bus.on('emptyPointerDown', () => this.cancelFlyAndMomentum());
  }

  // ─── Per-frame update (called from main render loop) ──────────────────────

  update(): void {
    this.stepFlyTo();
    this.stepMomentum();

    // Tick concept spin animations
    for (const obj of graphManager.getAllObjects()) {
      if ('update' in obj && typeof (obj as any).update === 'function') {
        (obj as any).update();
      }
    }
  }

  // ─── Pan ───────────────────────────────────────────────────────────────────

  private applyPan(deltaX: number, deltaY: number): void {
    this.cancelFlyAndMomentum();
    this.translateWorldRoot(deltaX, deltaY);
  }

  private translateWorldRoot(deltaX: number, deltaY: number): void {
    const forward = this.camera.getTarget().subtract(this.camera.position).normalize();
    const worldUp = Vector3.Up();
    let right = Vector3.Cross(forward, worldUp);
    right = right.lengthSquared() < 1e-6 ? Vector3.Right() : right.normalize();
    const up = Vector3.Cross(right, forward).normalize();

    const scale = this.camera.radius * PAN_SCALE;
    const offset = right.scale(-deltaX * scale).add(up.scale(-deltaY * scale));
    this.worldRoot.position = this.worldRoot.position.add(offset);
  }

  // ─── Momentum ──────────────────────────────────────────────────────────────

  private startMomentum(vx: number, vy: number): void {
    this.momVelX  = vx;
    this.momVelY  = vy;
    this.momActive = true;
  }

  private stepMomentum(): void {
    if (!this.momActive) return;
    const speed = Math.sqrt(this.momVelX ** 2 + this.momVelY ** 2);
    if (speed < MOMENTUM_STOP_THRESHOLD) {
      this.momActive = false;
      return;
    }
    this.translateWorldRoot(this.momVelX, this.momVelY);
    this.momVelX *= MOMENTUM_DECAY;
    this.momVelY *= MOMENTUM_DECAY;
  }

  // ─── Rotation ──────────────────────────────────────────────────────────────

  private applyRotation(deltaX: number, deltaY: number): void {
    this.cancelFlyAndMomentum();

    const yawMag   = Math.abs(deltaX) * ROTATION_SPEED;
    const pitchMag = Math.abs(deltaY) * ROTATION_SPEED;
    const yaw   = deltaX === 0 ? 0 : -Math.sign(deltaX) * Math.max(yawMag,   ROTATION_MIN_STEP);
    const pitch = deltaY === 0 ? 0 :  Math.sign(deltaY) * Math.max(pitchMag, ROTATION_MIN_STEP);

    const viewDir = this.camera.getTarget().subtract(this.camera.position).normalize();
    let cameraRight = Vector3.Cross(viewDir, Vector3.Up());
    cameraRight = cameraRight.lengthSquared() < 1e-8 ? Vector3.Right() : cameraRight.normalize();

    const yawQ   = Quaternion.RotationAxis(Vector3.Up(), yaw);
    const pitchQ = Quaternion.RotationAxis(cameraRight, pitch);
    const stepQ  = yawQ.multiply(pitchQ);
    const cur    = this.worldRoot.rotationQuaternion ?? Quaternion.Identity();
    this.worldRoot.rotationQuaternion = stepQ.multiply(cur).normalize();
  }

  private onRotateEnd(): void {
    // Restore sphere label bands to canonical world-upright orientation
    for (const obj of graphManager.getAllObjects()) {
      if ('restoreInitialOrientationStyle' in obj) {
        (obj as any).restoreInitialOrientationStyle();
      }
    }
  }

  // ─── Zoom ──────────────────────────────────────────────────────────────────

  private applyZoom(factor: number): void {
    this.camera.radius *= factor;
    if (this.camera.lowerRadiusLimit != null) {
      this.camera.radius = Math.max(this.camera.radius, this.camera.lowerRadiusLimit);
    }
    if (this.camera.upperRadiusLimit != null) {
      this.camera.radius = Math.min(this.camera.radius, this.camera.upperRadiusLimit);
    }
  }

  // ─── Fly-to ────────────────────────────────────────────────────────────────

  private startFlyTo(nodeId: string): void {
    const node = graphManager.getNode(nodeId);
    if (!node) return;

    const nodeWorldPos = node.concept.sphere.getAbsolutePosition();
    // Move worldRoot so the node arrives at the camera target (origin)
    this.flyTargetWorldRootPos = this.worldRoot.position.subtract(nodeWorldPos);
    this.flyTargetRadius = FLY_TO_RADIUS;
    this.flyActive = true;
    this.momActive = false;
  }

  private stepFlyTo(): void {
    if (!this.flyActive) return;

    this.worldRoot.position = Vector3.Lerp(this.worldRoot.position, this.flyTargetWorldRootPos, FLY_LERP);
    this.camera.radius = this.camera.radius + (this.flyTargetRadius - this.camera.radius) * FLY_LERP;

    const posErr    = Vector3.Distance(this.worldRoot.position, this.flyTargetWorldRootPos);
    const radiusErr = Math.abs(this.camera.radius - this.flyTargetRadius);
    if (posErr < FLY_DONE_THRESHOLD && radiusErr < FLY_DONE_THRESHOLD) {
      this.worldRoot.position = this.flyTargetWorldRootPos.clone();
      this.camera.radius      = this.flyTargetRadius;
      this.flyActive = false;
    }
  }

  private cancelFlyAndMomentum(): void {
    this.flyActive = false;
    this.momActive = false;
  }
}

export const cameraController = new CameraController();
