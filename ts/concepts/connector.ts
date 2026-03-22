import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Vector3 } from "@babylonjs/core/Maths/math";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { TextBlock } from "@babylonjs/gui/2D/controls";

interface ConnectorOptions {
  start: Vector3;
  end: Vector3;
  parent?: TransformNode;
  preview?: boolean;
  startSphere?: Mesh;
  endSphere?: Mesh;
  laneIndex?: number;
  id?: string;
  explicitColor?: Color3;   // bypasses resolveConnectorColor when provided
  alpha?: number;            // initial opacity (0–1); default 1.0
}

export default class Connector {
  scene: Scene;
  start: Vector3;
  end: Vector3;
  connector: Mesh;
  id: string;
  private arrowMesh: Mesh | null = null;
  private startSphere: Mesh | null;
  private endSphere: Mesh | null;
  private preview: boolean;
  private laneIndex: number;
  private connectorColor: Color3;
  private overlayText: string = "";
  private labelAnchor: Mesh | null = null;
  private labelGUI: TextBlock | null = null;
  private static sharedUI: AdvancedDynamicTexture | null = null;
  private disposed: boolean = false;
  private static readonly UPDATE_EPSILON_SQ = 1e-8;

  constructor(scene: Scene, options: ConnectorOptions) {
    this.scene = scene;
    this.start = options.start.clone();
    this.end = options.end.clone();
    this.startSphere = options.startSphere ?? null;
    this.endSphere = options.endSphere ?? null;
    this.preview = options.preview ?? false;
    this.laneIndex = options.laneIndex ?? 0;
    this.id = options.id ?? crypto.randomUUID();
    this.connectorColor = options.explicitColor
      ? options.explicitColor.clone()
      : this.resolveConnectorColor();
    this.connector = this.createConnectorMesh(this.preview);
    if (options.parent) {
      this.connector.parent = options.parent;
    }
    if (options.alpha !== undefined) {
      this.setAlpha(options.alpha);
    }
    this.updateArrowHead();
  }

  updatePath(start: Vector3, end: Vector3): void {
    this.start.copyFrom(start);
    this.end.copyFrom(end);
    const currentMesh = this.connector;
    const currentParent = currentMesh.parent as TransformNode | null;
    const currentMaterial = currentMesh.material;
    const updatedMesh = MeshBuilder.CreateTube(
      this.preview ? "connectorPreview" : "connector",
      {
        path: this.buildPoints(),
        radius: this.preview ? 0.035 : 0.045,
        tessellation: 8,
        instance: currentMesh,
      },
      this.scene
    );
    if (updatedMesh !== currentMesh) {
      updatedMesh.material = currentMaterial;
      if (currentParent) {
        updatedMesh.parent = currentParent;
      }
      updatedMesh.isPickable = false;
      updatedMesh.alwaysSelectAsActiveMesh = true;
      currentMesh.dispose(false, false);
      this.connector = updatedMesh;
    }
    this.connector.refreshBoundingInfo(true);
    this.updateArrowHead();
    this.updateLabelPlacement();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposeLabel();
    this.disposeArrow();
    this.connector.dispose(false, true);
    this.disposed = true;
  }

  isDisposed(): boolean {
    return this.disposed || (this.connector as any).isDisposed?.() === true;
  }

  update(): void {
    if (this.disposed) return;

    if (!this.startSphere || !this.endSphere) {
      if (!this.preview && this.labelAnchor) this.updateLabelPlacement();
      return;
    }

    if ((this.startSphere as any).isDisposed?.() || (this.endSphere as any).isDisposed?.()) {
      this.dispose();
      return;
    }

    const nextStart = this.startSphere.position;
    const nextEnd   = this.endSphere.position;
    const spheresMoved =
      Vector3.DistanceSquared(this.start, nextStart) > Connector.UPDATE_EPSILON_SQ ||
      Vector3.DistanceSquared(this.end,   nextEnd)   > Connector.UPDATE_EPSILON_SQ;

    if (spheresMoved) {
      this.updatePath(nextStart, nextEnd);  // updates this.start/this.end, calls updateArrowHead
    } else {
      this.updateArrowHead();
    }

    // Label runs AFTER sphere positions are synced so it uses fresh this.start/this.end
    if (!this.preview && this.labelAnchor) this.updateLabelPlacement();
  }

  finalize(startSphere: Mesh, endSphere: Mesh): void {
    this.startSphere = startSphere;
    this.endSphere = endSphere;
    this.preview = false;
    this.laneIndex = 0;
    this.connectorColor = this.resolveConnectorColor();
    this.start.copyFrom(startSphere.position);
    this.end.copyFrom(endSphere.position);
    this.updatePath(startSphere.position, endSphere.position);
    this.applyConnectorColor();
    this.ensureLabel();
    this.updateLabelPlacement();
  }

  finalizeStatic(): void {
    this.startSphere = null;
    this.endSphere = null;
    this.preview = false;
    this.connectorColor = this.resolveConnectorColor();
    this.applyConnectorColor();
    this.updateArrowHead();
    this.ensureLabel();
    this.updateLabelPlacement();
  }

