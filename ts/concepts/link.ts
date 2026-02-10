import { Concept, ConceptOptions } from './concept';
import { Color3 } from "@babylonjs/core/Maths/math";
import { Scene } from "@babylonjs/core/scene";

export default class Link extends Concept {
  constructor(scene: Scene, options: ConceptOptions = {}) {
    options.color = new Color3(0.5, 0.5, 0.5); // Grey
    options.textColor = "#111111";
    options.label = '';
    super(scene, options);
  }
}
