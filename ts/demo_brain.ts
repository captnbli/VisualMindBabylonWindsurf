import { GraphState } from './types/graph_types';

/**
 * First-launch demo graph: a brainstorm about the product itself.
 * Shows all 7 node types, solid cross-cluster arcs, and dimmed same-cluster arcs.
 * Loaded only when localStorage has no saved state.
 */
export const DEMO_BRAIN: GraphState = {
  version: 1,
  nodes: [

    // ── Central thesis ────────────────────────────────────────────────────────
    {
      id:    'demo-01',
      label: '3D Thinking',
      notes: 'Ideas have shape. Spatial relationships between concepts matter as much as the concepts themselves.',
      nodeType: 'answer',
      weight: 5,
      position: { x: 0, y: 0, z: 0 },
      outgoingConnections: [
        { id: 'dc-01', targetId: 'demo-02', relationshipType: 'leads to'  },
        { id: 'dc-02', targetId: 'demo-03', relationshipType: 'leads to'  },
        { id: 'dc-03', targetId: 'demo-10', relationshipType: 'built with' },
      ],
    },

    // ── Questions ─────────────────────────────────────────────────────────────
    {
      id:    'demo-02',
      label: 'Why spatial?',
      notes: 'The memory palace technique is 2,500 years old. Spatial context makes abstract ideas stick.',
      nodeType: 'question',
      weight: 3,
      position: { x: 7, y: 4, z: -2 },
      outgoingConnections: [
        { id: 'dc-04', targetId: 'demo-04', relationshipType: 'leads to' },
        { id: 'dc-05', targetId: 'demo-05', relationshipType: 'leads to' },
      ],
    },
    {
      id:    'demo-03',
      label: 'Who needs it?',
      notes: 'Anyone building mental models under pressure: founders, researchers, writers, strategists.',
      nodeType: 'question',
      weight: 2,
      position: { x: -5, y: 5, z: 4 },
      outgoingConnections: [
        { id: 'dc-06', targetId: 'demo-07', relationshipType: 'leads to' },
      ],
    },

    // ── Observations (notes) ──────────────────────────────────────────────────
    {
      id:    'demo-04',
      label: 'Mem Palace',
      notes: 'The method of loci: ancient orators placed arguments in imagined rooms. VisualMind externalizes that room.',
      nodeType: 'note',
      weight: 3,
      position: { x: 10, y: 1, z: 6 },
      outgoingConnections: [],
    },

    // ── Advantages (plus) ─────────────────────────────────────────────────────
    {
      id:    'demo-05',
      label: 'Cluster arcs',
      notes: 'Cross-cluster connections render solid; same-cluster links recede. The visual hierarchy is automatic.',
      nodeType: 'plus',
      weight: 3,
      position: { x: 11, y: -2, z: 3 },
      outgoingConnections: [
        { id: 'dc-07', targetId: 'demo-06', relationshipType: 'contrasts' },
      ],
    },
    {
      id:    'demo-11',
      label: 'Zero install',
      notes: 'Runs in the browser. No app, no signup. Just open and think.',
      nodeType: 'plus',
      weight: 2,
      position: { x: 6, y: -6, z: 1 },
      outgoingConnections: [],
    },

    // ── Risks (minus) ─────────────────────────────────────────────────────────
    {
      id:    'demo-06',
      label: '3D nav learn',
      notes: 'Pan, rotate, fly-to — new users need a moment to orient. The demo brain helps.',
      nodeType: 'minus',
      weight: 2,
      position: { x: 14, y: 2, z: 1 },
      outgoingConnections: [],
    },

    // ── Users (answers) ───────────────────────────────────────────────────────
    {
      id:    'demo-07',
      label: 'Founders',
      notes: 'YC-style rapid hypothesis testing. Connect market signal to product decision to open question.',
      nodeType: 'answer',
      weight: 3,
      position: { x: -7, y: 7, z: 2 },
      outgoingConnections: [
        { id: 'dc-08', targetId: 'demo-01', relationshipType: 'requires' },
      ],
    },
    {
      id:    'demo-08',
      label: 'Researchers',
      notes: 'Literature review, hypothesis graphs, connecting findings across papers and domains.',
      nodeType: 'answer',
      weight: 2,
      position: { x: -9, y: 4, z: -2 },
      outgoingConnections: [
        { id: 'dc-09', targetId: 'demo-01', relationshipType: 'requires' },
      ],
    },

    // ── Prior art (references) ────────────────────────────────────────────────
    {
      id:    'demo-09',
      label: 'TheBrain',
      notes: 'The closest prior art. Fluid node navigation but 2D, desktop-only, and subscription-gated.',
      nodeType: 'reference',
      weight: 2,
      position: { x: -4, y: -3, z: -8 },
      outgoingConnections: [
        { id: 'dc-10', targetId: 'demo-01', relationshipType: 'leads to' },
      ],
    },

    // ── Technology (link) ─────────────────────────────────────────────────────
    {
      id:    'demo-10',
      label: 'BabylonJS',
      notes: 'WebGL2 engine. PBR materials, HighlightLayer, ArcRotateCamera, AdvancedDynamicTexture for labels.',
      nodeType: 'link',
      weight: 2,
      position: { x: 3, y: -7, z: -5 },
      outgoingConnections: [
        { id: 'dc-11', targetId: 'demo-05', relationshipType: 'enables' },
      ],
    },
  ],
};
