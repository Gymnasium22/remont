import { create } from 'zustand';
import type {
  AppData,
  Category,
  Contractor,
  EstimateItem,
  Expense,
  MaterialStock,
  Project,
  Stage,
  ThemeMode,
  WishlistItem,
  Zone,
  ZonePhoto,
  ZonePhotoKind,
} from '../types';
import { APP_DATA_VERSION } from '../types';
import { createDefaultData } from '../lib/defaults';
import {
  expenseEstimateShare,
  getExpenseContractorIds,
  getExpenseEstimateIds,
  getExpenseWishlistIds,
  getExpenseZoneIds,
  normalizeExpense,
} from '../lib/expense';
import { clearAppData, loadAppData, saveAppData } from '../lib/idb';
import { migrateToLatest } from '../lib/migrate';
import { todayISO, uid } from '../lib/utils';
import {
  getWishlistExpenseIds,
  normalizeWishlistItem,
} from '../lib/wishlist';
import { getItemZoneIds, itemPlan } from '../lib/zones';

interface AppState extends AppData {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  persist: () => Promise<void>;

  updateProject: (patch: Partial<Project>) => void;
  setActiveZones: (ids: string[]) => void;
  toggleActiveZone: (id: string) => void;

  addZone: (name: string, color: string) => void;
  updateZone: (id: string, patch: Partial<Zone>) => void;
  removeZone: (id: string) => void;
  /** Объединить зоны в одну: позиции, расходы и активные зоны переназначаются */
  mergeZones: (zoneIds: string[], name?: string) => string | null;

  addCategory: (name: string, color: string) => void;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  removeCategory: (id: string) => void;

  addStage: (name: string) => void;
  updateStage: (id: string, patch: Partial<Stage>) => void;
  removeStage: (id: string) => void;

  addContractor: (c: Omit<Contractor, 'id'>) => void;
  updateContractor: (id: string, patch: Partial<Contractor>) => void;
  removeContractor: (id: string) => void;

  addEstimateItem: (
    item: Omit<EstimateItem, 'id' | 'createdAt' | 'updatedAt'>,
  ) => void;
  updateEstimateItem: (id: string, patch: Partial<EstimateItem>) => void;
  removeEstimateItem: (id: string) => void;
  duplicateEstimateItem: (id: string) => void;

  addExpense: (
    e: Omit<Expense, 'id' | 'createdAt'>,
  ) => string;
  updateExpense: (id: string, patch: Partial<Expense>) => void;
  removeExpense: (id: string) => void;

  addWishlistItem: (
    item: Omit<WishlistItem, 'id' | 'createdAt' | 'updatedAt'>,
  ) => void;
  updateWishlistItem: (id: string, patch: Partial<WishlistItem>) => void;
  removeWishlistItem: (id: string) => void;

  addMaterial: (
    m: Omit<MaterialStock, 'id' | 'createdAt' | 'updatedAt'>,
  ) => void;
  updateMaterial: (id: string, patch: Partial<MaterialStock>) => void;
  removeMaterial: (id: string) => void;

  addZonePhoto: (
    p: Omit<ZonePhoto, 'id' | 'createdAt'> & { kind?: ZonePhotoKind },
  ) => void;
  updateZonePhoto: (id: string, patch: Partial<ZonePhoto>) => void;
  removeZonePhoto: (id: string) => void;

  setTheme: (theme: ThemeMode) => void;
  exportData: () => AppData;
  importData: (data: unknown) => Promise<void>;
  resetAll: () => Promise<void>;
}

function snapshot(s: AppState): AppData {
  return {
    version: APP_DATA_VERSION,
    project: s.project,
    zones: s.zones,
    categories: s.categories,
    stages: s.stages,
    contractors: s.contractors,
    estimateItems: s.estimateItems,
    expenses: s.expenses,
    wishlistItems: s.wishlistItems ?? [],
    materials: s.materials ?? [],
    zonePhotos: s.zonePhotos ?? [],
    settings: s.settings,
  };
}

