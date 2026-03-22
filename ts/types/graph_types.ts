import { Color3 } from '@babylonjs/core/Maths/math';
import { Mode } from '../concepts/types';

// ─── Serialised data model (what goes to localStorage) ───────────────────────

export type RelationshipType = 'leads to' | 'part of' | 'requires' | 'enables';

export const RELATIONSHIP_COLORS: Record<RelationshipType, Color3> = {
  'leads to': new Color3(1.0, 0.82, 0.18),   // amber/gold
  'part of':  new Color3(0.35, 0.65, 1.0),   // blue
  'requires': new Color3(1.0, 0.42, 0.30),   // red-orange
  'enables':  new Color3(0.35, 0.90, 0.50),  // green
};

export interface ConnectionData {
  id: string;
  targetId: string;
  relationshipType: RelationshipType;
  label?: string;   // user-entered text shown on the arc (empty = no label shown)
}

export interface NodeData {
  id: string;
  label: string;
  notes: string;
  nodeType: Mode;                     // answer | question | note | plus | minus | link | reference
  weight: 1 | 2 | 3 | 4 | 5;        // controls sphere scale
  position: { x: number; y: number; z: number };
  outgoingConnections: ConnectionData[];
}

// Bump this when the serialised schema changes in a breaking way.
// deserialize() will discard saves with a different version rather than crashing.
export const CURRENT_SAVE_VERSION = 1;

export interface GraphState {
  version: number;
  appVersion: number | string;   // APP_VERSION at time of save — helps identify which deploy to recover with
  nodes: NodeData[];
}

// ─── Cluster mapping (7 types → 3 clusters, used for arc opacity) ────────────

export type NodeCluster = 'concept' | 'question' | 'reference';

export const CLUSTER_MAP: Record<Mode, NodeCluster> = {
  answer:    'concept',
  note:      'concept',
  plus:      'concept',
  minus:     'concept',
  question:  'question',
  link:      'reference',
  reference: 'reference',
};

export function isCrossCluster(typeA: Mode, typeB: Mode): boolean {
  return CLUSTER_MAP[typeA] !== CLUSTER_MAP[typeB];
}

// cross-cluster (bridges between clusters) → solid, full opacity (1.0)
// same-cluster  (lateral, associative)      → dimmed opacity (0.3)
export function arcAlpha(typeA: Mode, typeB: Mode): number {
  return isCrossCluster(typeA, typeB) ? 1.0 : 0.3;
}

// ─── Tool modes ───────────────────────────────────────────────────────────────

export type ToolMode = 'spin' | 'pan';

// ─── Keyboard shortcuts ───────────────────────────────────────────────────────

export const KEY_MAP: Record<string, Mode> = {
  a: 'answer',
  q: 'question',
  n: 'note',
  '+': 'plus',
  '-': 'minus',
  l: 'link',
  r: 'reference',
};
