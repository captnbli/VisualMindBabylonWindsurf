import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { Engine } from "@babylonjs/core/Engines/engine";

import { Concept } from './concepts/concept';
import { ConceptMap } from './concepts/concept_map';
import Connector from './concepts/connector';
import { Mode } from './concepts/types';
import {
  NodeData, ConnectionData, GraphState, RelationshipType,
  arcAlpha, CLUSTER_MAP, CURRENT_SAVE_VERSION, RELATIONSHIP_COLORS
} from './types/graph_types';
import { migrateToCurrentVersion } from './migrations';
import { bus } from './events';

// ─── Runtime entry types ──────────────────────────────────────────────────────

interface NodeEntry {
  concept: Concept;
}

interface ConnectorEntry {
  connector: Connector;
  sourceId: string;
  targetId: string;
  relationshipType: RelationshipType;
  label: string;
}

// ─── GraphManager ─────────────────────────────────────────────────────────────

export class GraphManager {
  private scene!: Scene;
  private worldRoot!: TransformNode;
  private camera!: Camera;
  private engine!: Engine;

  // id → entry maps
  private nodeMap = new Map<string, NodeEntry>();
  private connectorMap = new Map<string, ConnectorEntry>();

  init(config: { scene: Scene; worldRoot: TransformNode; camera: Camera; engine: Engine }): void {
    this.scene = config.scene;
    this.worldRoot = config.worldRoot;
    this.camera = config.camera;
    this.engine = config.engine;

    // Update all connector label positions each frame so they track arcs as the graph moves.
    this.scene.registerBeforeRender(() => {
      for (const [, entry] of this.connectorMap) {
        entry.connector.update();
      }
    });
  }

  // ─── Node CRUD ─────────────────────────────────────────────────────────────

  createNode(opts: {
    nodeType: Mode;
    position: Vector3;
    label?: string;
    notes?: string;
    weight?: 1 | 2 | 3 | 4 | 5;
    id?: string;
  }): string {
    const ConceptClass = ConceptMap[opts.nodeType];
    const concept = new ConceptClass(this.scene, {
      position: opts.position.clone(),
      camera: this.camera,
      engine: this.engine,
      label: opts.label ?? '',
      notes: opts.notes ?? '',
      weight: opts.weight ?? 3,
      nodeType: opts.nodeType,
      id: opts.id,
    });

    concept.sphere.parent = this.worldRoot;
    concept.sphere.metadata = { ...(concept.sphere.metadata ?? {}), conceptId: concept.id };

    this.nodeMap.set(concept.id, { concept });
    bus.emit('nodeCreated', { nodeId: concept.id });
    return concept.id;
  }

  deleteNode(nodeId: string): void {
    const entry = this.nodeMap.get(nodeId);
    if (!entry) return;

    // Cascade: remove all connectors that reference this node
    const cascaded: string[] = [];
    for (const [cid, ce] of this.connectorMap) {
      if (ce.sourceId === nodeId || ce.targetId === nodeId) {
        ce.connector.dispose();
        this.connectorMap.delete(cid);
        cascaded.push(cid);
      }
    }

    entry.concept.sphere.dispose(false, true);
    this.nodeMap.delete(nodeId);
    bus.emit('nodeDeleted', { nodeId, cascadedConnectionIds: cascaded });
  }

  updateNodeLabel(nodeId: string, label: string): void {
    const entry = this.nodeMap.get(nodeId);
    if (!entry) return;
    entry.concept.setOverlayText(label);
    bus.emit('nodeUpdated', { nodeId, field: 'label' });
  }

  updateNodeNotes(nodeId: string, notes: string): void {
    const entry = this.nodeMap.get(nodeId);
    if (!entry) return;
    entry.concept.updateNotes(notes);
    bus.emit('nodeUpdated', { nodeId, field: 'notes' });
  }

  updateNodeWeight(nodeId: string, weight: 1 | 2 | 3 | 4 | 5): void {
    const entry = this.nodeMap.get(nodeId);
    if (!entry) return;
    entry.concept.updateWeight(weight);
    bus.emit('nodeUpdated', { nodeId, field: 'weight' });
  }

  moveNode(nodeId: string, localX: number, localY: number, localZ: number): void {
    const entry = this.nodeMap.get(nodeId);
    if (!entry) return;
    entry.concept.sphere.position.set(localX, localY, localZ);
    // No bus event — drag-move fires many times per frame; serialization
    // is triggered by nodeDragEnd → persistenceManager schedules a save.
  }

