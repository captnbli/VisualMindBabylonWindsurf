import { Concept } from './concept';

export default class Note extends Concept {
  constructor(scene, options = {}) {
    options.color = new BABYLON.Color3(0.647, 0.165, 0.165); // Brownish
    options.label = 'N';
    super(scene, options);
  }
}
