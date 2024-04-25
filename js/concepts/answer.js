import Concept from './concept.js';
import { Types } from './types.js';  // Ensure the path is correct

export default class Answer extends Concept {
    constructor(scene) {
        super(scene, Types.Answer, 0xFFD700);
        // Modify default properties specific to Answer
    }
}
