import { Concept } from './concept';
import { Types } from './types';

export default class Plus extends Concept {
  constructor(scene, options = {}) {
    options.color = new BABYLON.Color3(0, 0.5, 0); // Green, normalised
    options.label = 'P'; // Or use Types.Plus if you want
    super(scene, options);
  }
}
