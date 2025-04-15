import { Concept } from './concept.js';

class Answer extends Concept {
  constructor(scene, options = {}) {
    options.color = new BABYLON.Color3(1, 0.84, 0); // Set color to gold
    options.label = 'A'; // Set label to 'A'
    super(scene, options); // Call the superclass constructor with modified options
  }
}

export default Answer;
