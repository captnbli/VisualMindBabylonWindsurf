import { Scene } from "@babylonjs/core/scene";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Vector3 } from "@babylonjs/core/Maths/math";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

interface ConnectorOptions {
  start: Vector3;
  end: Vector3;
  parent?: TransformNode;
  preview?: boolean;
  startSphere?: Mesh;
  endSphere?: Mesh;
}

export default class Connector {
  scene: Scene;
  start: Vector3;
  end: Vector3;
  connector: Mesh;
  private startSphere: Mesh | null;
  private endSphere: Mesh | null;
  private preview: boolean;
  private disposed: boolean = false;
  private static readonly UPDATE_EPSILON_SQ = 1e-8;

  constructor(scene: Scene, options: ConnectorOptions) {
    this.scene = scene;
    this.start = options.start.clone();
    this.end = options.end.clone();
    this.startSphere = options.startSphere ?? null;
    this.endSphere = options.endSphere ?? null;
    this.preview = options.preview ?? false;
    this.connector = this.createConnectorMesh(this.preview);
    if (options.parent) {
      this.connector.parent = options.parent;
    }
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
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
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
    this.start.copyFrom(startSphere.position);
    this.end.copyFrom(endSphere.position);

    const material = this.connector.material;
    if (material instanceof StandardMaterial) {
      material.emissiveColor = new Color3(1, 0.92, 0.35);
      material.name = "connectorMat";
    }
  }

  finalizeStatic(): void {
    this.startSphere = null;
    this.endSphere = null;
    this.preview = false;

    const material = this.connector.material;
    if (material instanceof StandardMaterial) {
      material.emissiveColor = new Color3(1, 0.92, 0.35);
      material.name = "connectorMat";
    }
  }

  private buildPoints(): Vector3[] {
    const points: Vector3[] = [];
    const mid = this.start.add(this.end).scale(0.5);
    const dist = Vector3.Distance(this.start, this.end);
    const control = mid.add(Vector3.Up().scale(Math.max(0.5, dist * 0.3)));
    const segments = 28;
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const a = this.start.scale((1 - t) * (1 - t));
      const b = control.scale(2 * (1 - t) * t);
      const c = this.end.scale(t * t);
      points.push(a.add(b).add(c));
    }
    return points;
  }

  private createConnectorMesh(preview: boolean): Mesh {
    const mesh = MeshBuilder.CreateTube(
      preview ? "connectorPreview" : "connector",
      { path: this.buildPoints(), radius: preview ? 0.035 : 0.045, tessellation: 8, updatable: true },
      this.scene
    );
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.refreshBoundingInfo(true);
    const mat = new StandardMaterial(preview ? "connectorPreviewMat" : "connectorMat", this.scene);
    mat.disableLighting = true;
    mat.emissiveColor = preview ? new Color3(0.35, 0.85, 1) : new Color3(1, 0.92, 0.35);
    mat.zOffset = -1;
    mesh.material = mat;
    return mesh;
  }
}
