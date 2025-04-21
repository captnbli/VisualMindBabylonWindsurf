import { Concept, ConceptOptions } from './concept';
import { Color3 } from "../../../Babylon.js/packages/dev/core/dist/Maths/math";
import { Scene } from "../../../Babylon.js/packages/dev/core/dist/scene";

export default class Reference extends Concept {
  constructor(scene: Scene, options: ConceptOptions = {}) {
    options.color = new Color3(0.2, 0.2, 0.7); // Muted blue, adjust as needed
    options.label = 'R';
    super(scene, options);
  }
}
