import Concept from './Concept.js';
import { Types } from './Types.js';

export default class Minus extends Concept {
    constructor(scene) {
        super(scene, Types.Minus, 0xFF0000);
    }
}
