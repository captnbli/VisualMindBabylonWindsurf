import { Concept } from './concept';

class Question extends Concept {
  constructor(scene, options = {}) {
    options.color = new BABYLON.Color3(0, 0, 1); // Set color to blue
    options.label = 'Q'; // Set label to 'Q'
    super(scene, options); // Call the superclass constructor with modified options
  }
}

export default Question;
