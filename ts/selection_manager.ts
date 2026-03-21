import { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math";
import { PBRMetallicRoughnessMaterial } from "@babylonjs/core/Materials/PBR/pbrMetallicRoughnessMaterial";

import { bus } from './events';
import { graphManager } from './graph_manager';

// Subtle emissive lift applied to selected sphere — no hue shift, just brightening
const SELECTED_EMISSIVE = new Color3(0.28, 0.28, 0.28);
const DEFAULT_EMISSIVE  = Color3.Black();

export class SelectionManager {
  private scene!: Scene;
  private selectedNodeId: string | null = null;

  // ─── Init ──────────────────────────────────────────────────────────────────

  init(config: { scene: Scene }): void {
    this.scene = config.scene;
    this.subscribeEvents();
  }

  // ─── Event subscriptions ───────────────────────────────────────────────────

  private subscribeEvents(): void {
    // Left-click on a sphere arms it; release without moving = already handled
    // by inputHandler which emits nodePointerDown, then createNodeRequest or
    // nodeDragEnd. For selection, we select on nodeDragEnd (click-then-release).
    bus.on('nodeDragEnd',   ({ nodeId }) => this.select(nodeId));

    // Clicking empty space clears selection
    bus.on('emptyPointerDown', () => this.clearSelection());

    // Explicit deselect (Escape key)
    bus.on('selectionChanged', ({ nodeId }) => {
      if (nodeId === null) this.clearSelection();
      else                 this.select(nodeId);
    });

    // When a node is deleted, deselect if it was selected
    bus.on('nodeDeleted', ({ nodeId }) => {
      if (this.selectedNodeId === nodeId) this.clearSelection();
    });
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  getSelectedNodeId(): string | null {
    return this.selectedNodeId;
  }

  selectNode(nodeId: string): void {
    this.select(nodeId);
  }

  // ─── Selection helpers ─────────────────────────────────────────────────────

  private select(nodeId: string): void {
    if (this.selectedNodeId === nodeId) return;
    this.setEmissive(this.selectedNodeId, DEFAULT_EMISSIVE);
    const node = graphManager.getNode(nodeId);
    if (!node) return;
    this.selectedNodeId = nodeId;
    this.setEmissive(nodeId, SELECTED_EMISSIVE);
    bus.emit('selectionChanged', { nodeId });
  }

  private clearSelection(): void {
    if (this.selectedNodeId === null) return;
    this.setEmissive(this.selectedNodeId, DEFAULT_EMISSIVE);
    this.selectedNodeId = null;
    bus.emit('selectionChanged', { nodeId: null });
  }

  private setEmissive(nodeId: string | null, color: Color3): void {
    if (!nodeId) return;
    const node = graphManager.getNode(nodeId);
    if (!node) return;
    const mat = node.concept.sphere.material;
    if (mat instanceof PBRMetallicRoughnessMaterial) {
      mat.emissiveColor = color;
    }
  }
}

export const selectionManager = new SelectionManager();
