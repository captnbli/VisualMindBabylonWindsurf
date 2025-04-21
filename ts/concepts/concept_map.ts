import { Engine } from "../../../Babylon.js/packages/dev/core/dist/Engines/engine";
import { Scene } from "../../../Babylon.js/packages/dev/core/dist/scene";
import { Color3, Vector3 } from "../../../Babylon.js/packages/dev/core/dist/Maths/math";
import { Camera } from "../../../Babylon.js/packages/dev/core/dist/Cameras/camera";
import { Mesh } from "../../../Babylon.js/packages/dev/core/dist/Meshes/mesh";

import type { Concept } from './concept';
import Answer from './answer';
import Question from './question';
import Note from './note';
import Plus from './plus';
import Minus from './minus';
import Link from './link';
import Reference from './reference';

import { Mode, Types } from './types';
type ConceptConstructor = new (
  scene: BABYLON.Scene,
  options?: Record<string, any>
) => Concept;

export const ConceptMap: Record<Mode, ConceptConstructor> = {
  [Types.Answer]: Answer,
  [Types.Question]: Question,
  [Types.Note]: Note,
  [Types.Plus]: Plus,
  [Types.Minus]: Minus,
  [Types.Link]: Link,
  [Types.Reference]: Reference
};
