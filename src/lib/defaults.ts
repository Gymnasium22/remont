import type { AppData, Category, Stage, Zone } from '../types';
import { uid } from './utils';

export const DEFAULT_ZONES: Omit<Zone, 'id'>[] = [
  { name: 'Ванная', color: '#0ea5e9' },
  { name: 'Туалет', color: '#6366f1' },
  { name: 'Кухня', color: '#f59e0b' },
  { name: 'Гостиная', color: '#10b981' },
  { name: 'Спальня', color: '#ec4899' },
  { name: 'Коридор', color: '#8b5cf6' },
  { name: 'Балкон', color: '#14b8a6' },
  { name: 'Общее', color: '#64748b' },
];

export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Материалы', color: '#3b82f6' },
  { name: 'Работы', color: '#22c55e' },
  { name: 'Сантехника', color: '#06b6d4' },
  { name: 'Электрика', color: '#eab308' },
  { name: 'Мебель', color: '#a855f7' },
  { name: 'Техника', color: '#f97316' },
  { name: 'Доставка', color: '#64748b' },
  { name: 'Прочее', color: '#94a3b8' },
];

export const DEFAULT_STAGES: Omit<Stage, 'id'>[] = [
  { name: 'Черновые', order: 1 },
  { name: 'Чистовые', order: 2 },
  { name: 'Инженерия', order: 3 },
  { name: 'Мебель', order: 4 },
  { name: 'Финиш', order: 5 },
];

export function createDefaultData(): AppData {
  const zones: Zone[] = DEFAULT_ZONES.map((z) => ({ ...z, id: uid() }));
  const categories: Category[] = DEFAULT_CATEGORIES.map((c) => ({
    ...c,
    id: uid(),
  }));
  const stages: Stage[] = DEFAULT_STAGES.map((s) => ({ ...s, id: uid() }));

  return {
    version: 1,
    project: {
      name: 'Мой ремонт',
      startDate: new Date().toISOString().slice(0, 10),
      totalBudget: 0,
      activeZones: zones.slice(0, 2).map((z) => z.id),
    },
    zones,
    categories,
    stages,
    contractors: [],
    estimateItems: [],
    expenses: [],
    settings: { theme: 'system' },
  };
}
