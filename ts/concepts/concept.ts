import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color3, Vector3 } from "@babylonjs/core/Maths/math";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMetallicRoughnessMaterial } from "@babylonjs/core/Materials/PBR/pbrMetallicRoughnessMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { TextBlock } from "@babylonjs/gui/2D/controls";
import { Control } from "@babylonjs/gui/2D/controls/control";

interface ConceptOptions {
  color?: Color3;
  label?: string;
  textColor?: string;
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
  textColor: string;
  radius: number;
  position: Vector3;
  labelCount: number = 2;
  sphere: Mesh;
  private labelBand: Mesh | null = null;
  private labelBandTexture: AdvancedDynamicTexture | null = null;
  private labelTextBlocks: TextBlock[] = [];

  constructor(scene: Scene, options: ConceptOptions = {}) {
    this.scene = scene;
    this.color = options.color || Color3.Red();
    this.label = options.label || '';
    this.textColor = options.textColor || "#ffffff";
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
    this.ensureLabelBand();
    this.updateLabelBandText();
    this.sphere.refreshBoundingInfo(true);
  }

  private ensureLabelBand(): void {
    if (this.labelBand && this.labelBandTexture && this.labelTextBlocks.length === 2) {
      return;
    }

    const bandHeight = Math.max(0.25, this.radius * 0.35);
    this.labelBand = MeshBuilder.CreateCylinder(
      "labelBand",
      {
        diameterTop: this.radius * 2 + 0.04,
        diameterBottom: this.radius * 2 + 0.04,
        height: bandHeight,
        tessellation: 128,
      },
      this.scene
    );
    this.labelBand.parent = this.sphere;
    this.labelBand.position.set(0, 0, 0);

    const bandMat = new StandardMaterial("labelBandMat", this.scene);
    bandMat.disableLighting = true;
    bandMat.emissiveColor = Color3.Black();
    bandMat.specularColor = Color3.Black();
    bandMat.backFaceCulling = false;
    bandMat.zOffset = -2;
    this.labelBand.material = bandMat;

    this.labelBandTexture = AdvancedDynamicTexture.CreateForMesh(
      this.labelBand,
      2048,
      256,
      false
    );
    bandMat.diffuseTexture = this.labelBandTexture;
    if (bandMat.diffuseTexture instanceof Texture) {
      bandMat.diffuseTexture.uScale = -1;
      bandMat.diffuseTexture.uOffset = 1;
    }
    bandMat.useAlphaFromDiffuseTexture = true;

    const leftText = new TextBlock("labelLeft");
    leftText.width = "48%";
    leftText.height = "100%";
    leftText.left = "-26%";
    leftText.color = this.textColor;
    leftText.fontSize = 150;
    leftText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    leftText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;

    const rightText = new TextBlock("labelRight");
    rightText.width = "48%";
    rightText.height = "100%";
    rightText.left = "26%";
    rightText.color = this.textColor;
    rightText.fontSize = 150;
    rightText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    rightText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;

    this.labelBandTexture.addControl(leftText);
    this.labelBandTexture.addControl(rightText);
    this.labelTextBlocks = [leftText, rightText];
  }

  private updateLabelBandText(): void {
    this.ensureLabelBand();
    this.labelTextBlocks.forEach((textBlock) => {
      textBlock.text = this.label;
      textBlock.color = this.textColor;
    });
  }

  public update(): void {
    // Gentle spin to communicate object liveliness while preserving attached labels.
    this.sphere.rotation.y += 0.003;
  }

  public setOverlayText(newText: string): void {
    const trimmed = newText.slice(0, 12);
    this.label = trimmed;
    this.updateLabelBandText();
  }

  public getOverlayText(): string {
    return this.label;
  }
}

export { Concept, ConceptOptions };
