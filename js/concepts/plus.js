import Concept from './Concept.js';
import { Types } from './Types.js';

export default class Plus extends Concept {
    constructor(scene) {
        super(scene, Types.Plus, 0x008000);
    }
}
