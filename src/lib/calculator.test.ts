import { describe, expect, it } from 'vitest';
import { emptyWhatIfFactors, whatIfTotals } from './calculator';
import type { EstimateItem } from '../types';

const item = (
  partial: Partial<EstimateItem> & Pick<EstimateItem, 'id' | 'name'>,
): EstimateItem => ({
  zoneIds: ['z1'],
  categoryId: 'c1',
  stageId: 's1',
  quantity: 1,
  unit: 'шт',
  unitPrice: 100,
  progress: 0,
  selfDonePercent: 0,
  extras: [],
  origin: 'original',
  createdAt: '',
  updatedAt: '',
  ...partial,
});

describe('whatIfTotals', () => {
  it('applies global factor', () => {
    const items = [item({ id: '1', name: 'A', unitPrice: 200 })];
    const f = emptyWhatIfFactors();
    f.global = 1.1;
    const r = whatIfTotals(items, f);
    expect(r.base).toBe(200);
    expect(r.adjusted).toBeCloseTo(220, 5);
    expect(r.delta).toBeCloseTo(20, 5);
  });

  it('stacks category and zone factors', () => {
    const items = [
      item({
        id: '1',
        name: 'A',
        unitPrice: 100,
        categoryId: 'c1',
        zoneIds: ['z1'],
      }),
    ];
    const f = emptyWhatIfFactors();
    f.byCategory = { c1: 1.2 };
    f.byZone = { z1: 1.1 };
    const r = whatIfTotals(items, f);
    expect(r.adjusted).toBeCloseTo(100 * 1.2 * 1.1, 5);
  });
});
