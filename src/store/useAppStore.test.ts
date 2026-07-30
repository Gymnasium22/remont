import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/idb', () => ({
  loadAppData: vi.fn(async () => {
    const { createDefaultData } = await import('../lib/defaults');
    return createDefaultData();
  }),
  saveAppData: vi.fn(async () => {}),
  clearAppData: vi.fn(async () => {}),
}));

import { createDefaultData } from '../lib/defaults';
import { migrateToLatest } from '../lib/migrate';
import { expenseEstimateShare } from '../lib/expense';
import { itemPlan } from '../lib/zones';
import {
  buildPlanByItemId,
  selectItemFact,
  useAppStore,
} from './useAppStore';

describe('migrateToLatest', () => {
  it('migrates v1 to v2 with empty materials/photos', () => {
    const v1 = {
      ...createDefaultData(),
      version: 1 as const,
      materials: undefined,
      zonePhotos: undefined,
    };
    // strip v2 fields for v1 shape
    const raw = {
      version: 1,
      project: v1.project,
      zones: v1.zones,
      categories: v1.categories,
      stages: v1.stages,
      contractors: [],
      estimateItems: [],
      expenses: [],
      wishlistItems: [],
      settings: { theme: 'system' as const },
    };
    const m = migrateToLatest(raw);
    expect(m.version).toBe(2);
    expect(m.materials).toEqual([]);
    expect(m.zonePhotos).toEqual([]);
  });

  it('rejects unknown version', () => {
    expect(() => migrateToLatest({ version: 99 })).toThrow();
  });
});

describe('useAppStore', () => {
  beforeEach(() => {
    const fresh = createDefaultData();
    useAppStore.setState({ ...fresh, hydrated: true });
  });

  it('adds estimate item and computes plan', () => {
    const zoneId = useAppStore.getState().zones[0].id;
    const catId = useAppStore.getState().categories[0].id;
    const stageId = useAppStore.getState().stages[0].id;

    useAppStore.getState().addEstimateItem({
      name: 'Плитка',
      zoneIds: [zoneId],
      categoryId: catId,
      stageId,
      quantity: 10,
      unit: 'м²',
      unitPrice: 25,
      progress: 0,
      selfDonePercent: 0,
      extras: [],
    });

    const items = useAppStore.getState().estimateItems;
    expect(items).toHaveLength(1);
    expect(itemPlan(items[0])).toBe(250);
  });

  it('links expense to wishlist and marks bought', () => {
    useAppStore.getState().addWishlistItem({
      name: 'Смеситель',
      url: 'https://example.com/a',
      store: 'example.com',
      price: 100,
      offers: [
        {
          id: 'o1',
          url: 'https://example.com/a',
          store: 'example.com',
          unitPrice: 100,
          note: '',
        },
      ],
      quantity: 1,
      unit: 'шт',
      zoneIds: [],
      categoryId: null,
      priority: 'normal',
      status: 'planned',
      note: '',
      expenseIds: [],
    });

    const wId = useAppStore.getState().wishlistItems[0].id;
    const zoneId = useAppStore.getState().zones[0].id;
    const catId = useAppStore.getState().categories[0].id;
    const stageId = useAppStore.getState().stages[0].id;

    const expId = useAppStore.getState().addExpense({
      date: '2026-07-01',
      amount: 100,
      paymentParts: [{ method: 'card', amount: 100 }],
      estimateItemIds: [],
      zoneIds: [zoneId],
      categoryIds: [catId],
      stageIds: [stageId],
      contractorIds: [],
      wishlistItemIds: [wId],
      comment: 'Смеситель',
      attachments: [],
    });

    const w = useAppStore.getState().wishlistItems[0];
    expect(w.status).toBe('bought');
    expect(w.expenseIds).toContain(expId);
    const e = useAppStore.getState().expenses.find((x) => x.id === expId);
    expect(e?.wishlistItemIds).toContain(wId);
  });

  it('splits expense across estimate items by plan', () => {
    const zoneId = useAppStore.getState().zones[0].id;
    const catId = useAppStore.getState().categories[0].id;
    const stageId = useAppStore.getState().stages[0].id;

    useAppStore.getState().addEstimateItem({
      name: 'A',
      zoneIds: [zoneId],
      categoryId: catId,
      stageId,
      quantity: 1,
      unit: 'шт',
      unitPrice: 100,
      progress: 0,
      selfDonePercent: 0,
      extras: [],
    });
    useAppStore.getState().addEstimateItem({
      name: 'B',
      zoneIds: [zoneId],
      categoryId: catId,
      stageId,
      quantity: 1,
      unit: 'шт',
      unitPrice: 300,
      progress: 0,
      selfDonePercent: 0,
      extras: [],
    });

    const [a, b] = useAppStore.getState().estimateItems;
    useAppStore.getState().addExpense({
      date: '2026-07-01',
      amount: 400,
      paymentParts: [{ method: 'cash', amount: 400 }],
      estimateItemIds: [a.id, b.id],
      zoneIds: [zoneId],
      categoryIds: [catId],
      stageIds: [stageId],
      contractorIds: [],
      wishlistItemIds: [],
      comment: 'split',
      attachments: [],
    });

    const expenses = useAppStore.getState().expenses;
    const items = useAppStore.getState().estimateItems;
    const planMap = buildPlanByItemId(items);
    const shareA = expenseEstimateShare(expenses[0], a.id, planMap);
    const shareB = expenseEstimateShare(expenses[0], b.id, planMap);
    expect(shareA).toBe(100);
    expect(shareB).toBe(300);
    expect(selectItemFact(expenses, a.id, items)).toBe(100);
  });

  it('tracks material remainders', () => {
    useAppStore.getState().addMaterial({
      name: 'Клей',
      unit: 'мешок',
      qtyIn: 10,
      qtyOut: 3,
      zoneIds: [],
      note: '',
    });
    const m = useAppStore.getState().materials[0];
    expect(m.qtyIn - m.qtyOut).toBe(7);
    useAppStore.getState().updateMaterial(m.id, { qtyOut: 4 });
    expect(useAppStore.getState().materials[0].qtyOut).toBe(4);
  });

  it('exports version 2', () => {
    const data = useAppStore.getState().exportData();
    expect(data.version).toBe(2);
    expect(Array.isArray(data.materials)).toBe(true);
    expect(Array.isArray(data.zonePhotos)).toBe(true);
  });
});
