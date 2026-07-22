import { create } from 'zustand';
import type {
  AppData,
  Category,
  Contractor,
  EstimateItem,
  Expense,
  Project,
  Stage,
  ThemeMode,
  Zone,
} from '../types';
import { createDefaultData } from '../lib/defaults';
import {
  expenseEstimateShare,
  getExpenseContractorIds,
  getExpenseEstimateIds,
  getExpenseZoneIds,
  normalizeExpense,
} from '../lib/expense';
import { clearAppData, loadAppData, saveAppData } from '../lib/idb';
import { todayISO, uid } from '../lib/utils';
import { getItemZoneIds } from '../lib/zones';

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
  ) => void;
  updateExpense: (id: string, patch: Partial<Expense>) => void;
  removeExpense: (id: string) => void;

  setTheme: (theme: ThemeMode) => void;
  exportData: () => AppData;
  importData: (data: AppData) => Promise<void>;
  resetAll: () => Promise<void>;
}

function withPersist(get: () => AppState) {
  return async () => {
    const s = get();
    const data: AppData = {
      version: 1,
      project: s.project,
      zones: s.zones,
      categories: s.categories,
      stages: s.stages,
      contractors: s.contractors,
      estimateItems: s.estimateItems,
      expenses: s.expenses,
      settings: s.settings,
    };
    await saveAppData(data);
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

      apply({
        zones: [...s.zones.filter((z) => !idSet.has(z.id)), newZone],
        estimateItems,
        expenses,
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
      apply({
        estimateItems: [
          ...get().estimateItems,
          {
            ...item,
            zoneIds,
            zoneId: zoneIds[0],
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
          return { ...next, zoneIds, zoneId: zoneIds[0] };
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
            createdAt: now,
            updatedAt: now,
          },
        ],
      });
    },

    addExpense: (e) => {
      apply({
        expenses: [
          ...get().expenses,
          normalizeExpense({
            ...e,
            id: uid(),
            createdAt: new Date().toISOString(),
          } as Expense),
        ],
      });
    },
    updateExpense: (id, patch) => {
      apply({
        expenses: get().expenses.map((e) =>
          e.id === id ? normalizeExpense({ ...e, ...patch }) : e,
        ),
      });
    },
    removeExpense: (id) => {
      apply({ expenses: get().expenses.filter((e) => e.id !== id) });
    },

    setTheme: (theme) => {
      apply({ settings: { ...get().settings, theme } });
    },

    exportData: () => {
      const s = get();
      return {
        version: 1 as const,
        project: s.project,
        zones: s.zones,
        categories: s.categories,
        stages: s.stages,
        contractors: s.contractors,
        estimateItems: s.estimateItems,
        expenses: s.expenses,
        settings: s.settings,
      };
    },

    importData: async (data) => {
      if (!data || data.version !== 1) {
        throw new Error('Неверный формат файла');
      }
      const estimateItems = (data.estimateItems ?? []).map((item) => {
        const zoneIds = getItemZoneIds(item);
        return { ...item, zoneIds, zoneId: zoneIds[0] };
      });
      const expenses = (data.expenses ?? []).map((e) => normalizeExpense(e));
      set({
        project: data.project,
        zones: data.zones ?? [],
        categories: data.categories ?? [],
        stages: data.stages ?? [],
        contractors: data.contractors ?? [],
        estimateItems,
        expenses,
        settings: data.settings ?? { theme: 'system' },
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
  return item.quantity * item.unitPrice;
}

export function selectItemFact(expenses: Expense[], itemId: string): number {
  return expenses.reduce((s, e) => s + expenseEstimateShare(e, itemId), 0);
}

export { todayISO };
