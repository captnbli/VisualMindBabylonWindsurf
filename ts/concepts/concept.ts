import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders';
import { AdvancedDynamicTexture, TextBlock, Rectangle } from 'babylonjs-gui';

interface ConceptOptions {
  color?: BABYLON.Color3;
  label?: string;
  radius?: number;
  position?: { x: number; y: number; z: number };
  camera?: BABYLON.Camera;
  engine?: BABYLON.Engine;
}

class Concept {
  scene: BABYLON.Scene;
  camera?: BABYLON.Camera;
  engine?: BABYLON.Engine;
  color: BABYLON.Color3;
  label: string;
  radius: number;
  position: BABYLON.Vector3;
  labelCount: number = 2;
  sphere: BABYLON.Mesh;
  textBox: TextBlock;
  labelPlanes: BABYLON.Mesh[] = [];

  constructor(scene: BABYLON.Scene, options: ConceptOptions = {}) {
    this.scene = scene;
    this.color = options.color || BABYLON.Color3.Red();
    this.label = options.label || '';
    this.radius = options.radius ?? 1;
    const pos = options.position || { x: 0, y: 0, z: 0 };
    this.position = new BABYLON.Vector3(pos.x, pos.y, pos.z);
    this.camera = options.camera;
    this.engine = options.engine;

    // Create sphere
    this.sphere = BABYLON.MeshBuilder.CreateSphere("sphere", {
      diameter: this.radius * 2,
      segments: 64
    }, this.scene);
    this.sphere.material = new BABYLON.StandardMaterial("sphereMat", this.scene);
    this.sphere.material.diffuseColor = this.color;
    this.sphere.position = this.position;

    // Add label planes and GUI
    this.addLabels();
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

      const labelPlane = BABYLON.MeshBuilder.CreatePlane("labelPlane", { size: this.radius }, this.scene);
      labelPlane.position.set(x, 0, z);
      labelPlane.material = new BABYLON.StandardMaterial("labelMat", this.scene);
      labelPlane.material.diffuseTexture = texture;
      labelPlane.material.useAlphaFromDiffuseTexture = true;

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
    this.sphere.rotation.y += 0.01;

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
