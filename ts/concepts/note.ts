import { Concept, ConceptOptions } from './concept';

export default class Note extends Concept {
  constructor(scene: BABYLON.Scene, options: ConceptOptions = {}) {
    options.color = new BABYLON.Color3(0.647, 0.165, 0.165); // Brownish
    options.label = 'N';
    super(scene, options);
  }
}
