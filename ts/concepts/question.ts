import { Concept, ConceptOptions } from './concept';
import { Color3 } from "../../../Babylon.js/packages/dev/core/dist/Maths/math";
import { Scene } from "../../../Babylon.js/packages/dev/core/dist/scene";

class Question extends Concept {
  constructor(scene: Scene, options: ConceptOptions = {}) {
    options.color = new Color3(0, 0, 1); // Set color to blue
    options.label = 'Q'; // Set label to 'Q'
    super(scene, options); // Call the superclass constructor with modified options
  }
}

export default Question;
