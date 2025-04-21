import { Concept, ConceptOptions } from './concept';
import { Color3 } from "../../../Babylon.js/packages/dev/core/dist/Maths/math";
import { Scene } from "../../../Babylon.js/packages/dev/core/dist/scene";

export default class Note extends Concept {
  constructor(scene: Scene, options: ConceptOptions = {}) {
    options.color = new Color3(0.647, 0.165, 0.165); // Brownish
    options.label = 'N';
    super(scene, options);
  }
}
