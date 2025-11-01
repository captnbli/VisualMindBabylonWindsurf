import { Concept, ConceptOptions } from './concept';
import { Color3 } from "@babylonjs/core/Maths/math";
import { Scene } from "@babylonjs/core/scene";

export default class Answer extends Concept {
  constructor(scene: Scene, options: ConceptOptions = {}) {
    options.color = new Color3(1, 0.84, 0); // Gold
    options.label = 'A';
    super(scene, options);
  }
}
