import type { EstimateItem } from '../types';

/** Нормализация зон позиции (поддержка старого zoneId) */
export function getItemZoneIds(item: Pick<EstimateItem, 'zoneIds' | 'zoneId'>): string[] {
  if (Array.isArray(item.zoneIds) && item.zoneIds.length > 0) {
    return [...new Set(item.zoneIds.filter(Boolean))];
  }
  if (item.zoneId) return [item.zoneId];
  return [];
}

export function itemHasZone(
  item: Pick<EstimateItem, 'zoneIds' | 'zoneId'>,
  zoneId: string,
): boolean {
  return getItemZoneIds(item).includes(zoneId);
}

/** Доля суммы на зону (равномерно, если зон несколько) */
export function zoneShare(
  item: Pick<EstimateItem, 'zoneIds' | 'zoneId' | 'quantity' | 'unitPrice'>,
  zoneId: string,
): number {
  const ids = getItemZoneIds(item);
  if (!ids.includes(zoneId) || ids.length === 0) return 0;
  return (item.quantity * item.unitPrice) / ids.length;
}

export function formatZoneNames(
  zoneIds: string[],
  zones: { id: string; name: string }[],
): string {
  if (zoneIds.length === 0) return 'Без зоны';
  return zoneIds
    .map((id) => zones.find((z) => z.id === id)?.name ?? '—')
    .join(' + ');
}

/** Плановая стоимость позиции */
export function itemPlan(
  item: Pick<EstimateItem, 'quantity' | 'unitPrice'>,
): number {
  return item.quantity * item.unitPrice;
}

/** Экономия: работа своими силами */
export function itemDiyEconomy(
  item: Pick<EstimateItem, 'quantity' | 'unitPrice' | 'selfDonePercent'>,
): number {
  const pct = Math.min(100, Math.max(0, item.selfDonePercent ?? 0));
  return (itemPlan(item) * pct) / 100;
}

/** Сколько ещё «ожидается» к оплате наёмным (план минус DIY) */
export function itemExpectedPaid(
  item: Pick<EstimateItem, 'quantity' | 'unitPrice' | 'selfDonePercent'>,
): number {
  return Math.max(0, itemPlan(item) - itemDiyEconomy(item));
}
