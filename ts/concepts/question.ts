import { Concept, ConceptOptions } from './concept';
import { Color3 } from "@babylonjs/core/Maths/math";
import { Scene } from "@babylonjs/core/scene";

class Question extends Concept {
  constructor(scene: Scene, options: ConceptOptions = {}) {
    options.color = new Color3(0, 0, 1); // Set color to blue
    options.label = 'Q'; // Set label to 'Q'
    super(scene, options); // Call the superclass constructor with modified options
  }
}

export default Question;
