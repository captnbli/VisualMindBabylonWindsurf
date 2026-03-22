import { bus } from '../events';
import { graphManager } from '../graph_manager';

// ─── Context menu ──────────────────────────────────────────────────────────────
//
// Shown on right-click (no drag) on a node. Positioned at the cursor.
// Dismissed on click-outside, Escape, or item selection.

const MENU_ITEMS = [
  { id: 'explore', label: 'Explore this idea',  icon: '↗', accent: true  },
  { id: 'focus',   label: 'Focus on this',        icon: '⊙', accent: false },
  { id: 'delete',  label: 'Delete node',         icon: '✕', danger: true  },
] as const;

type ItemId = typeof MENU_ITEMS[number]['id'];

export class ContextMenu {
  private el: HTMLElement | null = null;
  private activeNodeId: string | null = null;
  private dismissHandler: ((e: MouseEvent) => void) | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  // ─── Init ───────────────────────────────────────────────────────────────────

  init(): void {
    bus.on('showContextMenu', ({ nodeId, screenX, screenY }) => {
      this.show(nodeId, screenX, screenY);
    });

    bus.on('showConnectorContextMenu', ({ connectionId, screenX, screenY }) => {
      this.showConnector(connectionId, screenX, screenY);
    });

    // Dismiss when another node is selected through normal flow
    bus.on('selectionChanged', () => this.dismiss());
  }

  // ─── Show ────────────────────────────────────────────────────────────────────

