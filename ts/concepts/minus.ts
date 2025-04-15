import { Concept } from './concept';

export default class Minus extends Concept {
  constructor(scene, options = {}) {
    options.color = new BABYLON.Color3(1, 0, 0); // Red
    options.label = 'M';
    super(scene, options);
  }
}
