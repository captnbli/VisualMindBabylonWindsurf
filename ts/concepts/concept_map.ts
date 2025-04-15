import * as BABYLON from 'babylonjs';

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
) => unknown;

export const ConceptMap: Record<Mode, ConceptConstructor> = {
  [Types.Answer]: Answer,
  [Types.Question]: Question,
  [Types.Note]: Note,
  [Types.Plus]: Plus,
  [Types.Minus]: Minus,
  [Types.Link]: Link,
  [Types.Reference]: Reference
};
