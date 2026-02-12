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
}

export default class Connector {
  scene: Scene;
  start: Vector3;
  end: Vector3;
  connector: Mesh;

  constructor(scene: Scene, options: ConnectorOptions) {
    this.scene = scene;
    this.start = options.start.clone();
    this.end = options.end.clone();
    this.connector = this.createConnectorMesh(options.preview ?? false);
    if (options.parent) {
      this.connector.parent = options.parent;
    }
  }

  updatePath(start: Vector3, end: Vector3): void {
    this.start.copyFrom(start);
    this.end.copyFrom(end);
    this.connector.dispose(false, true);
    this.connector = this.createConnectorMesh(true);
  }

  dispose(): void {
    this.connector.dispose(false, true);
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
      { path: this.buildPoints(), radius: preview ? 0.035 : 0.045, tessellation: 8 },
      this.scene
    );
    mesh.isPickable = false;
    const mat = new StandardMaterial(preview ? "connectorPreviewMat" : "connectorMat", this.scene);
    mat.disableLighting = true;
    mat.emissiveColor = preview ? new Color3(0.35, 0.85, 1) : new Color3(1, 0.92, 0.35);
    mesh.material = mat;
    return mesh;
  }
}

