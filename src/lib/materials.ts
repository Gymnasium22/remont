import type { MaterialStock } from '../types';

export function materialRemain(m: Pick<MaterialStock, 'qtyIn' | 'qtyOut'>): number {
  return Math.round((Number(m.qtyIn) - Number(m.qtyOut)) * 1000) / 1000;
}

export function materialUsagePercent(
  m: Pick<MaterialStock, 'qtyIn' | 'qtyOut'>,
): number {
  const inn = Number(m.qtyIn) || 0;
  if (inn <= 0) return 0;
  return Math.min(100, Math.round(((Number(m.qtyOut) || 0) / inn) * 100));
}
