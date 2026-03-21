import { describe, it, expect } from 'vitest';
import {
  arcAlpha,
  isCrossCluster,
  CLUSTER_MAP,
  KEY_MAP,
} from '../ts/types/graph_types';
import { weightToScale } from '../ts/concepts/concept';
import { Mode } from '../ts/concepts/types';

// ─── arcAlpha / isCrossCluster ────────────────────────────────────────────────

describe('isCrossCluster', () => {
  it('same cluster → false', () => {
    // concept cluster: answer, note, plus, minus
    expect(isCrossCluster('answer',   'answer'  )).toBe(false);
    expect(isCrossCluster('answer',   'note'    )).toBe(false);
    expect(isCrossCluster('answer',   'plus'    )).toBe(false);
    expect(isCrossCluster('answer',   'minus'   )).toBe(false);
    expect(isCrossCluster('note',     'plus'    )).toBe(false);
    expect(isCrossCluster('plus',     'minus'   )).toBe(false);
    // question cluster: question
    expect(isCrossCluster('question', 'question')).toBe(false);
    // reference cluster: link, reference
    expect(isCrossCluster('link',     'link'    )).toBe(false);
    expect(isCrossCluster('link',     'reference')).toBe(false);
    expect(isCrossCluster('reference','reference')).toBe(false);
  });

  it('cross cluster → true', () => {
    expect(isCrossCluster('answer',   'question' )).toBe(true);
    expect(isCrossCluster('answer',   'link'     )).toBe(true);
    expect(isCrossCluster('answer',   'reference')).toBe(true);
    expect(isCrossCluster('question', 'note'     )).toBe(true);
    expect(isCrossCluster('question', 'link'     )).toBe(true);
    expect(isCrossCluster('link',     'plus'     )).toBe(true);
    expect(isCrossCluster('reference','minus'    )).toBe(true);
    expect(isCrossCluster('reference','question' )).toBe(true);
  });

  it('is symmetric', () => {
    const modes: Mode[] = ['answer','question','note','plus','minus','link','reference'];
    for (const a of modes) {
      for (const b of modes) {
        expect(isCrossCluster(a, b)).toBe(isCrossCluster(b, a));
      }
    }
  });
});

describe('arcAlpha', () => {
  it('cross-cluster connections are solid (1.0)', () => {
    expect(arcAlpha('answer',   'question' )).toBe(1.0);
    expect(arcAlpha('answer',   'link'     )).toBe(1.0);
    expect(arcAlpha('note',     'question' )).toBe(1.0);
    expect(arcAlpha('question', 'reference')).toBe(1.0);
    expect(arcAlpha('plus',     'link'     )).toBe(1.0);
  });

  it('same-cluster connections are dimmed (0.3)', () => {
    expect(arcAlpha('answer',  'answer'   )).toBe(0.3);
    expect(arcAlpha('answer',  'note'     )).toBe(0.3);
    expect(arcAlpha('answer',  'plus'     )).toBe(0.3);
    expect(arcAlpha('link',    'reference')).toBe(0.3);
    expect(arcAlpha('question','question' )).toBe(0.3);
  });

  it('is symmetric', () => {
    const modes: Mode[] = ['answer','question','note','plus','minus','link','reference'];
    for (const a of modes) {
      for (const b of modes) {
        expect(arcAlpha(a, b)).toBe(arcAlpha(b, a));
      }
    }
  });

  it('returns exactly 1.0 or 0.3 (no other values)', () => {
    const modes: Mode[] = ['answer','question','note','plus','minus','link','reference'];
    const values = new Set<number>();
    for (const a of modes) {
      for (const b of modes) {
        values.add(arcAlpha(a, b));
      }
    }
    expect([...values].sort()).toEqual([0.3, 1.0]);
  });
});

// ─── CLUSTER_MAP ──────────────────────────────────────────────────────────────

describe('CLUSTER_MAP', () => {
  it('covers all 7 node types', () => {
    const modes: Mode[] = ['answer','question','note','plus','minus','link','reference'];
    for (const m of modes) {
      expect(CLUSTER_MAP[m]).toBeDefined();
    }
  });

  it('maps to exactly 3 clusters', () => {
    const clusters = new Set(Object.values(CLUSTER_MAP));
    expect(clusters.size).toBe(3);
    expect(clusters.has('concept'  )).toBe(true);
    expect(clusters.has('question' )).toBe(true);
    expect(clusters.has('reference')).toBe(true);
  });

  it('concept cluster contains answer, note, plus, minus', () => {
    expect(CLUSTER_MAP['answer']).toBe('concept');
    expect(CLUSTER_MAP['note'  ]).toBe('concept');
    expect(CLUSTER_MAP['plus'  ]).toBe('concept');
    expect(CLUSTER_MAP['minus' ]).toBe('concept');
  });

  it('question cluster contains only question', () => {
    expect(CLUSTER_MAP['question']).toBe('question');
  });

  it('reference cluster contains link and reference', () => {
    expect(CLUSTER_MAP['link'     ]).toBe('reference');
    expect(CLUSTER_MAP['reference']).toBe('reference');
  });
});

// ─── KEY_MAP ──────────────────────────────────────────────────────────────────

describe('KEY_MAP', () => {
  it('maps all 7 keyboard shortcuts to distinct modes', () => {
    const modes = new Set(Object.values(KEY_MAP));
    expect(modes.size).toBe(7);
  });

  it('covers all Mode values', () => {
    const modes: Mode[] = ['answer','question','note','plus','minus','link','reference'];
    for (const m of modes) {
      const found = Object.values(KEY_MAP).includes(m);
      expect(found, `${m} should have a KEY_MAP entry`).toBe(true);
    }
  });

  it('has expected key bindings', () => {
    expect(KEY_MAP['a']).toBe('answer');
    expect(KEY_MAP['q']).toBe('question');
    expect(KEY_MAP['n']).toBe('note');
    expect(KEY_MAP['l']).toBe('link');
    expect(KEY_MAP['r']).toBe('reference');
  });
});

// ─── weightToScale ────────────────────────────────────────────────────────────

describe('weightToScale', () => {
  it('weight 1 → 0.8', () => expect(weightToScale(1)).toBeCloseTo(0.8));
  it('weight 2 → 1.0 (original size)', () => expect(weightToScale(2)).toBeCloseTo(1.0));
  it('weight 3 → 1.2', () => expect(weightToScale(3)).toBeCloseTo(1.2));
  it('weight 4 → 1.4', () => expect(weightToScale(4)).toBeCloseTo(1.4));
  it('weight 5 → 1.6', () => expect(weightToScale(5)).toBeCloseTo(1.6));

  it('is strictly increasing', () => {
    expect(weightToScale(1)).toBeLessThan(weightToScale(2));
    expect(weightToScale(2)).toBeLessThan(weightToScale(3));
    expect(weightToScale(3)).toBeLessThan(weightToScale(4));
    expect(weightToScale(4)).toBeLessThan(weightToScale(5));
  });

  it('follows 0.6 + weight * 0.2 formula', () => {
    for (const w of [1, 2, 3, 4, 5] as const) {
      expect(weightToScale(w)).toBeCloseTo(0.6 + w * 0.2);
    }
  });
});