function withPersist(get: () => AppState) {
  return async () => {
    await saveAppData(snapshot(get()));
  };
}

export const useAppStore = create<AppState>((set, get) => {
  const persist = withPersist(get);

  const apply = (partial: Partial<AppState>) => {
    set(partial);
    void persist();
  };

  return {
    ...createDefaultData(),
    hydrated: false,

    hydrate: async () => {
      const data = await loadAppData();
      set({ ...data, hydrated: true });
    },

    persist,

    updateProject: (patch) => {
      apply({ project: { ...get().project, ...patch } });
    },

    setActiveZones: (ids) => {
      apply({ project: { ...get().project, activeZones: ids } });
    },

    toggleActiveZone: (id) => {
      const cur = get().project.activeZones;
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      apply({ project: { ...get().project, activeZones: next } });
    },

    addZone: (name, color) => {
      apply({
        zones: [...get().zones, { id: uid(), name, color, isCustom: true }],
      });
    },
    updateZone: (id, patch) => {
      apply({
        zones: get().zones.map((z) => (z.id === id ? { ...z, ...patch } : z)),
      });
    },
    removeZone: (id) => {
      const s = get();
      apply({
        zones: s.zones.filter((z) => z.id !== id),
        project: {
          ...s.project,
          activeZones: s.project.activeZones.filter((x) => x !== id),
        },
        estimateItems: s.estimateItems.map((item) => {
          const zoneIds = getItemZoneIds(item).filter((z) => z !== id);
          return { ...item, zoneIds, zoneId: zoneIds[0] };
        }),
        expenses: s.expenses.map((e) => {
          const zoneIds = getExpenseZoneIds(e).filter((z) => z !== id);
          return normalizeExpense({ ...e, zoneIds, zoneId: zoneIds[0] });
        }),
        materials: (s.materials ?? []).map((m) => ({
          ...m,
          zoneIds: (m.zoneIds ?? []).filter((z) => z !== id),
        })),
        zonePhotos: (s.zonePhotos ?? []).filter((p) => p.zoneId !== id),
      });
    },

    mergeZones: (sourceIds, name) => {
      const unique = [...new Set(sourceIds.filter(Boolean))];
      if (unique.length < 2) return null;

      const s = get();
      const sources = unique
        .map((id) => s.zones.find((z) => z.id === id))
        .filter(Boolean) as Zone[];
      if (sources.length < 2) return null;

      const newId = uid();
      const mergedName =
        name?.trim() ||
        sources.map((z) => z.name).join(' + ');
      const newZone: Zone = {
        id: newId,
        name: mergedName,
        color: sources[0].color,
        isCustom: true,
      };

      const idSet = new Set(unique);
      const wasActive = unique.some((id) =>
        s.project.activeZones.includes(id),
      );

      const estimateItems = s.estimateItems.map((item) => {
        const ids = getItemZoneIds(item);
        if (!ids.some((id) => idSet.has(id))) return item;
        const rest = ids.filter((id) => !idSet.has(id));
        const zoneIds = [...new Set([newId, ...rest])];
        return {
          ...item,
          zoneIds,
          zoneId: zoneIds[0],
          updatedAt: new Date().toISOString(),
        };
      });

      const expenses = s.expenses.map((e) => {
        const zids = getExpenseZoneIds(e);
        if (!zids.some((id) => idSet.has(id))) return e;
        const rest = zids.filter((id) => !idSet.has(id));
        const zoneIds = [...new Set([newId, ...rest])];
        return normalizeExpense({ ...e, zoneIds, zoneId: zoneIds[0] });
      });

      const activeZones = [
        ...s.project.activeZones.filter((id) => !idSet.has(id)),
        ...(wasActive ? [newId] : []),
      ];

      const materials = (s.materials ?? []).map((m) => {
        if (!m.zoneIds.some((id) => idSet.has(id))) return m;
        const rest = m.zoneIds.filter((id) => !idSet.has(id));
        return { ...m, zoneIds: [...new Set([newId, ...rest])] };
      });
      const zonePhotos = (s.zonePhotos ?? []).map((p) =>
        idSet.has(p.zoneId) ? { ...p, zoneId: newId } : p,
      );

      apply({
        zones: [...s.zones.filter((z) => !idSet.has(z.id)), newZone],
        estimateItems,
        expenses,
        materials,
        zonePhotos,
        project: { ...s.project, activeZones },
      });

      return newId;
    },

    addCategory: (name, color) => {
      apply({
        categories: [
          ...get().categories,
          { id: uid(), name, color, isCustom: true },
        ],
      });
    },
    updateCategory: (id, patch) => {
      apply({
        categories: get().categories.map((c) =>
          c.id === id ? { ...c, ...patch } : c,
        ),
      });
    },
    removeCategory: (id) => {
      apply({ categories: get().categories.filter((c) => c.id !== id) });
    },

    addStage: (name) => {
      const stages = get().stages;
      const order = stages.reduce((m, s) => Math.max(m, s.order), 0) + 1;
      apply({
        stages: [...stages, { id: uid(), name, order, isCustom: true }],
      });
    },
    updateStage: (id, patch) => {
      apply({
        stages: get().stages.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      });
    },
    removeStage: (id) => {
      apply({ stages: get().stages.filter((s) => s.id !== id) });
    },

    addContractor: (c) => {
      apply({
        contractors: [...get().contractors, { ...c, id: uid() }],
      });
    },
    updateContractor: (id, patch) => {
      apply({
        contractors: get().contractors.map((c) =>
          c.id === id ? { ...c, ...patch } : c,
        ),
      });
    },
    removeContractor: (id) => {
      apply({
        contractors: get().contractors.filter((c) => c.id !== id),
        expenses: get().expenses.map((e) => {
          const contractorIds = getExpenseContractorIds(e).filter(
            (x) => x !== id,
          );
          return normalizeExpense({
            ...e,
            contractorIds,
            contractorId: contractorIds[0] ?? null,
          });
        }),
      });
    },

    addEstimateItem: (item) => {
      const now = new Date().toISOString();
      const zoneIds = getItemZoneIds(item);
      const selfDonePercent = Math.min(
        100,
        Math.max(0, Number(item.selfDonePercent) || 0),
      );
      const extras = Array.isArray(item.extras) ? item.extras : [];
      apply({
        estimateItems: [
          ...get().estimateItems,
          {
            ...item,
            zoneIds,
            zoneId: zoneIds[0],
            selfDonePercent,
            extras,
            id: uid(),
            createdAt: now,
            updatedAt: now,
          },
        ],
      });
    },
    updateEstimateItem: (id, patch) => {
      apply({
        estimateItems: get().estimateItems.map((i) => {
          if (i.id !== id) return i;
          const next = { ...i, ...patch, updatedAt: new Date().toISOString() };
          const zoneIds = getItemZoneIds(next);
          const selfDonePercent = Math.min(
            100,
            Math.max(0, Number(next.selfDonePercent) || 0),
          );
          const extras = Array.isArray(next.extras) ? next.extras : [];
          return {
            ...next,
            zoneIds,
            zoneId: zoneIds[0],
            selfDonePercent,
            extras,
          };
        }),
      });
    },
    removeEstimateItem: (id) => {
      apply({
        estimateItems: get().estimateItems.filter((i) => i.id !== id),
        expenses: get().expenses.map((e) => {
          const estimateItemIds = getExpenseEstimateIds(e).filter(
            (x) => x !== id,
          );
          return normalizeExpense({
            ...e,
            estimateItemIds,
            estimateItemId: estimateItemIds[0] ?? null,
          });
        }),
      });
    },
    duplicateEstimateItem: (id) => {
      const item = get().estimateItems.find((i) => i.id === id);
      if (!item) return;
      const now = new Date().toISOString();
      apply({
        estimateItems: [
          ...get().estimateItems,
          {
            ...item,
            id: uid(),
            name: `${item.name} (копия)`,
            progress: 0,
            selfDonePercent: 0,
            extras: Array.isArray(item.extras)
              ? item.extras.map((ex) => ({ ...ex, id: uid() }))
              : [],
            createdAt: now,
            updatedAt: now,
          },
        ],
      });
    },

    addExpense: (e) => {
      const id = uid();
      const expense = normalizeExpense({
        ...e,
        id,
        createdAt: new Date().toISOString(),
      } as Expense);
      const linkedWishlist = new Set(getExpenseWishlistIds(expense));
      const now = new Date().toISOString();
      apply({
        expenses: [...get().expenses, expense],
        wishlistItems: (get().wishlistItems ?? []).map((w) => {
          if (!linkedWishlist.has(w.id)) return w;
          const expenseIds = [
            ...new Set([...getWishlistExpenseIds(w), id]),
          ];
          return normalizeWishlistItem({
            ...w,
            expenseIds,
            status: 'bought',
            updatedAt: now,
          });
        }),
      });
      return id;
    },
    updateExpense: (id, patch) => {
      const s = get();
      const prev = s.expenses.find((e) => e.id === id);
      if (!prev) return;

      const merged = { ...prev, ...patch };
      if ('estimateShares' in patch && patch.estimateShares == null) {
        delete merged.estimateShares;
      }
      if ('wishlistItemIds' in patch && patch.wishlistItemIds == null) {
        merged.wishlistItemIds = [];
      }
      const next = normalizeExpense(merged);
      const oldW = new Set(getExpenseWishlistIds(prev));
      const newW = new Set(getExpenseWishlistIds(next));
      const now = new Date().toISOString();

      apply({
        expenses: s.expenses.map((e) => (e.id === id ? next : e)),
        wishlistItems: (s.wishlistItems ?? []).map((w) => {
          const was = oldW.has(w.id);
          const is = newW.has(w.id);
          if (!was && !is) return w;
          let expenseIds = getWishlistExpenseIds(w);
          if (was && !is) {
            expenseIds = expenseIds.filter((x) => x !== id);
          }
          if (is && !expenseIds.includes(id)) {
            expenseIds = [...expenseIds, id];
          }
          return normalizeWishlistItem({
            ...w,
            expenseIds,
            status: is ? 'bought' : w.status,
            updatedAt: now,
          });
        }),
      });
    },
    removeExpense: (id) => {
      const now = new Date().toISOString();
      apply({
        expenses: get().expenses.filter((e) => e.id !== id),
        wishlistItems: (get().wishlistItems ?? []).map((w) => {
          const expenseIds = getWishlistExpenseIds(w);
          if (!expenseIds.includes(id)) return w;
          return normalizeWishlistItem({
            ...w,
            expenseIds: expenseIds.filter((x) => x !== id),
            updatedAt: now,
          });
        }),
      });
    },

    addWishlistItem: (item) => {
      const now = new Date().toISOString();
      apply({
        wishlistItems: [
          ...(get().wishlistItems ?? []),
          normalizeWishlistItem({
            ...item,
            id: uid(),
            createdAt: now,
            updatedAt: now,
          }),
        ],
      });
    },
    updateWishlistItem: (id, patch) => {
      apply({
        wishlistItems: (get().wishlistItems ?? []).map((w) => {
          if (w.id !== id) return w;
          return normalizeWishlistItem({
            ...w,
            ...patch,
            id: w.id,
            createdAt: w.createdAt,
            updatedAt: new Date().toISOString(),
          });
        }),
      });
    },
    removeWishlistItem: (id) => {
      apply({
        wishlistItems: (get().wishlistItems ?? []).filter((w) => w.id !== id),
        expenses: get().expenses.map((e) => {
          const wids = getExpenseWishlistIds(e);
          if (!wids.includes(id)) return e;
          return normalizeExpense({
            ...e,
            wishlistItemIds: wids.filter((x) => x !== id),
          });
        }),
      });
    },

    addMaterial: (m) => {
      const now = new Date().toISOString();
      apply({
        materials: [
          ...(get().materials ?? []),
          {
            id: uid(),
            name: m.name.trim() || 'Материал',
            unit: m.unit || 'шт',
            qtyIn: Math.max(0, Number(m.qtyIn) || 0),
            qtyOut: Math.max(0, Number(m.qtyOut) || 0),
            zoneIds: m.zoneIds ?? [],
            note: m.note ?? '',
            createdAt: now,
            updatedAt: now,
          },
        ],
      });
    },
    updateMaterial: (id, patch) => {
      apply({
        materials: (get().materials ?? []).map((m) =>
          m.id === id
            ? {
                ...m,
                ...patch,
                qtyIn:
                  patch.qtyIn != null
                    ? Math.max(0, Number(patch.qtyIn) || 0)
                    : m.qtyIn,
                qtyOut:
                  patch.qtyOut != null
                    ? Math.max(0, Number(patch.qtyOut) || 0)
                    : m.qtyOut,
                updatedAt: new Date().toISOString(),
              }
            : m,
        ),
      });
    },
    removeMaterial: (id) => {
      apply({
        materials: (get().materials ?? []).filter((m) => m.id !== id),
      });
    },

    addZonePhoto: (p) => {
      const now = new Date().toISOString();
      apply({
        zonePhotos: [
          ...(get().zonePhotos ?? []),
          {
            id: uid(),
            zoneId: p.zoneId,
            kind: p.kind ?? 'process',
            dataUrl: p.dataUrl,
            caption: p.caption ?? '',
            takenAt: p.takenAt || todayISO(),
            createdAt: now,
          },
        ],
      });
    },
    updateZonePhoto: (id, patch) => {
      apply({
        zonePhotos: (get().zonePhotos ?? []).map((p) =>
          p.id === id ? { ...p, ...patch } : p,
        ),
      });
    },
    removeZonePhoto: (id) => {
      apply({
        zonePhotos: (get().zonePhotos ?? []).filter((p) => p.id !== id),
      });
    },

    setTheme: (theme) => {
      apply({ settings: { ...get().settings, theme } });
    },

    exportData: () => snapshot(get()),

    importData: async (data) => {
      const migrated = migrateToLatest(data);
      set({
        ...migrated,
        hydrated: true,
      });
      await persist();
    },

    resetAll: async () => {
      await clearAppData();
      const fresh = createDefaultData();
      set({ ...fresh, hydrated: true });
      await saveAppData(fresh);
    },
  };
});

/** Селекторы для дашборда */
export function selectPlanTotal(s: AppData): number {
  return s.estimateItems.reduce(
    (sum, i) => sum + i.quantity * i.unitPrice,
    0,
  );
}

export function selectFactTotal(s: AppData): number {
  return s.expenses.reduce((sum, e) => sum + e.amount, 0);
}

export function selectItemPlan(item: EstimateItem): number {
  return itemPlan(item);
}

/** Карта план по id позиций (для пропорционального разнесения расходов) */
export function buildPlanByItemId(
  estimateItems: EstimateItem[],
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const it of estimateItems) {
    map[it.id] = itemPlan(it);
  }
  return map;
}

/**
 * Факт по позиции: расходы, привязанные к ней.
 * Если в одном расходе несколько позиций — сумма делится
 * пропорционально плану (не поровну).
 */
export function selectItemFact(
  expenses: Expense[],
  itemId: string,
  estimateItems: EstimateItem[],
): number {
  const planByItemId = buildPlanByItemId(estimateItems);
  return expenses.reduce(
    (s, e) => s + expenseEstimateShare(e, itemId, planByItemId),
    0,
  );
}

export { todayISO };
