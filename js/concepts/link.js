import { Concept } from './concept.js';
import { Types } from './types.js';

export default class Link extends Concept {
    constructor(scene) {s
        const options = {
            color: new BABYLON.Color3(0.5, 0.5, 0.5), // Convert hex color 0x808080 to RGB normalized
            label: Types.Link.label
        };
        super(scene, options);
    }
}
