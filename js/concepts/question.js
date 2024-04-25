import Concept from './Concept.js';
import { Types } from './Types.js';

export default class Question extends Concept {
    constructor(scene) {
        super(scene, Types.Question, 0x0000FF);
    }
}
