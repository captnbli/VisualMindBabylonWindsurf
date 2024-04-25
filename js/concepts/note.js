import Concept from './Concept.js';
import { Types } from './Types.js';

export default class Note extends Concept {
    constructor(scene) {
        super(scene, Types.Note, 0xA52A2A);
    }
}
