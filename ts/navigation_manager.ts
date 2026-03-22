import { Vector3 } from '@babylonjs/core/Maths/math';
import { bus } from './events';
import { graphManager } from './graph_manager';
import { persistenceManager, STORAGE_KEY } from './persistence_manager';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NavFrame {
  nodeId: string | null;  // null = root
  label: string;
  storageKey: string;
}

// ─── NavigationManager ────────────────────────────────────────────────────────

export class NavigationManager {
  private stack: NavFrame[] = [
    { nodeId: null, label: 'Home', storageKey: STORAGE_KEY },
  ];

  get breadcrumb(): NavFrame[] {
    return [...this.stack];
  }

  get depth(): number {
    return this.stack.length - 1;
  }

  get currentStorageKey(): string {
    return this.stack[this.stack.length - 1].storageKey;
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  init(): void {
    bus.on('exploreNode',  ({ nodeId }) => this.enter(nodeId));
    bus.on('navigateBack', ()           => this.back());
  }

  // ─── Set root (called once at startup by mapsManager) ─────────────────────

  setRoot(storageKey: string, name: string): void {
    this.stack = [{ nodeId: null, label: name, storageKey }];
  }

  // ─── Switch to a different top-level map ───────────────────────────────────

  async resetToMap(storageKey: string, name: string): Promise<void> {
    await this.transition(() => {
      persistenceManager.setStorageKey(storageKey);
      graphManager.clearAll();
      this.loadKey(storageKey);
    });
    this.stack = [{ nodeId: null, label: name, storageKey }];
    this.markExploredNodes();
    bus.emit('navigationChanged', {});
  }

  // ─── Enter child ───────────────────────────────────────────────────────────

  private async enter(nodeId: string): Promise<void> {
    const nodeData = graphManager.getNodeData(nodeId);
    const label    = nodeData?.label?.trim() || 'Untitled';
    const childKey = `${this.currentStorageKey}::child::${nodeId}`;
    const isNew    = localStorage.getItem(childKey) === null;

    await this.transition(() => {
      // Switch persistence key (flushes pending save to current key first)
      persistenceManager.setStorageKey(childKey);
      // Clear scene and load child graph (or start fresh if new)
      graphManager.clearAll();
      this.loadKey(childKey);

      // First visit: seed the child space with the explored node so the user
      // has context for what they're building into. Same ID preserves identity.
      if (isNew && nodeData) {
        graphManager.createNode({
          id:       nodeData.id,
          nodeType: nodeData.nodeType,
          position: new Vector3(0, 0, 0),
          label:    nodeData.label,
          notes:    nodeData.notes,
          weight:   nodeData.weight,
        });
      }
    });

    this.markExploredNodes();
    this.stack.push({ nodeId, label, storageKey: childKey });
    bus.emit('navigationChanged', {});
  }

  // ─── Go back ───────────────────────────────────────────────────────────────

  async back(): Promise<void> {
    if (this.stack.length <= 1) return;

    const parentFrame = this.stack[this.stack.length - 2];

    await this.transition(() => {
      persistenceManager.setStorageKey(parentFrame.storageKey);
      graphManager.clearAll();
      this.loadKey(parentFrame.storageKey);
    });

    this.stack.pop();
    this.markExploredNodes();
    bus.emit('navigationChanged', {});
  }

  // ─── Navigate directly into a room (panel click) ──────────────────────────

  async enterRoom(relativePath: NavFrame[]): Promise<void> {
    if (relativePath.length === 0) return;
    const target = relativePath[relativePath.length - 1];

    await this.transition(() => {
      persistenceManager.setStorageKey(target.storageKey);
      graphManager.clearAll();
      this.loadKey(target.storageKey);
    });

    this.stack = [...this.stack, ...relativePath];
    this.markExploredNodes();
    bus.emit('navigationChanged', {});
  }

  // ─── Jump to a specific depth (breadcrumb click) ──────────────────────────

  async jumpTo(depth: number): Promise<void> {
    if (depth >= this.stack.length - 1) return;  // already there or deeper
    while (this.stack.length - 1 > depth) {
      // Pop without animating intermediate levels
      this.stack.pop();
    }
    const frame = this.stack[this.stack.length - 1];

    await this.transition(() => {
      persistenceManager.setStorageKey(frame.storageKey);
      graphManager.clearAll();
      this.loadKey(frame.storageKey);
    });

    this.markExploredNodes();
    bus.emit('navigationChanged', {});
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** After loading any graph, badge nodes that already have a child space in localStorage. */
  markExploredNodes(): void {
    for (const concept of graphManager.getAllConcepts()) {
      const childKey = `${this.currentStorageKey}::child::${concept.id}`;
      concept.setHasChildren(localStorage.getItem(childKey) !== null);
    }
  }

  private loadKey(key: string): void {
    const raw = localStorage.getItem(key);
    if (!raw) return;  // empty graph — start fresh
    try {
      const parsed = JSON.parse(raw);
      if (!graphManager.deserialize(parsed)) {
        // Back up before clearing — child graphs are user data too
        localStorage.setItem(`${key}::backup::${Date.now()}`, raw);
        localStorage.removeItem(key);
      }
    } catch {
      // Corrupt data → start fresh
    }
  }

  private async transition(swapFn: () => void): Promise<void> {
    await fadeOverlay('in', 250);
    swapFn();
    bus.emit('cameraReset', {});
    // Give Babylon one frame to rebuild meshes before fading back
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    await fadeOverlay('out', 350);
  }
}

// ─── Fade overlay ─────────────────────────────────────────────────────────────

function fadeOverlay(dir: 'in' | 'out', ms: number): Promise<void> {
  return new Promise(resolve => {
    let el = document.getElementById('vm-nav-overlay') as HTMLElement | null;
    if (!el) {
      el = document.createElement('div');
      el.id = 'vm-nav-overlay';
      Object.assign(el.style, {
        position:       'fixed',
        inset:          '0',
        background:     '#0A0A0E',
        pointerEvents:  'none',
        zIndex:         '999',
        opacity:        '0',
        transition:     `opacity ${ms}ms ease`,
      });
      document.body.appendChild(el);
    }

    // Force reflow so the transition fires even on first call
    void el.offsetHeight;
    el.style.transition = `opacity ${ms}ms ease`;
    el.style.opacity    = dir === 'in' ? '1' : '0';
    setTimeout(resolve, ms);
  });
}

export const navigationManager = new NavigationManager();
