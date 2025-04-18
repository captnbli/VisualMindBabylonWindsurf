import { Concept, ConceptOptions } from './concept';
import { Color3, Scene } from "babylonjs";

export default class Minus extends Concept {
  constructor(scene: Scene, options: ConceptOptions = {}) {
    options.color = new Color3(1, 0, 0); // Red
    options.label = 'M';
    super(scene, options);
  }
}
