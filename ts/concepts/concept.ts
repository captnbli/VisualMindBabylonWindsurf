import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Color3, Vector3, Quaternion } from "@babylonjs/core/Maths/math";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMetallicRoughnessMaterial } from "@babylonjs/core/Materials/PBR/pbrMetallicRoughnessMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { TextBlock, TextWrapping } from "@babylonjs/gui/2D/controls";
import { Control } from "@babylonjs/gui/2D/controls/control";
import { Mode } from './types';

// weight → sphere scale multiplier
// weight 2 = scale 1.0 (preserves original sphere size)
export function weightToScale(weight: 1 | 2 | 3 | 4 | 5): number {
  return 0.6 + weight * 0.2;
}

interface ConceptOptions {
  color?: Color3;
  label?: string;
  textColor?: string;
  radius?: number;
  position?: Vector3;
  camera?: Camera;
  engine?: Engine;
  // Rich node fields
  id?: string;
  notes?: string;
  weight?: 1 | 2 | 3 | 4 | 5;
  nodeType?: Mode;
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
  // Rich node fields
  id: string;
  notes: string;
  weight: 1 | 2 | 3 | 4 | 5;
  nodeType: Mode | null;
  private labelBand: Mesh | null = null;
  private labelBandTexture: AdvancedDynamicTexture | null = null;
  private labelTextBlocks: TextBlock[] = [];
  private childBadge: TextBlock | null = null;
  private spinAngle: number = 0;
  private static readonly SPIN_SPEED = 0.003;

  constructor(scene: Scene, options: ConceptOptions = {}) {
    this.scene = scene;
    this.color = options.color || Color3.Red();
    this.label = options.label || '';
    this.textColor = options.textColor || "#ffffff";
    this.radius = options.radius ?? 1;
    this.position = options.position ?? new Vector3(0, 0, 0);
    this.camera = options.camera;
    this.engine = options.engine;
    this.id = options.id ?? crypto.randomUUID();
    this.notes = options.notes ?? '';
    this.weight = options.weight ?? 3;
    this.nodeType = options.nodeType ?? null;

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
    this.sphere.renderingGroupId = 1;
    this.sphere.position = this.position;
    // Apply weight-based scale (weight 2 = scale 1.0 = original size)
    this.sphere.scaling.setAll(weightToScale(this.weight));
    this.ensureLabelBand();
    this.updateLabelBandText();
    this.sphere.refreshBoundingInfo(true);
  }

  private ensureLabelBand(): void {
    if (this.labelBand && this.labelBandTexture && this.labelTextBlocks.length === 2) {
      return;
    }

    const bandHeight = Math.max(0.5, this.radius * 0.65);
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
    this.labelBand.renderingGroupId = 1;

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
      512,
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
    leftText.fontSize = 160;
    leftText.textWrapping = TextWrapping.Ellipsis;
    leftText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
    leftText.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;

    const rightText = new TextBlock("labelRight");
    rightText.width = "48%";
    rightText.height = "100%";
    rightText.left = "26%";
    rightText.color = this.textColor;
    rightText.fontSize = 160;
    rightText.textWrapping = TextWrapping.Ellipsis;
    rightText.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
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
    // Keep initial-style equator spin in world space even after world-root rotations.
    this.spinAngle += Concept.SPIN_SPEED;
    this.applyWorldUprightSpin();
  }

  public restoreInitialOrientationStyle(): void {
    this.sphere.computeWorldMatrix(true);
    const worldForward = this.sphere.getDirection(Vector3.Forward());
    worldForward.y = 0;
    if (worldForward.lengthSquared() < 1e-8) {
      worldForward.copyFromFloats(0, 0, 1);
    } else {
      worldForward.normalize();
    }

    // Keep only world yaw so label text remains upright like the initial state.
    const yaw = Math.atan2(worldForward.x, worldForward.z);
    this.spinAngle = yaw;
    this.applyWorldUprightSpin();
  }

  private applyWorldUprightSpin(): void {
    const desiredWorld = Quaternion.FromEulerAngles(0, this.spinAngle, 0);
    let local = desiredWorld;
    const parent: any = this.sphere.parent;
    if (parent && typeof parent.getWorldMatrix === "function") {
      const parentScale = Vector3.Zero();
      const parentRotation = Quaternion.Identity();
      const parentPos = Vector3.Zero();
      parent.getWorldMatrix().decompose(parentScale, parentRotation, parentPos);
      const invParent = parentRotation.clone();
      invParent.invertInPlace();
      local = invParent.multiply(desiredWorld);
    }
    this.sphere.rotationQuaternion = local.normalize();
  }

  public updateWeight(w: 1 | 2 | 3 | 4 | 5): void {
    this.weight = w;
    this.sphere.scaling.setAll(weightToScale(w));
  }

  public updateNotes(notes: string): void {
    this.notes = notes;
  }

  public setOverlayText(newText: string): void {
    const trimmed = newText.slice(0, 32);
    this.label = trimmed;
    this.updateLabelBandText();
  }

  public getOverlayText(): string {
    return this.label;
  }

  public setHasChildren(has: boolean): void {
    this.ensureLabelBand();
    if (has && !this.childBadge) {
      const badge = new TextBlock('childBadge_' + this.id);
      badge.text = '↗';
      badge.color = 'rgba(255,255,255,0.55)';
      badge.fontSize = 120;
      badge.textHorizontalAlignment = Control.HORIZONTAL_ALIGNMENT_RIGHT;
      badge.textVerticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
      badge.paddingRight = '24px';
      this.labelBandTexture!.addControl(badge);
      this.childBadge = badge;
    } else if (!has && this.childBadge) {
      this.labelBandTexture!.removeControl(this.childBadge);
      this.childBadge.dispose();
      this.childBadge = null;
    }
  }
}

export { Concept, ConceptOptions };
