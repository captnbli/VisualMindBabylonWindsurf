import { Concept, ConceptOptions } from './concept';
import { Color3 } from "../../../Babylon.js/packages/dev/core/dist/Maths/math";
import { Scene } from "../../../Babylon.js/packages/dev/core/dist/scene";

export default class Plus extends Concept {
  constructor(scene: Scene, options: ConceptOptions = {}) {
    options.color = new Color3(0, 0.5, 0); // Green, normalised
    options.label = 'P'; // Or use Types.Plus if you want
    super(scene, options);
  }
}
