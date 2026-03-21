import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { TextBlock } from "@babylonjs/gui/2D/controls";
import { Control } from "@babylonjs/gui/2D/controls/control";

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
  private arrowHeadA: Mesh | null = null;
  private arrowHeadB: Mesh | null = null;
  private startSphere: Mesh | null;
  private endSphere: Mesh | null;
  private preview: boolean;
  private laneIndex: number;
  private connectorColor: Color3;
  private overlayText: string = "";
  private labelPlane: Mesh | null = null;
  private labelTexture: AdvancedDynamicTexture | null = null;
  private labelTextBlock: TextBlock | null = null;
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
    this.disposeArrowHeads();
    this.connector.dispose(false, true);
    this.disposed = true;
  }

  isDisposed(): boolean {
    return this.disposed || (this.connector as any).isDisposed?.() === true;
  }

  update(): void {
    if (this.disposed) {
      return;
    }
    if (!this.preview && this.labelPlane) {
      this.updateLabelPlacement();
    }
    if (!this.startSphere || !this.endSphere) {
      return;
    }
    // Keep permanent connectors attached to sphere centers as spheres move.
    if ((this.startSphere as any).isDisposed?.() || (this.endSphere as any).isDisposed?.()) {
      this.dispose();
      return;
    }
    const nextStart = this.startSphere.position;
    const nextEnd = this.endSphere.position;
    if (
      Vector3.DistanceSquared(this.start, nextStart) <= Connector.UPDATE_EPSILON_SQ &&
      Vector3.DistanceSquared(this.end, nextEnd) <= Connector.UPDATE_EPSILON_SQ
    ) {
      return;
    }
    this.updatePath(nextStart, nextEnd);
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
    if (this.labelTextBlock) {
      this.labelTextBlock.text = this.overlayText;
    }
  }

  getOverlayText(): string {
    return this.overlayText;
  }

  setAlpha(alpha: number): void {
    this.connector.alpha = alpha;
    if (this.arrowHeadA) this.arrowHeadA.alpha = alpha;
    if (this.arrowHeadB) this.arrowHeadB.alpha = alpha;
    if (this.labelPlane) this.labelPlane.alpha = alpha * 0.55;
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
    mesh.isPickable = false;
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
    if (this.labelPlane && this.labelTexture && this.labelTextBlock) {
      return;
    }

    const plane = MeshBuilder.CreatePlane("connectorLabel", { width: 2.4, height: 0.72 }, this.scene);
    // Keep label as part of arc transform, not screen-facing billboard behavior.
    plane.billboardMode = Mesh.BILLBOARDMODE_NONE;
    plane.isPickable = false;
    plane.renderingGroupId = 1;

    const mat = new StandardMaterial("connectorLabelMat", this.scene);
    mat.disableLighting = true;
    mat.emissiveColor = Color3.Black();
    mat.specularColor = Color3.Black();
    mat.backFaceCulling = false;
    mat.alpha = 0.55;
    mat.zOffset = -2;
    plane.material = mat;

    const texture = AdvancedDynamicTexture.CreateForMesh(plane, 1024, 256, false);
    const text = new TextBlock("connectorLabelText");
    text.width = "96%";
    text.height = "90%";
    text.color = "#ffffff";
    text.fontSize = 150;
    text.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    text.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
    text.text = this.overlayText;
    texture.addControl(text);

    const parent = this.connector.parent;
    if (parent) {
      plane.parent = parent;
    }

    this.labelPlane = plane;
    this.labelTexture = texture;
    this.labelTextBlock = text;
  }

  private updateArrowHead(): void {
    if (this.preview) {
      this.disposeArrowHeads();
      return;
    }

    const { renderStart, renderEnd } = this.getRenderEndpoints();
    const direction = renderEnd.subtract(renderStart);
    const dist = direction.length();
    if (dist < 1e-6) {
      this.disposeArrowHeads();
      return;
    }
    direction.scaleInPlace(1 / dist);

    const activeCamera = this.scene.activeCamera;
    let toCamera = Vector3.Backward();
    if (activeCamera) {
      toCamera = activeCamera.position.subtract(renderEnd);
      if (toCamera.lengthSquared() > 1e-6) {
        toCamera.normalize();
      }
    }

    const path = this.buildPoints();
    const pathCount = path.length;
    let backDir = renderStart.subtract(renderEnd);
    if (pathCount >= 2) {
      const endPoint = path[pathCount - 1];
      const prevPoint = path[pathCount - 2];
      backDir = prevPoint.subtract(endPoint);
    }
    if (backDir.lengthSquared() < 1e-6) {
      backDir = direction.scale(-1);
    } else {
      backDir.normalize();
    }

    let side = Vector3.Cross(toCamera, backDir);
    if (side.lengthSquared() < 1e-6) {
      side = Vector3.Cross(backDir, Vector3.Up());
    }
    if (side.lengthSquared() < 1e-6) {
      side = Vector3.Cross(backDir, Vector3.Right());
    }
    if (side.lengthSquared() < 1e-6) {
      side = Vector3.Forward();
    } else {
      side.normalize();
    }

    const arrowLength = Math.max(0.07, dist * 0.028);
    const arrowWidth = Math.max(0.055, dist * 0.018);
    const arrowRadius = Math.max(0.0055, dist * 0.0016);
    // Slightly overlap the head into the arc so no visual seam appears.
    const tipOverlap = Math.max(0.02, dist * 0.006);
    const tip = renderEnd.add(backDir.scale(tipOverlap));
    const backPoint = tip.add(backDir.scale(arrowLength));
    const leftBase = backPoint.add(side.scale(arrowWidth));
    const rightBase = backPoint.subtract(side.scale(arrowWidth));

    this.disposeArrowHeads();

    this.arrowHeadA = MeshBuilder.CreateTube(
      "connectorArrowHeadA",
      { path: [tip, leftBase], radius: arrowRadius, tessellation: 8 },
      this.scene
    );
    this.arrowHeadB = MeshBuilder.CreateTube(
      "connectorArrowHeadB",
      { path: [tip, rightBase], radius: arrowRadius, tessellation: 8 },
      this.scene
    );

    const arrowMat = new StandardMaterial("connectorArrowMat", this.scene);
    arrowMat.disableLighting = true;
    arrowMat.backFaceCulling = false;
    arrowMat.disableDepthWrite = false;
    arrowMat.zOffset = 2;
    arrowMat.emissiveColor = this.connectorColor.clone();
    this.arrowHeadA.material = arrowMat;
    this.arrowHeadB.material = arrowMat;

    this.arrowHeadA.isPickable = false;
    this.arrowHeadB.isPickable = false;
    this.arrowHeadA.alwaysSelectAsActiveMesh = true;
    this.arrowHeadB.alwaysSelectAsActiveMesh = true;
    this.arrowHeadA.renderingGroupId = 0;
    this.arrowHeadB.renderingGroupId = 0;

    const parent = this.connector.parent;
    if (parent) {
      this.arrowHeadA.parent = parent;
      this.arrowHeadB.parent = parent;
    }
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
    const arrowMaterialA = this.arrowHeadA?.material;
    if (arrowMaterialA instanceof StandardMaterial) {
      arrowMaterialA.emissiveColor = this.connectorColor.clone();
    }
    const arrowMaterialB = this.arrowHeadB?.material;
    if (arrowMaterialB instanceof StandardMaterial) {
      arrowMaterialB.emissiveColor = this.connectorColor.clone();
    }
  }

  private disposeArrowHeads(): void {
    if (this.arrowHeadA) {
      this.arrowHeadA.dispose(false, true);
      this.arrowHeadA = null;
    }
    if (this.arrowHeadB) {
      this.arrowHeadB.dispose(false, true);
      this.arrowHeadB = null;
    }
  }

  private disposeLabel(): void {
    if (this.labelTexture) {
      this.labelTexture.dispose();
      this.labelTexture = null;
    }
    if (this.labelPlane) {
      this.labelPlane.dispose(false, true);
      this.labelPlane = null;
    }
    this.labelTextBlock = null;
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
      const startRadius = this.getSphereVisualRadius(this.startSphere) * 0.98;
      renderStart = start.add(direction.scale(startRadius));
    }
    if (this.endSphere) {
      const endRadius = this.getSphereVisualRadius(this.endSphere) * 0.98;
      renderEnd = end.subtract(direction.scale(endRadius));
    }

    return { renderStart, renderEnd };
  }

  private getSphereVisualRadius(sphere: Mesh): number {
    const extents = sphere.getBoundingInfo().boundingBox.extendSize;
    return Math.max(extents.x, extents.y, extents.z);
  }

  private updateLabelPlacement(): void {
    if (this.preview || !this.labelPlane) {
      return;
    }

    const path = this.buildPoints();
    if (path.length < 3) {
      this.labelPlane.position.copyFrom(this.end);
      return;
    }

    const startCenter = this.startSphere?.position ?? this.start;
    const endCenter = this.endSphere?.position ?? this.end;

    let bestIdx = Math.floor(path.length * 0.5);
    let bestClearance = -Infinity;
    for (let i = 2; i < path.length - 2; i++) {
      const p = path[i];
      const clearance = Math.min(Vector3.DistanceSquared(p, startCenter), Vector3.DistanceSquared(p, endCenter));
      if (clearance > bestClearance) {
        bestClearance = clearance;
        bestIdx = i;
      }
    }

    const anchor = path[bestIdx];
    const prev = path[Math.max(0, bestIdx - 1)];
    const next = path[Math.min(path.length - 1, bestIdx + 1)];
    let tangent = next.subtract(prev);
    if (tangent.lengthSquared() < 1e-6) {
      tangent = this.end.subtract(this.start);
    }
    if (tangent.lengthSquared() < 1e-6) {
      tangent = Vector3.Right();
    } else {
      tangent.normalize();
    }

    const activeCamera = this.scene.activeCamera;
    let toCamera = Vector3.Backward();
    if (activeCamera) {
      let cameraPosLocal = activeCamera.position.clone();
      const parent = this.labelPlane.parent;
      if (parent) {
        parent.computeWorldMatrix(true);
        const inv = parent.getWorldMatrix().clone();
        inv.invert();
        cameraPosLocal = Vector3.TransformCoordinates(activeCamera.position, inv);
      }
      toCamera = cameraPosLocal.subtract(anchor);
      if (toCamera.lengthSquared() > 1e-6) {
        toCamera.normalize();
      }
    }

    let side = Vector3.Cross(tangent, toCamera);
    if (side.lengthSquared() < 1e-6) {
      side = Vector3.Cross(tangent, Vector3.Up());
    }
    if (side.lengthSquared() < 1e-6) {
      side = Vector3.Right();
    } else {
      side.normalize();
    }

    const labelOffset = Math.max(0.22, Vector3.Distance(this.start, this.end) * 0.025);
    const candidateA = anchor.add(side.scale(labelOffset));
    const candidateB = anchor.subtract(side.scale(labelOffset));
    const score = (point: Vector3) =>
      Math.min(Vector3.DistanceSquared(point, startCenter), Vector3.DistanceSquared(point, endCenter));
    const labelPos = score(candidateA) >= score(candidateB) ? candidateA : candidateB;
    const cameraLift = Math.max(0.02, Vector3.Distance(this.start, this.end) * 0.004);
    labelPos.addInPlace(toCamera.scale(cameraLift));
    this.labelPlane.position.copyFrom(labelPos);

    // Orient label in arc-local frame so it rotates with the arc naturally.
    const xAxis = side.normalize();
    let zAxis = Vector3.Cross(xAxis, tangent);
    if (zAxis.lengthSquared() < 1e-6) {
      zAxis = Vector3.Forward();
    } else {
      zAxis.normalize();
    }
    const yAxis = tangent.normalize();
    const rotMat = Matrix.Identity();
    Matrix.FromXYZAxesToRef(xAxis, yAxis, zAxis, rotMat);
    this.labelPlane.rotationQuaternion = Quaternion.FromRotationMatrix(rotMat);
  }
}
