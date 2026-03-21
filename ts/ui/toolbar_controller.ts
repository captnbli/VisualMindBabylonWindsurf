import { bus } from '../events';
import { persistenceManager } from '../persistence_manager';
import { ToolMode } from '../types/graph_types';
import { Mode } from '../concepts/types';

// All node types in toolbar order
const NODE_TYPES: Array<{ mode: Mode; label: string; key: string }> = [
  { mode: 'answer',    label: 'A',  key: 'a' },
  { mode: 'question',  label: 'Q',  key: 'q' },
  { mode: 'note',      label: 'N',  key: 'n' },
  { mode: 'plus',      label: '+',  key: '+' },
  { mode: 'minus',     label: '−',  key: '-' },
  { mode: 'link',      label: 'L',  key: 'l' },
  { mode: 'reference', label: 'R',  key: 'r' },
];

export class ToolbarController {
  private toolbar!: HTMLElement;
  private saveIndicator!: HTMLElement;
  private typeBtns = new Map<Mode, HTMLButtonElement>();
  private modeBtns = new Map<ToolMode, HTMLButtonElement>();
  private activeNodeType: Mode = 'answer';
  private activeToolMode: ToolMode = 'spin';

  // ─── Init ──────────────────────────────────────────────────────────────────

  init(): void {
    this.buildDOM();
    this.subscribeEvents();
    this.setNodeType('answer');
    this.setToolMode('spin');
  }

  // ─── DOM construction ──────────────────────────────────────────────────────

  private buildDOM(): void {
    this.toolbar = document.createElement('div');
    this.toolbar.id = 'vm-toolbar';
    Object.assign(this.toolbar.style, {
      position:       'fixed',
      bottom:         '24px',
      left:           '50%',
      transform:      'translateX(-50%)',
      display:        'flex',
      alignItems:     'center',
      gap:            '6px',
      background:     'rgba(16,16,20,0.88)',
      backdropFilter: 'blur(12px)',
      border:         '1px solid rgba(255,255,255,0.1)',
      borderRadius:   '40px',
      padding:        '8px 14px',
      zIndex:         '200',
      userSelect:     'none',
    });

    // Stop toolbar pointer events from leaking to canvas
    this.toolbar.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.toolbar.addEventListener('pointerup',   (e) => e.stopPropagation());

    // ── Mode buttons (Spin / Pan) ────────────────────────────────────────────
    const modeGroup = this.makeGroup();
    for (const mode of ['spin', 'pan'] as ToolMode[]) {
      const btn = this.makeBtn(mode === 'spin' ? 'Spin' : 'Pan');
      btn.title = mode === 'spin' ? 'Drag rotates the world (default)' : 'Drag pans the world';
      btn.addEventListener('click', () => this.setToolMode(mode));
      this.modeBtns.set(mode, btn);
      modeGroup.appendChild(btn);
    }

    const divider = this.makeDivider();

    // ── Node type buttons ────────────────────────────────────────────────────
    const typeGroup = this.makeGroup();
    for (const { mode, label, key } of NODE_TYPES) {
      const btn = this.makeBtn(label);
      btn.title = `${mode} (${key})`;
      btn.addEventListener('click', () => bus.emit('nodeTypeChanged', { nodeType: mode }));
      this.typeBtns.set(mode, btn);
      typeGroup.appendChild(btn);
    }

    const divider2 = this.makeDivider();

    // ── Save indicator ───────────────────────────────────────────────────────
    this.saveIndicator = document.createElement('span');
    Object.assign(this.saveIndicator.style, {
      fontSize:   '11px',
      opacity:    '0.45',
      whiteSpace: 'nowrap',
      minWidth:   '60px',
      textAlign:  'right',
      color:      '#e8e8e8',
    });
    this.saveIndicator.textContent = '● SAVED';

    // ── Export button ────────────────────────────────────────────────────────
    const exportBtn = this.makeBtn('↓ JSON');
    exportBtn.title = 'Export JSON (Ctrl+E)';
    exportBtn.addEventListener('click', () => persistenceManager.exportJson());

    this.toolbar.appendChild(modeGroup);
    this.toolbar.appendChild(divider);
    this.toolbar.appendChild(typeGroup);
    this.toolbar.appendChild(divider2);
    this.toolbar.appendChild(this.saveIndicator);
    this.toolbar.appendChild(exportBtn);

    document.body.appendChild(this.toolbar);
  }

  private makeGroup(): HTMLElement {
    const g = document.createElement('div');
    g.style.display = 'flex';
    g.style.gap     = '4px';
    return g;
  }

  private makeDivider(): HTMLElement {
    const d = document.createElement('div');
    Object.assign(d.style, {
      width:      '1px',
      height:     '22px',
      background: 'rgba(255,255,255,0.15)',
      margin:     '0 4px',
    });
    return d;
  }

  private makeBtn(label: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    Object.assign(btn.style, {
      border:       'none',
      borderRadius: '20px',
      background:   'rgba(255,255,255,0.07)',
      color:        'rgba(255,255,255,0.55)',
      padding:      '5px 10px',
      fontSize:     '12px',
      cursor:       'pointer',
      fontFamily:   'system-ui, sans-serif',
      transition:   'background 0.15s, color 0.15s',
    });
    return btn;
  }

  // ─── Event subscriptions ───────────────────────────────────────────────────

  private subscribeEvents(): void {
    bus.on('nodeTypeChanged', ({ nodeType }) => this.setNodeType(nodeType));

    // Save state from persistence manager
    window.addEventListener('vm:saveState', (e: Event) => {
      const state = (e as CustomEvent).detail.state as 'saving' | 'saved' | 'error';
      this.updateSaveIndicator(state);
    });
  }

  // ─── State updates ─────────────────────────────────────────────────────────

  private setNodeType(mode: Mode): void {
    this.activeNodeType = mode;
    for (const [m, btn] of this.typeBtns) {
      const active = m === mode;
      btn.style.background = active ? 'rgba(108,99,255,0.28)' : 'rgba(255,255,255,0.07)';
      btn.style.color      = active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.52)';
    }
  }

  private setToolMode(mode: ToolMode): void {
    this.activeToolMode = mode;
    for (const [m, btn] of this.modeBtns) {
      const active = m === mode;
      btn.style.background = active ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.07)';
      btn.style.color      = active ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.52)';
    }
    bus.emit('toolModeChanged', { mode });
  }

  private updateSaveIndicator(state: 'saving' | 'saved' | 'error'): void {
    switch (state) {
      case 'saving':
        this.saveIndicator.textContent = '○ SAVING…';
        this.saveIndicator.style.opacity = '0.5';
        break;
      case 'saved':
        this.saveIndicator.textContent = '● SAVED';
        this.saveIndicator.style.opacity = '0.4';
        break;
      case 'error':
        this.saveIndicator.textContent = '⚠ SAVE ERR';
        this.saveIndicator.style.opacity = '0.8';
        this.saveIndicator.style.color   = '#ff6b7a';
        break;
    }
  }
}

export const toolbarController = new ToolbarController();
