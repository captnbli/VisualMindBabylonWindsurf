import EventEmitter from 'eventemitter3';
import { Mode } from './concepts/types';
import { RelationshipType, ToolMode } from './types/graph_types';

// ─── Event payload types ──────────────────────────────────────────────────────

export interface AppEvents {
  // Graph mutations
  nodeCreated:        { nodeId: string };
  nodeDeleted:        { nodeId: string; cascadedConnectionIds: string[] };
  nodeUpdated:        { nodeId: string; field: 'label' | 'notes' | 'weight' | 'nodeType' };
  connectionCreated:  { connectionId: string; sourceId: string; targetId: string };
  connectionDeleted:  { connectionId: string; sourceId: string };

  // Selection
  selectionChanged:   { nodeId: string | null };

  // Camera
  flyToNode:          { nodeId: string };
  panMove:            { deltaX: number; deltaY: number };
  panEnd:             { vx: number; vy: number };   // pixel/frame velocity
  rotateMove:         { deltaX: number; deltaY: number };
  rotateEnd:          {};
  zoom:               { factor: number };

  // Input semantic events
  nodePointerDown:    { nodeId: string };
  emptyPointerDown:   { worldX: number; worldY: number; worldZ: number };
  nodeDragMove:       { nodeId: string; localX: number; localY: number; localZ: number };
  nodeDragEnd:        { nodeId: string };
  createNodeRequest:  { localX: number; localY: number; localZ: number };
  connectRequest:     { sourceId: string; targetId: string; relationshipType: RelationshipType };
  deleteRequest:      {};

  // Tool
  toolModeChanged:    { mode: ToolMode };
  nodeTypeChanged:    { nodeType: Mode };   // current brush type changed
}

// ─── Typed bus ────────────────────────────────────────────────────────────────

class AppEventBus extends EventEmitter<AppEvents> {}

export const bus = new AppEventBus();