  finalizeWithLane(startSphere: Mesh, endSphere: Mesh, laneIndex: number): void {
    this.startSphere = startSphere;
    this.endSphere = endSphere;
    this.preview = false;
    this.laneIndex = laneIndex;
    this.connectorColor = this.resolveConnectorColor();
    this.start.copyFrom(startSphere.position);
    this.end.copyFrom(endSphere.position);
    this.updatePath(startSphere.position, endSphere.position);
    this.applyConnectorColor();
    this.ensureLabel();
    this.updateLabelPlacement();
  }

  setSourceSphere(sourceSphere: Mesh): void {
    this.startSphere = sourceSphere;
    const nextColor = this.resolveConnectorColor();
    if (
      this.connectorColor.r !== nextColor.r ||
      this.connectorColor.g !== nextColor.g ||
      this.connectorColor.b !== nextColor.b
    ) {
      this.connectorColor = nextColor;
      this.applyConnectorColor();
    }
  }

  getLaneIndex(): number {
    return this.laneIndex;
  }

  setOverlayText(newText: string): void {
    this.overlayText = newText.slice(0, 24);
    this.ensureLabel();
    if (this.labelGUI) {
      this.labelGUI.text = this.overlayText;
      this.labelGUI.isVisible = this.overlayText.length > 0;
    }
    if (this.labelAnchor && this.overlayText.length > 0) {
      this.updateLabelPlacement();
    }
  }

  getOverlayText(): string {
    return this.overlayText;
  }

  setColor(color: Color3): void {
    this.connectorColor = color.clone();
    this.applyConnectorColor();
  }

  setAlpha(alpha: number): void {
    (this.connector as any).alpha = alpha;
    if (this.arrowMesh) (this.arrowMesh as any).alpha = alpha;
    if (this.labelGUI) this.labelGUI.alpha = alpha;
  }

  setLaneIndex(index: number): void {
    if (this.laneIndex === index) return;
    this.laneIndex = index;
    if (!this.preview && this.startSphere && this.endSphere) {
      this.updatePath(this.startSphere.position, this.endSphere.position);
    }
  }

  connectsPair(a: Mesh, b: Mesh): boolean {
    if (!this.startSphere || !this.endSphere) {
      return false;
    }
    return (
      (this.startSphere === a && this.endSphere === b) ||
      (this.startSphere === b && this.endSphere === a)
    );
  }

