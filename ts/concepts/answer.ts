import { Concept, ConceptOptions } from './concept';
import * as BABYLON from 'babylonjs';

export default class Answer extends Concept {
  constructor(scene: BABYLON.Scene, options: ConceptOptions = {}) {
    options.color = new BABYLON.Color3(1, 0.84, 0); // Gold
    options.label = 'A';
    super(scene, options);
  }
}