  updateNodeType(nodeId: string, nodeType: Mode): void {
    const entry = this.nodeMap.get(nodeId);
    if (!entry) return;
    // Update the concept's nodeType
    entry.concept.nodeType = nodeType;
    // Recompute arc alphas for all connectors involving this node
    this.recomputeAlphasForNode(nodeId);
    bus.emit('nodeUpdated', { nodeId, field: 'nodeType' });
  }

  // ─── Connector CRUD ────────────────────────────────────────────────────────

  createConnector(opts: {
    sourceId: string;
    targetId: string;
    relationshipType?: RelationshipType;
    label?: string;
    id?: string;
  }): string | null {
    const src = this.nodeMap.get(opts.sourceId);
    const tgt = this.nodeMap.get(opts.targetId);
    if (!src || !tgt) return null;
    // Self-loop guard
    if (opts.sourceId === opts.targetId) return null;

    const laneIndex = this.getNextLane(src.concept.sphere, tgt.concept.sphere);
    const alpha = arcAlpha(
      src.concept.nodeType ?? 'answer',
      tgt.concept.nodeType ?? 'answer'
    );

    const relType = opts.relationshipType ?? 'leads to';
    const label   = opts.label ?? '';

    const connector = new Connector(this.scene, {
      start: src.concept.sphere.position.clone(),
      end: tgt.concept.sphere.position.clone(),
      startSphere: src.concept.sphere,
      endSphere: tgt.concept.sphere,
      parent: this.worldRoot,
      preview: false,
      laneIndex,
      id: opts.id,
      alpha,
      explicitColor: RELATIONSHIP_COLORS[relType],
    });

    connector.connector.metadata = {
      ...(connector.connector.metadata ?? {}),
      connectorId: connector.id,
    };
    this.connectorMap.set(connector.id, {
      connector,
      sourceId: opts.sourceId,
      targetId: opts.targetId,
      relationshipType: relType,
      label,
    });
    if (label) connector.setOverlayText(label);

    bus.emit('connectionCreated', {
      connectionId: connector.id,
      sourceId: opts.sourceId,
      targetId: opts.targetId,
    });
    return connector.id;
  }

  updateConnectionRelationship(connectionId: string, relType: RelationshipType): void {
    const entry = this.connectorMap.get(connectionId);
    if (!entry) return;
    entry.relationshipType = relType;
    entry.connector.setColor(RELATIONSHIP_COLORS[relType]);
    bus.emit('connectionUpdated', { connectionId, sourceId: entry.sourceId });
  }

  updateConnectionLabel(connectionId: string, label: string): void {
    const entry = this.connectorMap.get(connectionId);
    if (!entry) return;
    entry.label = label;
    entry.connector.setOverlayText(label);
    bus.emit('connectionUpdated', { connectionId, sourceId: entry.sourceId });
  }