  private buildPoints(): Vector3[] {
    const points: Vector3[] = [];
    const { renderStart, renderEnd } = this.getRenderEndpoints();
    const mid = renderStart.add(renderEnd).scale(0.5);
    const dist = Vector3.Distance(renderStart, renderEnd);
    const direction = renderEnd.subtract(renderStart).normalize();
    let side = Vector3.Cross(direction, Vector3.Up());
    if (side.lengthSquared() < 1e-6) {
      side = Vector3.Cross(direction, Vector3.Right());
    }
    if (side.lengthSquared() < 1e-6) {
      side = Vector3.Forward();
    } else {
      side.normalize();
    }

    const laneStep = this.getLaneStep(this.laneIndex);
    const baseArcHeight = Math.max(0.5, dist * 0.28);
    // Strong lane separation in vertical space keeps multiple arcs readable
    // from the default camera angle where lateral offsets can project to near-zero.
    const verticalOffset = dist * 0.12 * laneStep;
    const lateralOffset = dist * 0.05 * laneStep;
    const control = mid
      .add(Vector3.Up().scale(baseArcHeight + verticalOffset))
      .add(side.scale(lateralOffset));
    const segments = 28;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const a = renderStart.scale((1 - t) * (1 - t));
      const b = control.scale(2 * (1 - t) * t);
      const c = renderEnd.scale(t * t);
      points.push(a.add(b).add(c));
    }
    return points;
  }

  private getLaneStep(index: number): number {
    if (index <= 0) {
      return 0;
    }
    const magnitude = Math.ceil(index / 2);
    const sign = index % 2 === 1 ? 1 : -1;
    return magnitude * sign;
  }

  private createConnectorMesh(preview: boolean): Mesh {
    const mesh = MeshBuilder.CreateTube(
      preview ? "connectorPreview" : "connector",
      { path: this.buildPoints(), radius: preview ? 0.035 : 0.045, tessellation: 8, updatable: true },
      this.scene
    );
    mesh.isPickable = !preview;  // permanent connectors are pickable for click-to-select
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.renderingGroupId = 0;
    mesh.refreshBoundingInfo(true);
    const mat = new StandardMaterial(preview ? "connectorPreviewMat" : "connectorMat", this.scene);
    mat.disableLighting = true;
    mat.emissiveColor = this.connectorColor.clone();
    mat.zOffset = 2;
    mesh.material = mat;
    return mesh;
  }

  private ensureLabel(): void {
    if (this.preview) {
      this.disposeLabel();
      return;
    }
    if (this.labelAnchor && this.labelGUI) return;

    // Shared fullscreen UI — one per app, created once
    if (!Connector.sharedUI) {
      Connector.sharedUI = AdvancedDynamicTexture.CreateFullscreenUI('connectorLabels', true);
    }

    // Invisible anchor mesh positioned at the arc midpoint in worldRoot local space.
    // linkWithMesh() uses its projected 2D screen position, so the label always tracks the arc.
    const anchor = MeshBuilder.CreateSphere('connectorLabelAnchor', { diameter: 0.01 }, this.scene);
    anchor.isPickable = false;
    anchor.isVisible = false;
    anchor.metadata = { connectorId: this.id };
    const parent = this.connector.parent;
    if (parent) anchor.parent = parent;

    const text = new TextBlock('connectorLabel_' + this.id);
    text.text = this.overlayText;
    text.color = '#ffffff';
    text.fontSize = 14;
    text.outlineWidth = 3;
    text.outlineColor = '#000000';
    text.shadowColor = '#000000';
    text.shadowBlur = 6;
    text.isVisible = this.overlayText.length > 0;
    Connector.sharedUI.addControl(text);
    text.linkWithMesh(anchor);
    text.linkOffsetY = -16;   // nudge slightly above arc midpoint in screen space

    this.labelAnchor = anchor;
    this.labelGUI = text;
  }

  private updateArrowHead(): void {
    // Arrowheads temporarily disabled
    this.disposeArrow();
  }

  private resolveConnectorColor(): Color3 {
    const sourceMat = this.startSphere?.material as any;
    if (sourceMat?.baseColor instanceof Color3) {
      return sourceMat.baseColor.clone();
    }
    if (sourceMat?.albedoColor instanceof Color3) {
      return sourceMat.albedoColor.clone();
    }
    if (sourceMat?.diffuseColor instanceof Color3) {
      return sourceMat.diffuseColor.clone();
    }
    return this.preview ? new Color3(0.35, 0.85, 1) : new Color3(1, 0.92, 0.35);
  }

  private applyConnectorColor(): void {
    const material = this.connector.material;
    if (material instanceof StandardMaterial) {
      material.emissiveColor = this.connectorColor.clone();
      material.name = this.preview ? "connectorPreviewMat" : "connectorMat";
    }
    if (this.arrowMesh?.material instanceof StandardMaterial) {
      this.arrowMesh.material.emissiveColor = this.connectorColor.clone();
    }
  }

  private disposeArrow(): void {
    if (this.arrowMesh) {
      this.arrowMesh.dispose(false, true);
      this.arrowMesh = null;
    }
  }

  private disposeLabel(): void {
    if (this.labelGUI) {
      if (Connector.sharedUI) Connector.sharedUI.removeControl(this.labelGUI);
      this.labelGUI.dispose();
      this.labelGUI = null;
    }
    if (this.labelAnchor) {
      this.labelAnchor.dispose(false, true);
      this.labelAnchor = null;
    }
  }

  private getRenderEndpoints(): { renderStart: Vector3; renderEnd: Vector3 } {
    const start = this.start.clone();
    const end = this.end.clone();
    const direction = end.subtract(start);
    const dist = direction.length();
    if (dist < 1e-6) {
      return { renderStart: start, renderEnd: end };
    }

    direction.scaleInPlace(1 / dist);
    let renderStart = start;
    let renderEnd = end;

    if (this.startSphere) {
      const startRadius = this.getSphereVisualRadius(this.startSphere) * 1.25;
      renderStart = start.add(direction.scale(startRadius));
    }
    if (this.endSphere) {
      const endRadius = this.getSphereVisualRadius(this.endSphere) * 1.25;
      renderEnd = end.subtract(direction.scale(endRadius));
    }

    return { renderStart, renderEnd };
  }

  private getSphereVisualRadius(sphere: Mesh): number {
    const extents = sphere.getBoundingInfo().boundingBox.extendSize;
    return Math.max(extents.x, extents.y, extents.z);
  }

  private updateLabelPlacement(): void {
    if (this.preview || !this.labelAnchor) return;

    // Place the invisible anchor at the Bezier midpoint (t=0.5).
    // linkWithMesh() projects its world position to 2D, so the label always tracks the arc.
    const { renderStart, renderEnd } = this.getRenderEndpoints();
    const mid = renderStart.add(renderEnd).scale(0.5);
    const dist = Vector3.Distance(renderStart, renderEnd);
    const direction = renderEnd.subtract(renderStart).normalize();
    let side = Vector3.Cross(direction, Vector3.Up());
    if (side.lengthSquared() < 1e-6) side = Vector3.Cross(direction, Vector3.Right());
    side = side.lengthSquared() < 1e-6 ? Vector3.Forward() : side.normalize();

    const laneStep = this.getLaneStep(this.laneIndex);
    const baseArcHeight = Math.max(0.5, dist * 0.28);
    const control = mid
      .add(Vector3.Up().scale(baseArcHeight + dist * 0.12 * laneStep))
      .add(side.scale(dist * 0.05 * laneStep));

    // Bezier midpoint: B(0.5) = 0.25*renderStart + 0.5*control + 0.25*renderEnd
    const arcMid = renderStart.scale(0.25).add(control.scale(0.5)).add(renderEnd.scale(0.25));
    this.labelAnchor.position.copyFrom(arcMid);
  }
}
