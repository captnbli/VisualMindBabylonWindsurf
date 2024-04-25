import Concept from './Concept.js';
import { Types } from './Types.js';

export default class Link extends Concept {
    constructor(scene) {
        super(scene, Types.Link, 0x808080);
    }
}
