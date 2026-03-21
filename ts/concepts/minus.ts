import { Concept, ConceptOptions } from './concept';
import { Color3 } from "@babylonjs/core/Maths/math";
import { Scene } from "@babylonjs/core/scene";

export default class Minus extends Concept {
  constructor(scene: Scene, options: ConceptOptions = {}) {
    options.color = new Color3(1, 0, 0); // Red
    options.textColor = "#ffffff";
    super(scene, options);
  }
}
