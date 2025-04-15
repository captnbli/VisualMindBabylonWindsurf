import { Concept } from './concept';
import { Types } from './types';

export default class Link extends Concept {
  constructor(scene, options = {}) {
    options.color = new BABYLON.Color3(0.5, 0.5, 0.5); // Grey
    options.label = 'L'; // Or just: Types.Link, if you want consistency
    super(scene, options);
  }
}
