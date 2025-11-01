import { Concept, ConceptOptions } from './concept';
import { Color3 } from "@babylonjs/core/Maths/math";
import { Scene } from "@babylonjs/core/scene";

export default class Plus extends Concept {
  constructor(scene: Scene, options: ConceptOptions = {}) {
    options.color = new Color3(0, 0.5, 0); // Green, normalised
    options.label = 'P'; // Or use Types.Plus if you want
    super(scene, options);
  }
}
