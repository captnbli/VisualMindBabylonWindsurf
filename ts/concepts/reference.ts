import { Concept, ConceptOptions } from './concept';

export default class Reference extends Concept {
  constructor(scene: BABYLON.Scene, options: ConceptOptions = {}) {
    options.color = new BABYLON.Color3(0.2, 0.2, 0.7); // Muted blue, adjust as needed
    options.label = 'R';
    super(scene, options);
  }
}
