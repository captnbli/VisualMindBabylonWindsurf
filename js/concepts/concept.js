import * as BABYLON from 'babylonjs';
import 'babylonjs-loaders'; // Only necessary if loading specific assets
import { AdvancedDynamicTexture, TextBlock, Rectangle } from 'babylonjs-gui';

class Concept {
  constructor(scene, options) {
    this.scene = scene;
    this.color = options.color || BABYLON.Color3.Red();
    this.label = options.label || '';
    this.labelCount = 2;
    this.radius = options.radius || 1;
    this.position = new BABYLON.Vector3(options.position.x, options.position.y, options.position.z);
    this.camera = options.camera;
    this.engine = options.engine; // Assuming engine is passed instead of renderer

    // Create sphere geometry and material
    this.sphere = BABYLON.MeshBuilder.CreateSphere("sphere", {diameter: this.radius * 2, segments: 64}, this.scene);
    this.sphere.material = new BABYLON.StandardMaterial("sphereMat", this.scene);
    this.sphere.material.diffuseColor = this.color;
    this.sphere.position = this.position;

    // Add labels to the sphere
    this.addLabels();

    // Create a text box
    this.createTextBox();
  }

  addLabels() {
    const textureSize = 1024;
    const texture = new AdvancedDynamicTexture("LabelTexture", textureSize, textureSize, this.scene);
    const text = new TextBlock();
    text.text = this.label;
    text.color = "white";
    text.fontSize = 200; // Adjust size based on the size of the sphere
    texture.addControl(text);

    for (let i = 0; i < this.labelCount; i++) {
      const angle = (i / this.labelCount) * Math.PI * 2;
      const x = Math.cos(angle) * (this.radius + 0.1);
      const z = Math.sin(angle) * (this.radius + 0.1);

      const labelPlane = BABYLON.MeshBuilder.CreatePlane("labelPlane", { size: this.radius }, this.scene);
      labelPlane.position.set(x, 0, z);
      labelPlane.lookAt(this.scene.activeCamera.position);
      labelPlane.material = new BABYLON.StandardMaterial("labelMat", this.scene);
      labelPlane.material.diffuseTexture = texture;
      labelPlane.material.useAlphaFromDiffuseTexture = true;
      this.sphere.addChild(labelPlane);
    }
  }

  createTextBox() {
    // GUI for text box
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

    // Position adjustment will need to account for Babylon.js GUI layout specifics
  }

  updateTextBoxPosition() {
    // Similar logic, adapted for Babylon.js's camera and viewport handling
  }

  update() {
    // Rotate the sphere for a dynamic effect
    this.sphere.rotation.y += 0.01;

    // Update text box position
    this.updateTextBoxPosition();
  }
}

export { Concept };
