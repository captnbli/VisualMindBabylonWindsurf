import { bus } from '../events';
import { graphManager } from '../graph_manager';
import { selectionManager } from '../selection_manager';
import { RelationshipType } from '../types/graph_types';
import { Mode } from '../concepts/types';

const PANEL_WIDTH = 280;

// Node type display names
const TYPE_LABELS: Record<Mode, string> = {
  answer:    'Answer',
  question:  'Question',
  note:      'Note',
  plus:      'Plus (+)',
  minus:     'Minus (−)',
  link:      'Link',
  reference: 'Reference',
};

const ALL_TYPES: Mode[] = ['answer', 'question', 'note', 'plus', 'minus', 'link', 'reference'];
const RELATIONSHIP_TYPES: RelationshipType[] = ['leads to', 'part of', 'requires', 'enables'];

export class PanelController {
  private panel!: HTMLElement;
  private titleInput!: HTMLInputElement;
  private notesInput!: HTMLTextAreaElement;
  private typeSelect!: HTMLSelectElement;
  private weightInput!: HTMLInputElement;
  private connectionsDiv!: HTMLElement;
  private deleteBtn!: HTMLButtonElement;
  private flyBtn!: HTMLButtonElement;

  private currentNodeId: string | null = null;

  // ─── Init ──────────────────────────────────────────────────────────────────

  init(): void {
    this.buildDOM();
    this.subscribeEvents();
  }

  // ─── DOM construction ──────────────────────────────────────────────────────

  private buildDOM(): void {
    this.panel = document.createElement('div');
    this.panel.id = 'vm-panel';
    Object.assign(this.panel.style, {
      position:       'fixed',
      top:            '0',
      right:          '0',
      width:          `${PANEL_WIDTH}px`,
      height:         '100vh',
      background:     'rgba(16,16,20,0.92)',
      backdropFilter: 'blur(12px)',
      borderLeft:     '1px solid rgba(255,255,255,0.08)',
      color:          '#e8e8e8',
      fontFamily:     'system-ui, -apple-system, sans-serif',
      fontSize:       '13px',
      overflowY:      'auto',
      padding:        '20px 16px',
      boxSizing:      'border-box',
      display:        'none',
      zIndex:         '100',
      userSelect:     'text',
    });

    // Stop all pointer events from reaching the canvas
    this.panel.addEventListener('pointerdown',  (e) => e.stopPropagation());
    this.panel.addEventListener('pointermove',  (e) => e.stopPropagation());
    this.panel.addEventListener('pointerup',    (e) => e.stopPropagation());
    this.panel.addEventListener('wheel',        (e) => e.stopPropagation());
    this.panel.addEventListener('contextmenu',  (e) => e.stopPropagation());

    this.panel.innerHTML = this.panelHTML();
    document.body.appendChild(this.panel);

    // Wire up references
    this.titleInput    = this.panel.querySelector('#vm-title')!;
    this.notesInput    = this.panel.querySelector('#vm-notes')!;
    this.typeSelect    = this.panel.querySelector('#vm-type')!;
    this.weightInput   = this.panel.querySelector('#vm-weight')!;
    this.connectionsDiv = this.panel.querySelector('#vm-connections')!;
    this.deleteBtn     = this.panel.querySelector('#vm-delete')!;
    this.flyBtn        = this.panel.querySelector('#vm-fly')!;

    this.wireInputs();
  }

