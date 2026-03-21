/**
 * GraphManager unit tests.
 *
 * BabylonJS is mocked out entirely so tests run in Node without WebGL.
 * The mocks are minimal stubs — just enough for GraphManager to exercise
 * its logic without touching the GPU.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Hoisted stubs (must run before vi.mock factories) ────────────────────────

const { StubConcept, StubConnector, makePosition } = vi.hoisted(() => {
  function makePosition(x = 0, y = 0, z = 0) {
    return {
      x, y, z,
      clone()                                          { return makePosition(this.x, this.y, this.z); },
      set(nx: number, ny: number, nz: number)          { this.x = nx; this.y = ny; this.z = nz; },
    };
  }

  class StubConcept {
    id:       string;
    label:    string;
    notes:    string;
    weight:   1 | 2 | 3 | 4 | 5;
    nodeType: any;
    sphere: {
      position:             ReturnType<typeof makePosition>;
      metadata:             Record<string, any>;
      parent:               any;
      renderingGroupId:     number;
      scaling:              { setAll: (v: number) => void };
      refreshBoundingInfo:  () => void;
      dispose:              (..._: any[]) => void;
      getBoundingInfo:      () => { boundingSphere: { radius: number } };
    };

    constructor(_scene: any, opts: any = {}) {
      this.id       = opts.id    ?? ('stub-' + Math.random().toString(36).slice(2));
      this.label    = opts.label ?? '';
      this.notes    = opts.notes ?? '';
      this.weight   = opts.weight   ?? 3;
      this.nodeType = opts.nodeType ?? null;
      const pos     = opts.position ?? { x: 0, y: 0, z: 0 };
      this.sphere   = {
        position:             makePosition(pos.x, pos.y, pos.z),
        metadata:             {},
        parent:               null,
        renderingGroupId:     1,
        scaling:              { setAll: () => {} },
        refreshBoundingInfo:  () => {},
        dispose:              () => {},
        getBoundingInfo:      () => ({ boundingSphere: { radius: 1 } }),
      };
    }

    setOverlayText(text: string)   { this.label = text.slice(0, 12); }
    updateNotes(n: string)         { this.notes = n; }
    updateWeight(w: any)           { this.weight = w; }
    restoreInitialOrientationStyle() {}
    update() {}
  }

  class StubConnector {
    id:           string;
    connector:    { metadata: Record<string, any>; parent: any; alpha: number };
    private startSphere: any;
    private endSphere:   any;
    private laneIdx:     number;

    constructor(_scene: any, opts: any = {}) {
      this.id          = opts.id ?? ('conn-' + Math.random().toString(36).slice(2));
      this.startSphere = opts.startSphere ?? null;
      this.endSphere   = opts.endSphere   ?? null;
      this.laneIdx     = opts.laneIndex   ?? 0;
      this.connector   = { metadata: {}, parent: null, alpha: opts.alpha ?? 1 };
    }

    connectsPair(a: any, b: any): boolean {
      return (this.startSphere === a && this.endSphere === b)
          || (this.startSphere === b && this.endSphere === a);
    }
    getLaneIndex()          { return this.laneIdx; }
    setLaneIndex(i: number) { this.laneIdx = i; }
    setAlpha(a: number)     { this.connector.alpha = a; }
    dispose()               {}
  }

  return { StubConcept, StubConnector, makePosition };
});

// ─── Mock BabylonJS Vector3 ───────────────────────────────────────────────────

vi.mock('@babylonjs/core/Maths/math', () => {
  class Vector3 {
    x: number; y: number; z: number;
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    clone() { return new Vector3(this.x, this.y, this.z); }
    static Zero() { return new Vector3(0, 0, 0); }
    static Distance(a: any, b: any) {
      return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
    }
  }
  return { Vector3 };
});

// ─── Mock ConceptMap & Connector ──────────────────────────────────────────────

vi.mock('../ts/concepts/concept_map', () => ({
  ConceptMap: {
    answer:    StubConcept,
    question:  StubConcept,
    note:      StubConcept,
    plus:      StubConcept,
    minus:     StubConcept,
    link:      StubConcept,
    reference: StubConcept,
  },
}));

vi.mock('../ts/concepts/connector', () => ({
  default: StubConnector,
}));

// ─── Import under test (after mocks are registered) ──────────────────────────

import { GraphManager } from '../ts/graph_manager';
import { Vector3 }      from '@babylonjs/core/Maths/math';
import { GraphState }   from '../ts/types/graph_types';
import { bus }          from '../ts/events';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeManager(): GraphManager {
  const gm = new GraphManager();
  gm.init({
    scene:     null as any,
    worldRoot: { position: makePosition(), rotationQuaternion: null } as any,
    camera:    null as any,
    engine:    null as any,
  });
  return gm;
}

function addNode(gm: GraphManager, overrides: Partial<{
  nodeType: any; label: string; notes: string; weight: any; id: string;
  x: number; y: number; z: number;
}> = {}): string {
  return gm.createNode({
    nodeType: overrides.nodeType ?? 'answer',
    position: new Vector3(overrides.x ?? 0, overrides.y ?? 0, overrides.z ?? 0),
    label:    overrides.label  ?? 'Test',
    notes:    overrides.notes  ?? '',
    weight:   overrides.weight ?? 3,
    id:       overrides.id,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GraphManager — node CRUD', () => {
  let gm: GraphManager;
  beforeEach(() => { gm = makeManager(); });

  it('createNode returns a string id', () => {
    const id = addNode(gm);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('getNode returns the created entry', () => {
    const id = addNode(gm, { label: 'Hello' });
    const entry = gm.getNode(id);
    expect(entry).toBeDefined();
    expect(entry!.concept.label).toBe('Hello');
  });

  it('createNode with explicit id uses that id', () => {
    const id = addNode(gm, { id: 'fixed-id-42' });
    expect(id).toBe('fixed-id-42');
    expect(gm.getNode('fixed-id-42')).toBeDefined();
  });

  it('getNodeData reflects node fields', () => {
    const id = addNode(gm, { label: 'World', notes: 'Some notes', weight: 4, nodeType: 'question', x: 1, y: 2, z: 3 });
    const data = gm.getNodeData(id)!;
    expect(data.label).toBe('World');
    expect(data.notes).toBe('Some notes');
    expect(data.weight).toBe(4);
    expect(data.nodeType).toBe('question');
    expect(data.position).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('deleteNode removes the node', () => {
    const id = addNode(gm);
    gm.deleteNode(id);
    expect(gm.getNode(id)).toBeUndefined();
  });

  it('deleteNode on unknown id is a no-op', () => {
    expect(() => gm.deleteNode('nonexistent')).not.toThrow();
  });

  it('updateNodeLabel reflects in getNodeData', () => {
    const id = addNode(gm, { label: 'Old' });
    gm.updateNodeLabel(id, 'New');
    expect(gm.getNodeData(id)!.label).toBe('New');
  });

  it('updateNodeNotes reflects in getNodeData', () => {
    const id = addNode(gm, { notes: 'old notes' });
    gm.updateNodeNotes(id, 'updated');
    expect(gm.getNodeData(id)!.notes).toBe('updated');
  });

  it('updateNodeWeight reflects in getNodeData', () => {
    const id = addNode(gm, { weight: 1 });
    gm.updateNodeWeight(id, 5);
    expect(gm.getNodeData(id)!.weight).toBe(5);
  });

  it('moveNode updates sphere position', () => {
    const id = addNode(gm, { x: 0, y: 0, z: 0 });
    gm.moveNode(id, 10, 20, 30);
    const data = gm.getNodeData(id)!;
    expect(data.position).toEqual({ x: 10, y: 20, z: 30 });
  });
});

describe('GraphManager — connector CRUD', () => {
  let gm: GraphManager;
  let srcId: string;
  let tgtId: string;
  beforeEach(() => {
    gm    = makeManager();
    srcId = addNode(gm, { id: 'src', nodeType: 'answer'   });
    tgtId = addNode(gm, { id: 'tgt', nodeType: 'question' });
  });

  it('createConnector returns a string id', () => {
    const cid = gm.createConnector({ sourceId: srcId, targetId: tgtId });
    expect(typeof cid).toBe('string');
  });

  it('createConnector with explicit id uses that id', () => {
    const cid = gm.createConnector({ sourceId: srcId, targetId: tgtId, id: 'c-fixed' });
    expect(cid).toBe('c-fixed');
  });

  it('self-loop is rejected', () => {
    expect(gm.createConnector({ sourceId: srcId, targetId: srcId })).toBeNull();
  });

  it('unknown source or target is rejected', () => {
    expect(gm.createConnector({ sourceId: 'x', targetId: tgtId })).toBeNull();
    expect(gm.createConnector({ sourceId: srcId, targetId: 'y' })).toBeNull();
  });

  it('connection appears in outgoing connections', () => {
    const cid = gm.createConnector({ sourceId: srcId, targetId: tgtId, relationshipType: 'requires' })!;
    const conns = gm.getOutgoingConnections(srcId);
    expect(conns).toHaveLength(1);
    expect(conns[0].id).toBe(cid);
    expect(conns[0].targetId).toBe(tgtId);
    expect(conns[0].relationshipType).toBe('requires');
  });

  it('deleteConnector removes it from outgoing connections', () => {
    const cid = gm.createConnector({ sourceId: srcId, targetId: tgtId })!;
    gm.deleteConnector(cid);
    expect(gm.getOutgoingConnections(srcId)).toHaveLength(0);
  });

  it('deleteConnector on unknown id is a no-op', () => {
    expect(() => gm.deleteConnector('ghost')).not.toThrow();
  });
});

describe('GraphManager — cascade delete', () => {
  let gm: GraphManager;
  beforeEach(() => { gm = makeManager(); });

  it('deleting a node removes its outgoing connectors', () => {
    const a = addNode(gm, { id: 'a' });
    const b = addNode(gm, { id: 'b' });
    const c = addNode(gm, { id: 'c' });
    gm.createConnector({ sourceId: a, targetId: b });
    gm.createConnector({ sourceId: a, targetId: c });

    gm.deleteNode(a);
    expect(gm.getOutgoingConnections(b)).toHaveLength(0);
  });

  it('deleting a node removes incoming connectors', () => {
    const a = addNode(gm, { id: 'a' });
    const b = addNode(gm, { id: 'b' });
    gm.createConnector({ sourceId: a, targetId: b });

    gm.deleteNode(b);  // delete the target
    expect(gm.getOutgoingConnections(a)).toHaveLength(0);
  });

  it('nodeDeleted event carries cascaded connection ids', () => {
    const events: any[] = [];
    bus.on('nodeDeleted', (e: any) => events.push(e));

    const a   = addNode(gm, { id: 'a' });
    const b   = addNode(gm, { id: 'b' });
    const cid = gm.createConnector({ sourceId: a, targetId: b })!;

    gm.deleteNode(a);
    expect(events[0].nodeId).toBe('a');
    expect(events[0].cascadedConnectionIds).toContain(cid);

    bus.removeAllListeners('nodeDeleted');
  });
});

describe('GraphManager — lane management', () => {
  let gm: GraphManager;
  let a: string;
  let b: string;
  beforeEach(() => {
    gm = makeManager();
    a  = addNode(gm, { id: 'a' });
    b  = addNode(gm, { id: 'b' });
  });

  it('first connector between a pair gets lane 0', () => {
    const cid = gm.createConnector({ sourceId: a, targetId: b })!;
    const entry = (gm as any).connectorMap.get(cid);
    expect(entry.connector.getLaneIndex()).toBe(0);
  });

  it('second connector between same pair gets lane 1', () => {
    gm.createConnector({ sourceId: a, targetId: b });
    const cid2 = gm.createConnector({ sourceId: a, targetId: b })!;
    const entry = (gm as any).connectorMap.get(cid2);
    expect(entry.connector.getLaneIndex()).toBe(1);
  });

  it('after deleting lane-0 connector, remaining connector recompacts to lane 0', () => {
    const c0 = gm.createConnector({ sourceId: a, targetId: b })!;
    const c1 = gm.createConnector({ sourceId: a, targetId: b })!;

    gm.deleteConnector(c0);
    const entry = (gm as any).connectorMap.get(c1);
    expect(entry.connector.getLaneIndex()).toBe(0);
  });
});

describe('GraphManager — serialization round-trip', () => {
  it('empty graph serializes to version 1 with empty nodes', () => {
    const gm = makeManager();
    const state = gm.serialize();
    expect(state.version).toBe(1);
    expect(state.nodes).toEqual([]);
  });

  it('single node round-trip preserves all fields', () => {
    const gm = makeManager();
    addNode(gm, { id: 'n1', label: 'Idea', notes: 'detail', weight: 4, nodeType: 'question', x: 5, y: -2, z: 3 });

    const state = gm.serialize();
    expect(state.nodes).toHaveLength(1);
    const n = state.nodes[0];
    expect(n.id      ).toBe('n1');
    expect(n.label   ).toBe('Idea');
    expect(n.notes   ).toBe('detail');
    expect(n.weight  ).toBe(4);
    expect(n.nodeType).toBe('question');
    expect(n.position).toEqual({ x: 5, y: -2, z: 3 });
  });

  it('connections survive serialization', () => {
    const gm = makeManager();
    addNode(gm, { id: 's' });
    addNode(gm, { id: 't' });
    gm.createConnector({ sourceId: 's', targetId: 't', relationshipType: 'enables', id: 'conn-1' });

    const state = gm.serialize();
    const src = state.nodes.find(n => n.id === 's')!;
    expect(src.outgoingConnections).toHaveLength(1);
    expect(src.outgoingConnections[0].id             ).toBe('conn-1');
    expect(src.outgoingConnections[0].targetId       ).toBe('t');
    expect(src.outgoingConnections[0].relationshipType).toBe('enables');
  });

  it('deserialize rebuilds nodes and connections', () => {
    const state: GraphState = {
      version: 1,
      nodes: [
        {
          id: 'a', label: 'Alpha', notes: '', nodeType: 'answer',
          weight: 3, position: { x: 1, y: 0, z: 0 },
          outgoingConnections: [{ id: 'c1', targetId: 'b', relationshipType: 'leads to' }],
        },
        {
          id: 'b', label: 'Beta', notes: '', nodeType: 'note',
          weight: 2, position: { x: -1, y: 0, z: 0 },
          outgoingConnections: [],
        },
      ],
    };

    const gm = makeManager();
    gm.deserialize(state);

    expect(gm.getNode('a')).toBeDefined();
    expect(gm.getNode('b')).toBeDefined();
    expect(gm.getOutgoingConnections('a')).toHaveLength(1);
    expect(gm.getOutgoingConnections('a')[0].targetId).toBe('b');
    expect(gm.getNodeData('a')!.label   ).toBe('Alpha');
    expect(gm.getNodeData('b')!.nodeType).toBe('note');
  });

  it('serialize → deserialize → serialize produces identical state', () => {
    const gm1 = makeManager();
    addNode(gm1, { id: 'x', label: 'X', nodeType: 'plus',  weight: 2, x:  3, y: 0, z: 1 });
    addNode(gm1, { id: 'y', label: 'Y', nodeType: 'link',  weight: 1, x: -2, y: 4, z: 0 });
    addNode(gm1, { id: 'z', label: 'Z', nodeType: 'minus', weight: 5, x:  0, y: 0, z: 5 });
    gm1.createConnector({ sourceId: 'x', targetId: 'y', relationshipType: 'part of',  id: 'cx' });
    gm1.createConnector({ sourceId: 'y', targetId: 'z', relationshipType: 'requires', id: 'cy' });

    const state1 = gm1.serialize();

    const gm2 = makeManager();
    gm2.deserialize(state1);
    const state2 = gm2.serialize();

    expect(state2.nodes).toHaveLength(state1.nodes.length);
    for (const n1 of state1.nodes) {
      const n2 = state2.nodes.find(n => n.id === n1.id)!;
      expect(n2).toBeDefined();
      expect(n2.label   ).toBe(n1.label);
      expect(n2.nodeType).toBe(n1.nodeType);
      expect(n2.weight  ).toBe(n1.weight);
      expect(n2.position).toEqual(n1.position);
      expect(n2.outgoingConnections).toHaveLength(n1.outgoingConnections.length);
    }
  });

  it('deserialize clears existing graph before loading', () => {
    const gm = makeManager();
    addNode(gm, { id: 'old' });

    const fresh: GraphState = {
      version: 1,
      nodes: [{
        id: 'new1', label: 'New', notes: '', nodeType: 'answer',
        weight: 3, position: { x: 0, y: 0, z: 0 }, outgoingConnections: [],
      }],
    };
    gm.deserialize(fresh);

    expect(gm.getNode('old') ).toBeUndefined();
    expect(gm.getNode('new1')).toBeDefined();
    expect(gm.serialize().nodes).toHaveLength(1);
  });

  it('clearAll leaves an empty graph', () => {
    const gm = makeManager();
    addNode(gm, { id: 'p' });
    addNode(gm, { id: 'q' });
    gm.createConnector({ sourceId: 'p', targetId: 'q' });

    gm.clearAll();
    expect(gm.serialize().nodes).toHaveLength(0);
  });
});
