/**
 * Save format migration chain.
 *
 * SCHEMA CONTRACT — read before touching:
 *   - NEVER rename or remove a field. Old saves won't have new fields — that's fine.
 *   - New fields must be optional with a sensible default applied in migrateToCurrentVersion().
 *   - Only bump CURRENT_SAVE_VERSION (in graph_types.ts) when a migration function is added here.
 *   - Each migration function receives the previous version's shape and returns the next.
 *
 * Adding a new field (non-breaking — no version bump needed):
 *   Add the field as optional to the type, apply a default in the v→current migration below.
 *
 * Removing or renaming a field (breaking — requires a migration):
 *   1. Write migrate_vN_to_vN1() below.
 *   2. Add it to the chain in migrateToCurrentVersion().
 *   3. Bump CURRENT_SAVE_VERSION.
 */

import { GraphState, CURRENT_SAVE_VERSION } from './types/graph_types';

// ─── Migration chain ──────────────────────────────────────────────────────────

// Future migrations go here, e.g.:
// function migrate_v1_to_v2(state: any): any { ... return { ...state, version: 2 }; }

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * Attempt to migrate a raw parsed save to the current schema version.
 * Returns a valid GraphState on success, or null if migration is impossible.
 */
export function migrateToCurrentVersion(raw: unknown): GraphState | null {
  try {
    let state: any = raw;

    // Pre-versioned saves (no version field) — treat as v1
    if (typeof state !== 'object' || state === null) return null;
    if (typeof state.version !== 'number') {
      state = { version: 1, nodes: Array.isArray(state.nodes) ? state.nodes : [] };
    }

    // ── Chain ──────────────────────────────────────────────────────────────
    // Append new entries here as versions are added:
    // if (state.version === 1) state = migrate_v1_to_v2(state);
    // if (state.version === 2) state = migrate_v2_to_v3(state);
    // ──────────────────────────────────────────────────────────────────────

    // After the chain, version should equal CURRENT_SAVE_VERSION.
    // If it doesn't, the save is from a future version we don't understand.
    if (state.version !== CURRENT_SAVE_VERSION) return null;

    // Apply defaults for any new optional fields introduced after this save was written.
    // This is where non-breaking additions are handled — no version bump required.
    state.appVersion = state.appVersion ?? 0;
    state.nodes = (state.nodes ?? []).map((n: any) => ({
      id:                  n.id                  ?? crypto.randomUUID(),
      label:               n.label               ?? '',
      notes:               n.notes               ?? '',
      nodeType:            n.nodeType             ?? 'answer',
      weight:              n.weight               ?? 3,
      position:            n.position             ?? { x: 0, y: 0, z: 0 },
      outgoingConnections: (n.outgoingConnections ?? []).map((c: any) => ({
        id:               c.id               ?? crypto.randomUUID(),
        targetId:         c.targetId         ?? '',
        relationshipType: c.relationshipType ?? 'leads to',
        label:            c.label            ?? '',
      })),
    }));

    return state as GraphState;
  } catch {
    return null;
  }
}