  private show(nodeId: string, x: number, y: number): void {
    this.dismiss(); // close any existing menu

    // Also select the node so the panel follows.
    // NOTE: the 'selectionChanged' listener calls dismiss() which nulls activeNodeId,
    // so we emit BEFORE creating the menu, then restore activeNodeId afterwards.
    bus.emit('selectionChanged', { nodeId });
    this.activeNodeId = nodeId;  // restore after dismiss() cleared it

    this.el = document.createElement('div');
    Object.assign(this.el.style, {
      position:       'fixed',
      left:           `${x}px`,
      top:            `${y}px`,
      background:     'rgba(12,12,18,0.97)',
      backdropFilter: 'blur(16px)',
      border:         '1px solid rgba(255,255,255,0.1)',
      borderRadius:   '8px',
      padding:        '4px',
      zIndex:         '500',
      minWidth:       '180px',
      boxShadow:      '0 8px 32px rgba(0,0,0,0.6)',
      userSelect:     'none',
    });

    // Stop canvas from receiving pointer events through the menu
    this.el.addEventListener('pointerdown',  e => e.stopPropagation());
    this.el.addEventListener('contextmenu',  e => e.preventDefault());

    for (const item of MENU_ITEMS) {
      const btn = this.buildItem(item);
      btn.addEventListener('click', () => this.onItemClick(item.id));
      this.el.appendChild(btn);
    }

    // Nudge left/up if menu would overflow viewport
    document.body.appendChild(this.el);
    const rect = this.el.getBoundingClientRect();
    if (rect.right  > window.innerWidth)  this.el.style.left = `${x - rect.width}px`;
    if (rect.bottom > window.innerHeight) this.el.style.top  = `${y - rect.height}px`;

    // Dismiss on outside click
    this.dismissHandler = (e: MouseEvent) => {
      if (this.el && !this.el.contains(e.target as Node)) this.dismiss();
    };
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.dismiss();
    };
    setTimeout(() => {
      document.addEventListener('pointerdown', this.dismissHandler!, true);
      document.addEventListener('keydown',     this.keyHandler!,     true);
    }, 0);
  }

  // ─── Item builder ────────────────────────────────────────────────────────────

  private buildItem(item: { id: string; label: string; icon: string; accent?: boolean; danger?: boolean }): HTMLElement {
    const btn = document.createElement('button');

    const accentColor = item.danger ? '#ff6b6b' : item.accent ? '#3B9EFF' : '#e8e8f0';

    Object.assign(btn.style, {
      display:        'flex',
      alignItems:     'center',
      gap:            '10px',
      width:          '100%',
      background:     'transparent',
      border:         'none',
      borderRadius:   '5px',
      padding:        '8px 12px',
      color:          accentColor,
      fontFamily:     'Geist, system-ui, sans-serif',
      fontSize:       '13px',
      cursor:         'pointer',
      textAlign:      'left',
      transition:     'background 0.1s',
    });

    btn.addEventListener('mouseenter', () => {
      btn.style.background = item.danger
        ? 'rgba(255,107,107,0.12)'
        : 'rgba(255,255,255,0.06)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
    });

    const iconEl = document.createElement('span');
    Object.assign(iconEl.style, {
      fontFamily:  'Geist Mono, monospace',
      fontSize:    '12px',
      opacity:     '0.7',
      flexShrink:  '0',
      width:       '14px',
      textAlign:   'center',
    });
    iconEl.textContent = item.icon;

    const labelEl = document.createElement('span');
    labelEl.textContent = item.label;

    btn.appendChild(iconEl);
    btn.appendChild(labelEl);
    return btn;
  }

  // ─── Item actions ────────────────────────────────────────────────────────────

  private onItemClick(id: ItemId): void {
    const nodeId = this.activeNodeId;
    this.dismiss();
    if (!nodeId) return;

    if (id === 'explore') {
      bus.emit('exploreNode', { nodeId });
    } else if (id === 'focus') {
      bus.emit('flyToNode', { nodeId });
    } else if (id === 'delete') {
      bus.emit('selectionChanged', { nodeId });
      bus.emit('deleteRequest', {});
    }
  }

  // ─── Connector menu ──────────────────────────────────────────────────────────

  private showConnector(connectionId: string, x: number, y: number): void {
    this.dismiss();

    const el = document.createElement('div');
    Object.assign(el.style, {
      position:       'fixed',
      left:           `${x}px`,
      top:            `${y}px`,
      background:     'rgba(12,12,18,0.97)',
      backdropFilter: 'blur(16px)',
      border:         '1px solid rgba(255,255,255,0.1)',
      borderRadius:   '8px',
      padding:        '4px',
      zIndex:         '500',
      minWidth:       '150px',
      boxShadow:      '0 8px 32px rgba(0,0,0,0.6)',
      userSelect:     'none',
    });
    el.addEventListener('pointerdown', e => e.stopPropagation());
    el.addEventListener('contextmenu', e => e.preventDefault());

    const btn = this.buildItem({ id: 'del-link', label: 'Delete link', icon: '✕', danger: true });
    btn.addEventListener('click', () => {
      el.remove();
      cleanup();
      graphManager.deleteConnector(connectionId);
    });
    el.appendChild(btn);

    document.body.appendChild(el);
    const rect = el.getBoundingClientRect();
    if (rect.right  > window.innerWidth)  el.style.left = `${x - rect.width}px`;
    if (rect.bottom > window.innerHeight) el.style.top  = `${y - rect.height}px`;

    const onOutside = (e: MouseEvent) => { if (!el.contains(e.target as Node)) { el.remove(); cleanup(); } };
    const onKey     = (e: KeyboardEvent) => { if (e.key === 'Escape') { el.remove(); cleanup(); } };
    const cleanup   = () => {
      document.removeEventListener('pointerdown', onOutside, true);
      document.removeEventListener('keydown',     onKey,     true);
    };
    setTimeout(() => {
      document.addEventListener('pointerdown', onOutside, true);
      document.addEventListener('keydown',     onKey,     true);
    }, 0);
  }

  // ─── Dismiss ─────────────────────────────────────────────────────────────────

  private dismiss(): void {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
    if (this.dismissHandler) {
      document.removeEventListener('pointerdown', this.dismissHandler, true);
      this.dismissHandler = null;
    }
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
    }
    this.activeNodeId = null;
  }
}

export const contextMenu = new ContextMenu();
