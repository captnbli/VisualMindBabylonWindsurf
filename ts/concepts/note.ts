import { Concept, ConceptOptions } from './concept';
import { Color3 } from "@babylonjs/core/Maths/math";
import { Scene } from "@babylonjs/core/scene";

export default class Note extends Concept {
  constructor(scene: Scene, options: ConceptOptions = {}) {
    options.color = new Color3(0.647, 0.165, 0.165); // Brownish
    options.textColor = "#ffffff";
    super(scene, options);
  }
}
