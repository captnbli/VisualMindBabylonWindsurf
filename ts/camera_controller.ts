import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3, Quaternion, Matrix } from "@babylonjs/core/Maths/math";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

import { bus } from './events';
import { graphManager } from './graph_manager';

// Camera radius when focused on a node
const FLY_TO_RADIUS = 30;

// Pan: world units per pixel (scale by camera radius each frame)
const PAN_SCALE = 0.0006;

// Momentum: velocity decay multiplier per frame
const MOMENTUM_DECAY = 0.88;
const MOMENTUM_STOP_THRESHOLD = 0.05;

// Rotation speed radians per pixel
const ROTATION_SPEED = 0.0025;
const ROTATION_MIN_STEP = 0.0025;

// Fly-to lerp factor per frame
const FLY_LERP = 0.12;
const FLY_DONE_THRESHOLD = 0.05;

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
    bus.on('flyToNode',    ({ nodeId })  => this.startFlyTo(nodeId));
    bus.on('cameraReset', ()             => this.reset());

    // Cancel fly-to when the user starts dragging a node (both would fight)
    bus.on('nodePointerDown',  () => this.cancelFlyAndMomentum());
    // Note: emptyPointerDown intentionally NOT listed — cancelling there aborts
    // the fly-to the moment the user clicks the canvas to start spinning, before
    // the animation has had any chance to run.  applyRotation / applyPan already
    // call cancelFlyAndMomentum() as soon as real pointer movement begins.
  }

  // ─── Per-frame update (called from main render loop) ──────────────────────

  update(): void {
    this.stepFlyTo();
    this.stepMomentum();

    // Tick concept spin animations only — connectors are updated each frame
    // by graphManager's scene.registerBeforeRender callback; calling update()
    // on them here too would double every per-frame allocation (Vector3, Matrix).
    for (const concept of graphManager.getAllConcepts()) {
      concept.update();
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

    // Also rotate worldRoot.position by stepQ so that spin always orbits world origin
    // (the camera target), regardless of where worldRoot.position currently sits.
    if (this.worldRoot.position.lengthSquared() > 1e-6) {
      const rotMat = new Matrix();
      stepQ.toRotationMatrix(rotMat);
      this.worldRoot.position = Vector3.TransformNormal(this.worldRoot.position, rotMat);
    }
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
    if (!node) {
      console.warn('[FlyTo] node not found:', nodeId);
      return;
    }

    this.cancelFlyAndMomentum();

    // sphere.position is in worldRoot's LOCAL space.
    // To place the sphere at world origin we need:
    //   worldRoot.position + R * sphere.localPos = 0
    //   worldRoot.position = -(R * sphere.localPos)
    // Using local position avoids any stale getAbsolutePosition() cache issues.
    const sphere = node.concept.sphere;
    const rot = this.worldRoot.rotationQuaternion ?? Quaternion.Identity();
    const rotMatrix = new Matrix();
    rot.toRotationMatrix(rotMatrix);
    const targetPos = Vector3.TransformNormal(sphere.position, rotMatrix).negateInPlace();

    console.log('[FlyTo] node:', nodeId, 'localPos:', sphere.position.toString(), '→ worldRoot target:', targetPos.toString());

    // Snap position immediately — clone so worldRoot._position and flyTargetWorldRootPos
    // are separate objects and don't alias each other.
    this.worldRoot.position.copyFrom(targetPos);

    // Animate only the camera radius so the user sees clear visual feedback.
    this.flyTargetWorldRootPos = targetPos.clone();
    this.flyTargetRadius = FLY_TO_RADIUS;
    this.flyActive = true;
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

  private reset(): void {
    this.cancelFlyAndMomentum();
    this.worldRoot.position = Vector3.Zero();
    this.worldRoot.rotationQuaternion = Quaternion.Identity();
    this.camera.radius = 50;
  }

  private cancelFlyAndMomentum(): void {
    this.flyActive = false;
    this.momActive = false;
  }
}

export const cameraController = new CameraController();
