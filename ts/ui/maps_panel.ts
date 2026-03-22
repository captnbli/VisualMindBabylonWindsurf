import { bus } from '../events';
import { mapsManager, MapEntry } from '../maps_manager';

// ─── MapsPanel ────────────────────────────────────────────────────────────────
//
// A compact flyout triggered by a pill button in the top-left corner.
// No permanent space taken. Click the button to open, click outside to close.

export class MapsPanel {
  private triggerBtn!: HTMLElement;
  private flyout!: HTMLElement;
  private listDiv!: HTMLElement;
  private open = false;
  private renaming: string | null = null;

  // ─── Init ──────────────────────────────────────────────────────────────────

  init(): void {
    this.buildDOM();
    bus.on('mapsChanged', () => this.render());
    this.render();
  }

  // ─── DOM ───────────────────────────────────────────────────────────────────

  private buildDOM(): void {
    // ── Trigger pill ──────────────────────────────────────────────────────────
    this.triggerBtn = document.createElement('div');
    Object.assign(this.triggerBtn.style, {
      position:       'fixed',
      top:            '16px',
      left:           '16px',
      display:        'flex',
      alignItems:     'center',
      gap:            '5px',
      background:     'rgba(10,10,14,0.92)',
      backdropFilter: 'blur(16px)',
      border:         '1px solid rgba(255,255,255,0.09)',
      borderRadius:   '9999px',
      padding:        '6px 12px',
      zIndex:         '200',
      cursor:         'pointer',
      userSelect:     'none',
      whiteSpace:     'nowrap',
      transition:     'border-color 0.15s',
    });

    const icon = document.createElement('span');
    icon.textContent = '⊞';
    Object.assign(icon.style, {
      fontSize:   '12px',
      opacity:    '0.6',
      fontFamily: 'system-ui, sans-serif',
    });
    const label = document.createElement('span');
    label.textContent = 'Maps';
    Object.assign(label.style, {
      fontSize:   '12px',
      fontFamily: 'Geist Mono, monospace',
      color:      '#E8E8F0',
    });

    this.triggerBtn.appendChild(icon);
    this.triggerBtn.appendChild(label);
    this.triggerBtn.addEventListener('mouseenter', () => {
      this.triggerBtn.style.borderColor = 'rgba(255,255,255,0.22)';
    });
    this.triggerBtn.addEventListener('mouseleave', () => {
      this.triggerBtn.style.borderColor = 'rgba(255,255,255,0.09)';
    });
    this.triggerBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.triggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    document.body.appendChild(this.triggerBtn);

    // ── Flyout panel ──────────────────────────────────────────────────────────
    this.flyout = document.createElement('div');
    Object.assign(this.flyout.style, {
      position:       'fixed',
      top:            '52px',
      left:           '16px',
      width:          '200px',
      maxHeight:      '60vh',
      background:     'rgba(10,10,14,0.96)',
      backdropFilter: 'blur(20px)',
      border:         '1px solid rgba(255,255,255,0.09)',
      borderRadius:   '10px',
      zIndex:         '200',
      display:        'none',
      flexDirection:  'column',
      overflow:       'hidden',
      boxShadow:      '0 8px 32px rgba(0,0,0,0.6)',
    });

    // Stop events reaching canvas
    for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'contextmenu']) {
      this.flyout.addEventListener(ev, (e) => e.stopPropagation());
    }

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, {
      padding:       '8px 12px 6px',
      fontSize:      '10px',
      fontWeight:    '600',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      color:         'rgba(255,255,255,0.3)',
      fontFamily:    'system-ui, sans-serif',
      borderBottom:  '1px solid rgba(255,255,255,0.06)',
    });
    header.textContent = 'Maps';
    this.flyout.appendChild(header);

    // Scrollable list
    this.listDiv = document.createElement('div');
    Object.assign(this.listDiv.style, {
      flex:      '1',
      overflowY: 'auto',
      padding:   '4px 0',
    });
    this.flyout.appendChild(this.listDiv);

    // New map button
    const newBtn = document.createElement('button');
    newBtn.textContent = '+ New Map';
    Object.assign(newBtn.style, {
      width:        '100%',
      background:   'transparent',
      border:       'none',
      borderTop:    '1px solid rgba(255,255,255,0.06)',
      color:        'rgba(255,255,255,0.35)',
      fontFamily:   'system-ui, sans-serif',
      fontSize:     '12px',
      padding:      '9px 14px',
      cursor:       'pointer',
      textAlign:    'left',
      transition:   'background 0.12s, color 0.12s',
    });
    newBtn.addEventListener('mouseenter', () => {
      newBtn.style.background = 'rgba(108,99,255,0.15)';
      newBtn.style.color      = 'rgba(255,255,255,0.8)';
    });
    newBtn.addEventListener('mouseleave', () => {
      newBtn.style.background = 'transparent';
      newBtn.style.color      = 'rgba(255,255,255,0.35)';
    });
    newBtn.addEventListener('click', () => this.startNewMap());
    this.flyout.appendChild(newBtn);

    document.body.appendChild(this.flyout);

    // Click-outside to close
    document.addEventListener('click', () => { if (this.open) this.close(); });
  }

  // ─── Toggle ────────────────────────────────────────────────────────────────

  private toggle(): void {
    this.open ? this.close() : this.openPanel();
  }

  private openPanel(): void {
    this.open = true;
    this.renaming = null;
    this.render();
    this.flyout.style.display = 'flex';
    this.triggerBtn.style.borderColor = 'rgba(108,99,255,0.5)';
  }

  private close(): void {
    this.open = false;
    this.renaming = null;
    this.flyout.style.display = 'none';
    this.triggerBtn.style.borderColor = 'rgba(255,255,255,0.09)';
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  private render(): void {

    if (!this.open) return;

    this.listDiv.innerHTML = '';
    for (const map of mapsManager.allMaps) {
      this.listDiv.appendChild(this.makeRow(map));
    }
  }

  private makeRow(map: MapEntry): HTMLElement {
    const isActive   = mapsManager.isActive(map.id);
    const isRenaming = this.renaming === map.id;

    const row = document.createElement('div');
    Object.assign(row.style, {
      display:     'flex',
      alignItems:  'center',
      gap:         '6px',
      height:      '34px',
      padding:     '0 8px 0 12px',
      background:  isActive ? 'rgba(108,99,255,0.15)' : 'transparent',
      borderLeft:  isActive ? '2px solid rgba(108,99,255,0.65)' : '2px solid transparent',
      cursor:      isActive ? 'default' : 'pointer',
      transition:  'background 0.1s',
      boxSizing:   'border-box',
    });

    if (!isActive) {
      row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,0.05)'; });
      row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
    }

    if (isRenaming) {
      const input = document.createElement('input');
      input.type      = 'text';
      input.value     = map.name;
      input.maxLength = 40;
      Object.assign(input.style, {
        flex:         '1',
        minWidth:     '0',
        background:   'rgba(255,255,255,0.1)',
        border:       '1px solid rgba(108,99,255,0.5)',
        borderRadius: '4px',
        color:        '#e8e8e8',
        fontFamily:   'system-ui, sans-serif',
        fontSize:     '12px',
        padding:      '3px 7px',
        outline:      'none',
      });
      const commit = () => {
        this.renaming = null;
        mapsManager.renameMap(map.id, input.value);
      };
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { this.renaming = null; this.render(); }
        e.stopPropagation();
      });
      input.addEventListener('blur', commit);
      row.appendChild(input);
      requestAnimationFrame(() => { input.focus(); input.select(); });

    } else {
      const nameEl = document.createElement('span');
      nameEl.textContent = map.name;
      Object.assign(nameEl.style, {
        flex:         '1',
        minWidth:     '0',
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        whiteSpace:   'nowrap',
        fontSize:     '13px',
        fontFamily:   'system-ui, sans-serif',
        color:        isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)',
      });

      if (!isActive) {
        row.addEventListener('click', () => {
          mapsManager.switchToMap(map.id);
          this.close();
        });
      }

      nameEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        this.renaming = map.id;
        this.render();
      });

      row.appendChild(nameEl);

      // Action buttons — appear on hover
      const actions = document.createElement('div');
      Object.assign(actions.style, {
        display:    'flex',
        gap:        '2px',
        opacity:    '0',
        transition: 'opacity 0.1s',
        flexShrink: '0',
      });

      const editBtn = this.makeIconBtn('✎', 'Rename');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.renaming = map.id;
        this.render();
      });
      actions.appendChild(editBtn);

      if (mapsManager.allMaps.length > 1) {
        const delBtn = this.makeIconBtn('×', 'Delete map');
        delBtn.style.color = 'rgba(255,107,122,0.6)';
        delBtn.addEventListener('mouseenter', () => { delBtn.style.color = '#ff6b7a'; });
        delBtn.addEventListener('mouseleave', () => { delBtn.style.color = 'rgba(255,107,122,0.6)'; });
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`Delete "${map.name}"?\n\nAll nodes and rooms in this map will be permanently removed.`)) {
            mapsManager.deleteMap(map.id);
          }
        });
        actions.appendChild(delBtn);
      }

      row.appendChild(actions);
      row.addEventListener('mouseenter', () => { actions.style.opacity = '1'; });
      row.addEventListener('mouseleave', () => { actions.style.opacity = '0'; });
    }

    return row;
  }

  private makeIconBtn(label: string, title: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.title       = title;
    Object.assign(btn.style, {
      background:   'transparent',
      border:       'none',
      color:        'rgba(255,255,255,0.3)',
      fontFamily:   'system-ui, sans-serif',
      fontSize:     '12px',
      padding:      '2px 4px',
      cursor:       'pointer',
      borderRadius: '3px',
      lineHeight:   '1',
      transition:   'color 0.1s',
    });
    btn.addEventListener('mouseenter', () => { btn.style.color = 'rgba(255,255,255,0.85)'; });
    btn.addEventListener('mouseleave', () => { btn.style.color = 'rgba(255,255,255,0.3)'; });
    return btn;
  }

  private async startNewMap(): Promise<void> {
    const map = await mapsManager.createMap('Untitled');
    this.renaming = map.id;
    this.render();
  }
}

export const mapsPanel = new MapsPanel();
