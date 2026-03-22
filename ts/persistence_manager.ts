import { bus } from './events';
import { graphManager } from './graph_manager';

const STORAGE_KEY  = 'visualmind_graph_v2';
export { STORAGE_KEY };
const AUTOSAVE_MS  = 500;
const EXPORT_FILENAME = 'visualmind-brain.json';

export class PersistenceManager {
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private dirty = false;
  private currentKey = STORAGE_KEY;

  setStorageKey(key: string): void {
    // Flush any pending save to the old key first
    if (this.saveTimer !== null) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      this.persist();
    }
    this.currentKey = key;
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  init(): void {
    this.subscribeEvents();
    this.attachExportShortcut();
  }

  // ─── Subscribe to graph mutations ─────────────────────────────────────────

  private subscribeEvents(): void {
    const schedule = () => this.scheduleSave();
    bus.on('nodeCreated',      schedule);
    bus.on('nodeDeleted',      schedule);
    bus.on('nodeUpdated',      schedule);
    bus.on('connectionCreated', schedule);
    bus.on('connectionDeleted',schedule);
    bus.on('connectionUpdated',schedule);
    bus.on('nodeDragEnd',      schedule);  // position changed
  }

  // ─── Autosave ──────────────────────────────────────────────────────────────

  private scheduleSave(): void {
    this.dirty = true;
    this.emitSaveState('saving');

    if (this.saveTimer !== null) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.persist();
    }, AUTOSAVE_MS);
  }

  private persist(): void {
    const state = graphManager.serialize();
    const json  = JSON.stringify(state);
    try {
      localStorage.setItem(this.currentKey, json);
      this.dirty = false;
      this.emitSaveState('saved');
    } catch (err: any) {
      if (err?.name === 'QuotaExceededError' || err?.code === 22) {
        // Storage full — notify user but don't crash
        this.emitSaveState('error');
        this.showToast('⚠ Storage full. Export your work with Ctrl+E.');
      } else {
        this.emitSaveState('error');
        console.error('[PersistenceManager] Save failed:', err);
      }
    }
  }

  // ─── Load ──────────────────────────────────────────────────────────────────

  /** Returns true if saved state was found and loaded. */
  load(): boolean {
    const raw = localStorage.getItem(this.currentKey);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      if (!graphManager.deserialize(parsed)) {
        // Migration failed — back up raw data and auto-download it before clearing
        const backupKey = `${this.currentKey}::backup::${Date.now()}`;
        localStorage.setItem(backupKey, raw);
        localStorage.removeItem(this.currentKey);
        const savedWith = parsed?.appVersion ? `v${parsed.appVersion}` : 'an older version';
        this.downloadRecoveryFile(raw, savedWith);
        this.showToast(`⚠ Data saved with ${savedWith} could not be loaded. Your graph has been downloaded as a backup file — don't delete it.`);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[PersistenceManager] Failed to parse saved state:', err);
      this.showToast('⚠ Saved data was corrupted. Starting fresh.');
      localStorage.removeItem(this.currentKey);
      return false;
    }
  }

  // ─── Export (Ctrl+E) ───────────────────────────────────────────────────────

  private attachExportShortcut(): void {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        this.exportJson();
      }
    });
  }

  exportJson(): void {
    const state = graphManager.serialize();
    const blob  = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href     = url;
    a.download = EXPORT_FILENAME;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Save state signal (consumed by toolbar_controller) ───────────────────
  //
  // Rather than coupling PersistenceManager to ToolbarController, we emit a
  // custom DOM event that ToolbarController can listen to.

  private emitSaveState(state: 'saving' | 'saved' | 'error'): void {
    window.dispatchEvent(new CustomEvent('vm:saveState', { detail: { state } }));
  }

  // ─── Recovery download ────────────────────────────────────────────────────

  private downloadRecoveryFile(raw: string, savedWith: string): void {
    const blob = new Blob([raw], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `visualmind-recovery-${savedWith}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Toast notification ───────────────────────────────────────────────────

  private showToast(message: string): void {
    const el = document.createElement('div');
    el.textContent = message;
    el.style.cssText = [
      'position:fixed',
      'bottom:80px',
      'left:50%',
      'transform:translateX(-50%)',
      'background:rgba(0,0,0,0.85)',
      'color:#fff',
      'padding:8px 16px',
      'border-radius:6px',
      'font:13px/1.4 system-ui,sans-serif',
      'z-index:9999',
      'pointer-events:none',
    ].join(';');
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
}

export const persistenceManager = new PersistenceManager();
