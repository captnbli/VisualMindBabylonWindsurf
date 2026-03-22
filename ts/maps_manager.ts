import { bus } from './events';
import { persistenceManager, STORAGE_KEY } from './persistence_manager';
import { navigationManager } from './navigation_manager';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MapEntry {
  id:         string;
  name:       string;
  storageKey: string;
  createdAt:  number;
}

const MAPS_INDEX_KEY = 'visualmind_maps_index';

// ─── MapsManager ──────────────────────────────────────────────────────────────

export class MapsManager {
  private maps: MapEntry[] = [];
  private activeMapId = '';

  // ─── Init ──────────────────────────────────────────────────────────────────

  init(): void {
    this.loadIndex();

    if (this.maps.length === 0) {
      // First run: adopt whatever is at STORAGE_KEY as "My Brain"
      const entry: MapEntry = {
        id:         'default',
        name:       'My Brain',
        storageKey: STORAGE_KEY,
        createdAt:  Date.now(),
      };
      this.maps      = [entry];
      this.activeMapId = 'default';
      this.saveIndex();
    }

    // Set persistence layer to active map's key
    persistenceManager.setStorageKey(this.activeMap!.storageKey);
  }

  // ─── Accessors ─────────────────────────────────────────────────────────────

  get allMaps(): MapEntry[] {
    return [...this.maps];
  }

  get activeMap(): MapEntry | undefined {
    return this.maps.find(m => m.id === this.activeMapId);
  }

  isActive(id: string): boolean {
    return this.activeMapId === id;
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  async createMap(name: string): Promise<MapEntry> {
    const id    = `map_${Date.now()}`;
    const entry: MapEntry = {
      id,
      name:       name.trim() || 'Untitled',
      storageKey: `visualmind_${id}`,
      createdAt:  Date.now(),
    };
    this.maps.push(entry);
    this.activeMapId = id;
    this.saveIndex();
    await navigationManager.resetToMap(entry.storageKey, entry.name);
    bus.emit('mapsChanged', {});
    return entry;
  }

  // ─── Rename ────────────────────────────────────────────────────────────────

  renameMap(id: string, name: string): void {
    const map = this.maps.find(m => m.id === id);
    if (!map) return;
    map.name = name.trim() || 'Untitled';
    // If it's the active map, update the breadcrumb root label
    if (id === this.activeMapId) {
      navigationManager.setRoot(map.storageKey, map.name);
      bus.emit('navigationChanged', {});
    }
    this.saveIndex();
    bus.emit('mapsChanged', {});
  }

  // ─── Switch ────────────────────────────────────────────────────────────────

  async switchToMap(id: string): Promise<void> {
    if (id === this.activeMapId) return;
    const map = this.maps.find(m => m.id === id);
    if (!map) return;
    this.activeMapId = id;
    this.saveIndex();
    await navigationManager.resetToMap(map.storageKey, map.name);
    bus.emit('mapsChanged', {});
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async deleteMap(id: string): Promise<void> {
    if (this.maps.length <= 1) return;  // can't delete the last map
    const map = this.maps.find(m => m.id === id);
    if (!map) return;

    // Wipe all localStorage keys belonging to this map
    this.wipeMapData(map.storageKey);

    this.maps = this.maps.filter(m => m.id !== id);
    this.saveIndex();

    if (this.activeMapId === id) {
      this.activeMapId = this.maps[0].id;
      await navigationManager.resetToMap(this.maps[0].storageKey, this.maps[0].name);
    }

    bus.emit('mapsChanged', {});
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private wipeMapData(rootKey: string): void {
    const toDelete: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k === rootKey || k.startsWith(rootKey + '::'))) {
        toDelete.push(k);
      }
    }
    for (const k of toDelete) localStorage.removeItem(k);
  }

  private loadIndex(): void {
    const raw = localStorage.getItem(MAPS_INDEX_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        this.maps        = parsed;
        this.activeMapId = parsed[0].id;
      }
    } catch { /* ignore */ }
  }

  private saveIndex(): void {
    localStorage.setItem(MAPS_INDEX_KEY, JSON.stringify(this.maps));
  }
}

export const mapsManager = new MapsManager();
