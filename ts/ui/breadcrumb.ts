import { bus } from '../events';
import { navigationManager } from '../navigation_manager';

// ─── BreadcrumbController ─────────────────────────────────────────────────────
//
// Floating pill at top-center showing the current navigation path.
// Hidden at root depth. Each ancestor crumb is clickable to jump back.
// ESC key navigates back when depth > 0.

export class BreadcrumbController {
  private el!: HTMLElement;

  // ─── Init ──────────────────────────────────────────────────────────────────

  init(): void {
    this.buildDOM();
    bus.on('navigationChanged', () => this.render());
    this.render(); // show "Home" immediately on load
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navigationManager.depth > 0) {
        e.stopImmediatePropagation();
        bus.emit('navigateBack', {});
      }
    }, true);  // capture phase so it runs before input_handler's ESC handler
  }

  // ─── DOM ───────────────────────────────────────────────────────────────────

  private buildDOM(): void {
    this.el = document.createElement('div');
    this.el.id = 'vm-breadcrumb';
    Object.assign(this.el.style, {
      position:       'fixed',
      top:            '16px',
      left:           '50%',
      transform:      'translateX(-50%)',
      display:        'none',
      alignItems:     'center',
      gap:            '4px',
      background:     'rgba(10,10,14,0.92)',
      backdropFilter: 'blur(16px)',
      border:         '1px solid rgba(255,255,255,0.09)',
      borderRadius:   '9999px',
      padding:        '6px 14px',
      zIndex:         '200',
      userSelect:     'none',
      whiteSpace:     'nowrap',
    });
    this.el.addEventListener('pointerdown', e => e.stopPropagation());
    this.el.addEventListener('contextmenu', e => e.preventDefault());
    document.body.appendChild(this.el);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  private render(): void {
    const crumbs = navigationManager.breadcrumb;
    const atRoot = crumbs.length <= 1;

    this.el.style.display = 'flex';
    this.el.innerHTML = '';

    crumbs.forEach((crumb, i) => {
      const isLast = i === crumbs.length - 1;

      if (i > 0) {
        const sep = document.createElement('span');
        sep.textContent = '›';
        Object.assign(sep.style, {
          fontFamily: 'Geist Mono, monospace',
          fontSize:   '13px',
          color:      '#3A3A4A',
          padding:    '0 2px',
        });
        this.el.appendChild(sep);
      }

      const btn = document.createElement('button');
      btn.textContent = crumb.label || 'Home';
      Object.assign(btn.style, {
        background:  'transparent',
        border:      'none',
        fontFamily:  'Geist Mono, monospace',
        fontSize:    '12px',
        color:       isLast ? '#E8E8F0' : '#66667A',
        cursor:      isLast ? 'default' : 'pointer',
        padding:     '0 2px',
        transition:  'color 0.1s',
      });

      if (!isLast) {
        btn.addEventListener('mouseenter', () => { btn.style.color = '#E8E8F0'; });
        btn.addEventListener('mouseleave', () => { btn.style.color = '#66667A'; });
        btn.addEventListener('click', () => navigationManager.jumpTo(i));
      }

      this.el.appendChild(btn);
    });

    // Back hint (ESC) — only when there's somewhere to go back to
    if (!atRoot) {
      const hint = document.createElement('span');
      hint.textContent = '  esc';
      Object.assign(hint.style, {
        fontFamily: 'Geist Mono, monospace',
        fontSize:   '10px',
        color:      '#3A3A4A',
        marginLeft: '4px',
      });
      this.el.appendChild(hint);
    }
  }
}

export const breadcrumbController = new BreadcrumbController();
