import { Concept, ConceptOptions } from './concept';
import { Color3, Scene } from "babylonjs";

export default class Link extends Concept {
  constructor(scene: Scene, options: ConceptOptions = {}) {
    options.color = new Color3(0.5, 0.5, 0.5); // Grey
    options.label = 'L';
    super(scene, options);
  }
}
