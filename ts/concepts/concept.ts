import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color3, Color4, Vector3 } from "@babylonjs/core/Maths/math";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMetallicRoughnessMaterial } from "@babylonjs/core/Materials/PBR/pbrMetallicRoughnessMaterial";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { TextBlock, Rectangle } from "@babylonjs/gui/2D/controls";
import { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";

interface ConceptOptions {
  color?: Color3;
  label?: string;
  radius?: number;
  position?: Vector3;
  camera?: Camera;
  engine?: Engine;
}

class Concept {
  scene: Scene;
  camera?: Camera;
  engine?: Engine;
  color: Color3;
  label: string;
  radius: number;
  position: Vector3;
  labelCount: number = 2;
  sphere: Mesh;
  // textBox: TextBlock;
  labelPlanes: Mesh[] = [];

  constructor(scene: Scene, options: ConceptOptions = {}) {
    this.scene = scene;
    this.color = options.color || Color3.Red();
    this.label = options.label || '';
    this.radius = options.radius ?? 1;
    this.position = options.position ?? new Vector3(0, 0, 0);
    this.camera = options.camera;
    this.engine = options.engine;

    // Create sphere using per-type color and radius
    this.sphere = MeshBuilder.CreateSphere("sphere", {
      diameter: this.radius * 2,
      segments: 64
    }, this.scene);

    // Use PBRMetallicRoughnessMaterial for realistic 3D shading
    const mat = new PBRMetallicRoughnessMaterial("mat", this.scene);
    mat.baseColor = this.color;
    mat.metallic = 0.5; // Moderate metallic for realistic shading
    mat.roughness = 0.5; // Moderate roughness for visible shading
    if (this.scene.environmentTexture) {
      mat.environmentTexture = this.scene.environmentTexture;
    }
    this.sphere.material = mat;
    this.sphere.position = this.position;
    console.log("[CONCEPT] Created metallic sphere at", this.position.toString());
    // Add label planes and GUI
    this.addLabels();
    this.sphere.refreshBoundingInfo(true);
    // this.createTextBox();
  }

  private addLabels(): void {
    const textureSize = 1024;
    const texture = new AdvancedDynamicTexture("LabelTexture", textureSize, textureSize, this.scene);
    const text = new TextBlock();
    text.text = this.label;
    text.color = "white";
    text.fontSize = 200;
    texture.addControl(text);

    for (let i = 0; i < this.labelCount; i++) {
      const angle = (i / this.labelCount) * Math.PI * 2;
      const x = Math.cos(angle) * (this.radius + 0.1);
      const z = Math.sin(angle) * (this.radius + 0.1);

      const labelPlane = MeshBuilder.CreatePlane("labelPlane", { size: this.radius }, this.scene);
      labelPlane.position.set(x, 0, z);
      labelPlane.material = new StandardMaterial("labelMat", this.scene);
      const labelMat = labelPlane.material as StandardMaterial;
      labelMat.diffuseTexture = texture;
      labelMat.useAlphaFromDiffuseTexture = true;

      this.labelPlanes.push(labelPlane);
      this.sphere.addChild(labelPlane);
    }
  }

  private createTextBox(): void {
    const advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI");
    const rect = new Rectangle();
    rect.width = "220px";
    rect.height = "100px";
    rect.cornerRadius = 20;
    rect.color = "White";
    rect.thickness = 4;
    rect.background = "green";
    advancedTexture.addControl(rect);

    const label = new TextBlock();
    label.text = "";
    label.color = "white";
    rect.addControl(label);

    this.textBox = label;
  }

  private updateTextBoxPosition(): void {
    // Placeholder for actual camera-to-GUI alignment logic
  }

  public update(): void {
    // Spheres are rotationally symmetric so they don't need to face the camera
    // They should appear circular naturally with proper camera FOV settings

    // Update labels to face camera
    if (this.camera) {
      this.labelPlanes.forEach(plane => {
        plane.lookAt(this.camera!.position);
      });
    }

    this.updateTextBoxPosition();
  }
}

export { Concept, ConceptOptions };
