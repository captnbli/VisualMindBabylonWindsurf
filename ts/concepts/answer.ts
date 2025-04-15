import { Concept } from './concept';
import * as BABYLON from 'babylonjs';

export default class Answer extends Concept {
  constructor(scene: BABYLON.Scene, options: Partial<BABYLON.IShadowLight> = {}) {
    options.color = new BABYLON.Color3(1, 0.84, 0); // Gold
    options.label = 'A';
    super(scene, options);
  }
}
