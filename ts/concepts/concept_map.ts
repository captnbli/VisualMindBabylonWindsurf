import { Scene } from "@babylonjs/core/scene";

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
  scene: Scene,
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