  private panelHTML(): string {
    const typeOptions = ALL_TYPES.map(t =>
      `<option value="${t}">${TYPE_LABELS[t]}</option>`
    ).join('');

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span style="font-weight:600;letter-spacing:0.03em;opacity:0.5;font-size:11px;text-transform:uppercase">Node</span>
        <button id="vm-fly" style="${this.btnStyle('small')}">Focus ⊙</button>
      </div>

      <label style="${this.labelStyle()}">Label</label>
      <input id="vm-title" type="text" maxlength="12" placeholder="Name…"
        style="${this.inputStyle()}" />

      <label style="${this.labelStyle()}">Notes</label>
      <textarea id="vm-notes" rows="4" placeholder="Notes…"
        style="${this.inputStyle()} resize:vertical;min-height:80px;"></textarea>

      <label style="${this.labelStyle()}">Type</label>
      <select id="vm-type" style="${this.inputStyle()}">${typeOptions}</select>

      <label style="${this.labelStyle()}">Weight <span id="vm-weight-val" style="opacity:0.5"></span></label>
      <input id="vm-weight" type="range" min="1" max="5" step="1"
        style="width:100%;accent-color:#6c63ff;margin-bottom:14px" />

      <div id="vm-connections" style="margin-bottom:16px"></div>

      <button id="vm-delete" style="${this.btnStyle('danger')}">Delete node</button>
    `;
  }

  private labelStyle(): string {
    return 'display:block;font-size:11px;opacity:0.45;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px';
  }

  private inputStyle(): string {
    return [
      'width:100%',
      'box-sizing:border-box',
      'background:rgba(255,255,255,0.06)',
      'border:1px solid rgba(255,255,255,0.12)',
      'border-radius:6px',
      'color:#e8e8e8',
      'padding:7px 10px',
      'font:13px system-ui,sans-serif',
      'outline:none',
      'margin-bottom:14px',
    ].join(';');
  }

  private btnStyle(variant: 'small' | 'danger'): string {
    const base = [
      'border:none',
      'border-radius:6px',
      'cursor:pointer',
      'font:12px system-ui,sans-serif',
      'padding:5px 10px',
    ];
    if (variant === 'danger') {
      base.push('background:rgba(220,53,69,0.25)', 'color:#ff6b7a', 'width:100%', 'padding:8px');
    } else {
      base.push('background:rgba(255,255,255,0.08)', 'color:#ccc');
    }
    return base.join(';');
  }

  // ─── Input wiring ──────────────────────────────────────────────────────────

  private wireInputs(): void {
    this.titleInput.addEventListener('input', () => {
      if (!this.currentNodeId) return;
      graphManager.updateNodeLabel(this.currentNodeId, this.titleInput.value);
    });

    this.titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.titleInput.blur(); }
    });

    this.notesInput.addEventListener('input', () => {
      if (!this.currentNodeId) return;
      graphManager.updateNodeNotes(this.currentNodeId, this.notesInput.value);
    });

    this.typeSelect.addEventListener('change', () => {
      if (!this.currentNodeId) return;
      graphManager.updateNodeType(this.currentNodeId, this.typeSelect.value as Mode);
    });

    this.weightInput.addEventListener('input', () => {
      if (!this.currentNodeId) return;
      const w = parseInt(this.weightInput.value, 10) as 1 | 2 | 3 | 4 | 5;
      const valEl = this.panel.querySelector('#vm-weight-val');
      if (valEl) valEl.textContent = String(w);
      graphManager.updateNodeWeight(this.currentNodeId, w);
    });

    this.deleteBtn.addEventListener('click', () => {
      if (!this.currentNodeId) return;
      bus.emit('deleteRequest', {});
    });

    this.flyBtn.addEventListener('click', () => {
      if (!this.currentNodeId) return;
      bus.emit('flyToNode', { nodeId: this.currentNodeId });
    });
  }

  // ─── Event subscriptions ───────────────────────────────────────────────────

  private subscribeEvents(): void {
    bus.on('selectionChanged', ({ nodeId }) => {
      if (nodeId) this.showNode(nodeId);
      else        this.hide();
    });

    bus.on('nodeUpdated', ({ nodeId }) => {
      if (nodeId === this.currentNodeId) this.refreshConnections();
    });

    bus.on('connectionCreated', ({ sourceId, targetId }) => {
      if (sourceId === this.currentNodeId || targetId === this.currentNodeId) {
        this.refreshConnections();
      }
    });

    bus.on('connectionDeleted', ({ sourceId }) => {
      if (sourceId === this.currentNodeId) this.refreshConnections();
    });

    bus.on('nodeDeleted', ({ nodeId }) => {
      if (nodeId === this.currentNodeId) this.hide();
    });
  }

  // ─── Show / hide ───────────────────────────────────────────────────────────

  private showNode(nodeId: string): void {
    const data = graphManager.getNodeData(nodeId);
    if (!data) return;
    this.currentNodeId = nodeId;

    // Suppress input events while we repopulate
    this.titleInput.value  = data.label;
    this.notesInput.value  = data.notes;
    this.typeSelect.value  = data.nodeType;
    this.weightInput.value = String(data.weight);
    const valEl = this.panel.querySelector('#vm-weight-val');
    if (valEl) valEl.textContent = String(data.weight);

    this.refreshConnections();
    this.panel.style.display = 'block';

    // Auto-focus and select label so user can type immediately
    requestAnimationFrame(() => {
      this.titleInput.focus();
      this.titleInput.select();
    });
  }

  private hide(): void {
    this.currentNodeId = null;
    this.panel.style.display = 'none';
  }

  // ─── Connections list ──────────────────────────────────────────────────────

  private refreshConnections(): void {
    if (!this.currentNodeId) return;
    const conns = graphManager.getOutgoingConnections(this.currentNodeId);

    if (conns.length === 0) {
      this.connectionsDiv.innerHTML = '';
      return;
    }

    const header = `<div style="${this.labelStyle()}margin-bottom:8px">Connections (${conns.length})</div>`;
    const items  = conns.map(c => {
      const target = graphManager.getNodeData(c.targetId);
      const label  = target?.label || c.targetId.slice(0, 8);
      const opts   = RELATIONSHIP_TYPES.map(r =>
        `<option value="${r}" ${r === c.relationshipType ? 'selected' : ''}>${r}</option>`
      ).join('');
      return `
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
          <span style="flex:1;opacity:0.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                title="${label}">${label}</span>
          <select data-conn-id="${c.id}" style="${this.inputStyle()}margin-bottom:0;flex:0 0 auto;width:auto;font-size:11px;padding:3px 6px">${opts}</select>
          <button data-del-conn="${c.id}"
            style="border:none;background:rgba(220,53,69,0.2);color:#ff6b7a;border-radius:4px;cursor:pointer;padding:3px 7px;font-size:12px">×</button>
        </div>`;
    }).join('');

    this.connectionsDiv.innerHTML = header + items;

    // Wire relationship type changes
    this.connectionsDiv.querySelectorAll('select[data-conn-id]').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const connId = (sel as HTMLSelectElement).dataset.connId!;
        // RelationshipType change isn't in graphManager yet — emit as nodeUpdated workaround
        // This will be wired when graphManager.updateConnectionRelationship() is added.
        console.log('[PanelController] relationship change for', connId, (e.target as HTMLSelectElement).value);
      });
    });

    // Wire delete connector buttons
    this.connectionsDiv.querySelectorAll('button[data-del-conn]').forEach(btn => {
      btn.addEventListener('click', () => {
        const connId = (btn as HTMLButtonElement).dataset.delConn!;
        graphManager.deleteConnector(connId);
      });
    });
  }
}

export const panelController = new PanelController();
