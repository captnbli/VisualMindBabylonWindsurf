import { Concept } from './concept.js';

export default class Note extends Concept {
    constructor(scene) {
        const options = {
            color: new BABYLON.Color3(0.647, 0.165, 0.165), // Convert hex color #A52A2A to RGB normalized
            label: 'N', // Assumed label for Note
            // Include other default options as needed
        };
        super(scene, options);
    }
}
