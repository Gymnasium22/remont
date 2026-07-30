import type { Category, EstimateItem, Stage, Zone } from '../types';
import { itemPlan } from './zones';
import { getItemZoneIds } from './zones';

export type WhatIfFactors = {
  /** Глобальный множитель (1 = без изменений, 1.1 = +10%) */
  global: number;
  /** categoryId → множитель */
  byCategory: Record<string, number>;
  /** zoneId → множитель */
  byZone: Record<string, number>;
  /** stageId → множитель */
  byStage: Record<string, number>;
};

export function emptyWhatIfFactors(): WhatIfFactors {
  return { global: 1, byCategory: {}, byZone: {}, byStage: {} };
}

/**
 * Эффективный множитель позиции:
 * global × category × max(зоны) × stage
 * (для multi-zone берём max zone factor, чтобы не занижать)
 */
export function itemWhatIfFactor(
  item: EstimateItem,
  f: WhatIfFactors,
): number {
  const g = Number(f.global) || 1;
  const c = f.byCategory[item.categoryId] ?? 1;
  const s = f.byStage[item.stageId] ?? 1;
  const zoneIds = getItemZoneIds(item);
  const zFactors = zoneIds.map((id) => f.byZone[id] ?? 1);
  const z = zFactors.length ? Math.max(...zFactors) : 1;
  return g * c * s * z;
}

export function whatIfItemPlan(item: EstimateItem, f: WhatIfFactors): number {
  return itemPlan(item) * itemWhatIfFactor(item, f);
}

export function whatIfTotals(
  estimateItems: EstimateItem[],
  f: WhatIfFactors,
): {
  base: number;
  adjusted: number;
  delta: number;
  deltaPercent: number;
  byCategory: { id: string; base: number; adjusted: number }[];
  byZone: { id: string; base: number; adjusted: number }[];
} {
  let base = 0;
  let adjusted = 0;
  const catBase: Record<string, number> = {};
  const catAdj: Record<string, number> = {};
  const zoneBase: Record<string, number> = {};
  const zoneAdj: Record<string, number> = {};

  for (const item of estimateItems) {
    const b = itemPlan(item);
    const a = whatIfItemPlan(item, f);
    base += b;
    adjusted += a;
    catBase[item.categoryId] = (catBase[item.categoryId] ?? 0) + b;
    catAdj[item.categoryId] = (catAdj[item.categoryId] ?? 0) + a;
    for (const zid of getItemZoneIds(item)) {
      const share = getItemZoneIds(item).length || 1;
      zoneBase[zid] = (zoneBase[zid] ?? 0) + b / share;
      zoneAdj[zid] = (zoneAdj[zid] ?? 0) + a / share;
    }
  }

  const delta = adjusted - base;
  const deltaPercent = base > 0 ? (delta / base) * 100 : 0;

  return {
    base,
    adjusted,
    delta,
    deltaPercent,
    byCategory: Object.keys({ ...catBase, ...catAdj }).map((id) => ({
      id,
      base: catBase[id] ?? 0,
      adjusted: catAdj[id] ?? 0,
    })),
    byZone: Object.keys({ ...zoneBase, ...zoneAdj }).map((id) => ({
      id,
      base: zoneBase[id] ?? 0,
      adjusted: zoneAdj[id] ?? 0,
    })),
  };
}

export function labelFactors(
  f: WhatIfFactors,
  categories: Category[],
  zones: Zone[],
  stages: Stage[],
): string[] {
  const lines: string[] = [];
  if (f.global !== 1) {
    lines.push(`Всё ×${f.global.toFixed(2)}`);
  }
  for (const [id, v] of Object.entries(f.byCategory)) {
    if (v === 1) continue;
    const name = categories.find((c) => c.id === id)?.name ?? id;
    lines.push(`${name} ×${v.toFixed(2)}`);
  }
  for (const [id, v] of Object.entries(f.byZone)) {
    if (v === 1) continue;
    const name = zones.find((z) => z.id === id)?.name ?? id;
    lines.push(`${name} ×${v.toFixed(2)}`);
  }
  for (const [id, v] of Object.entries(f.byStage)) {
    if (v === 1) continue;
    const name = stages.find((s) => s.id === id)?.name ?? id;
    lines.push(`${name} ×${v.toFixed(2)}`);
  }
  return lines;
}