  deleteConnector(connectionId: string): void {
    const entry = this.connectorMap.get(connectionId);
    if (!entry) return;
    entry.connector.dispose();
    this.connectorMap.delete(connectionId);
    // Recompact lanes between the pair
    const src = this.nodeMap.get(entry.sourceId);
    const tgt = this.nodeMap.get(entry.targetId);
    if (src && tgt) {
      this.recompactLanes(src.concept.sphere, tgt.concept.sphere);
    }
    bus.emit('connectionDeleted', { connectionId, sourceId: entry.sourceId });
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  getConnectorSourceId(connectionId: string): string | null {
    return this.connectorMap.get(connectionId)?.sourceId ?? null;
  }

  getNode(nodeId: string): NodeEntry | undefined {
    return this.nodeMap.get(nodeId);
  }

  nodeIdFromSphere(sphere: Mesh): string | null {
    return (sphere.metadata?.conceptId as string) ?? null;
  }

  getNodeData(nodeId: string): NodeData | null {
    const entry = this.nodeMap.get(nodeId);
    if (!entry) return null;
    const c = entry.concept;
    const outgoing: ConnectionData[] = [];
    for (const [cid, ce] of this.connectorMap) {
      if (ce.sourceId === nodeId) {
        outgoing.push({ id: cid, targetId: ce.targetId, relationshipType: ce.relationshipType, label: ce.label });
      }
    }
    const pos = c.sphere.position;
    return {
      id: c.id,
      label: c.label,
      notes: c.notes,
      nodeType: c.nodeType ?? 'answer',
      weight: c.weight,
      position: { x: pos.x, y: pos.y, z: pos.z },
      outgoingConnections: outgoing,
    };
  }

  getOutgoingConnections(nodeId: string): Array<ConnectorEntry & { id: string }> {
    const result: Array<ConnectorEntry & { id: string }> = [];
    for (const [id, ce] of this.connectorMap) {
      if (ce.sourceId === nodeId) result.push({ ...ce, id });
    }
    return result;
  }

  getAllObjects(): Array<Concept | Connector> {
    const out: Array<Concept | Connector> = [];
    for (const e of this.nodeMap.values()) out.push(e.concept);
    for (const e of this.connectorMap.values()) out.push(e.connector);
    return out;
  }

  getAllConcepts(): Concept[] {
    return [...this.nodeMap.values()].map(e => e.concept);
  }

  getNodeSpheres(): Mesh[] {
    return [...this.nodeMap.values()].map(e => e.concept.sphere);
  }

  // ─── Serialization ─────────────────────────────────────────────────────────

  serialize(): GraphState {
    const nodes: NodeData[] = [];
    for (const [id] of this.nodeMap) {
      const nd = this.getNodeData(id);
      if (nd) nodes.push(nd);
    }
    return { version: CURRENT_SAVE_VERSION, appVersion: (window as any).__APP_VERSION__ ?? 0, nodes };
  }

  /** Rebuild graph from a raw parsed save, migrating forward if needed.
   *  Returns false only if the data is unrecoverable (caller should back it up). */
  deserialize(raw: unknown): boolean {
    const state = migrateToCurrentVersion(raw);
    if (!state) {
      console.warn('[GraphManager] Could not migrate save — data unrecoverable.');
      return false;
    }
    this.clearAll();
    // First pass: create all nodes
    for (const nd of state.nodes) {
      this.createNode({
        id: nd.id,
        nodeType: nd.nodeType,
        position: new Vector3(nd.position.x, nd.position.y, nd.position.z),
        label: nd.label,
        notes: nd.notes,
        weight: nd.weight,
      });
    }
    // Second pass: create all connectors
    for (const nd of state.nodes) {
      for (const cd of nd.outgoingConnections) {
        this.createConnector({
          id: cd.id,
          sourceId: nd.id,
          targetId: cd.targetId,
          relationshipType: cd.relationshipType,
          label: cd.label ?? '',
        });
      }
    }
    return true;
  }

  clearAll(): void {
    for (const [, entry] of this.connectorMap) {
      entry.connector.dispose();
    }
    this.connectorMap.clear();
    for (const [, entry] of this.nodeMap) {
      entry.concept.sphere.dispose(false, true);
    }
    this.nodeMap.clear();
  }

  // ─── Lane management ───────────────────────────────────────────────────────

  private getNextLane(sphereA: Mesh, sphereB: Mesh): number {
    const used = new Set<number>();
    for (const [, ce] of this.connectorMap) {
      if (ce.connector.connectsPair(sphereA, sphereB)) {
        used.add(ce.connector.getLaneIndex());
      }
    }
    let lane = 0;
    while (used.has(lane)) lane++;
    return lane;
  }

  private recompactLanes(sphereA: Mesh, sphereB: Mesh): void {
    const pairs: Array<{ id: string; connector: Connector }> = [];
    for (const [id, ce] of this.connectorMap) {
      if (ce.connector.connectsPair(sphereA, sphereB)) {
        pairs.push({ id, connector: ce.connector });
      }
    }
    // Reassign lanes 0, 1, 2, ... in order
    pairs.forEach((p, i) => p.connector.setLaneIndex(i));
  }

  private recomputeAlphasForNode(nodeId: string): void {
    const entry = this.nodeMap.get(nodeId);
    if (!entry) return;
    const myType = entry.concept.nodeType ?? 'answer';
    for (const [, ce] of this.connectorMap) {
      if (ce.sourceId !== nodeId && ce.targetId !== nodeId) continue;
      const otherId = ce.sourceId === nodeId ? ce.targetId : ce.sourceId;
      const other = this.nodeMap.get(otherId);
      if (!other) continue;
      const otherType = other.concept.nodeType ?? 'answer';
      ce.connector.setAlpha(arcAlpha(myType, otherType));
    }
  }
}

export const graphManager = new GraphManager();
