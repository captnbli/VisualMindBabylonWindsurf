import { Concept } from './concept.js';

export default class Minus extends Concept {
    constructor(scene) {
        const options = {
            color: new BABYLON.Color3(1, 0, 0), // Red, normalized RGB
            label: 'M', // Assumed label for minus
            // Include other default options as needed
        };
        super(scene, options);
    }
}
