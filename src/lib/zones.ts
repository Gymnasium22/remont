import type { EstimateExtra, EstimateItem } from '../types';

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

export function getItemExtras(
  item: Pick<EstimateItem, 'extras'>,
): EstimateExtra[] {
  return Array.isArray(item.extras) ? item.extras : [];
}

/** Базовая строка сметы (без допработ) */
export function itemBasePlan(
  item: Pick<EstimateItem, 'quantity' | 'unitPrice'>,
): number {
  return item.quantity * item.unitPrice;
}

export function itemExtrasPlan(
  item: Pick<EstimateItem, 'extras'>,
): number {
  return getItemExtras(item).reduce(
    (s, e) => s + e.quantity * e.unitPrice,
    0,
  );
}

/** Плановая стоимость позиции = база + допработы */
export function itemPlan(
  item: Pick<EstimateItem, 'quantity' | 'unitPrice' | 'extras'>,
): number {
  return itemBasePlan(item) + itemExtrasPlan(item);
}

/** Доля суммы на зону (равномерно, если зон несколько) */
export function zoneShare(
  item: Pick<
    EstimateItem,
    'zoneIds' | 'zoneId' | 'quantity' | 'unitPrice' | 'extras'
  >,
  zoneId: string,
): number {
  const ids = getItemZoneIds(item);
  if (!ids.includes(zoneId) || ids.length === 0) return 0;
  return itemPlan(item) / ids.length;
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

/** Экономия: работа своими силами (от полного плана с extras) */
export function itemDiyEconomy(
  item: Pick<
    EstimateItem,
    'quantity' | 'unitPrice' | 'selfDonePercent' | 'extras'
  >,
): number {
  const pct = Math.min(100, Math.max(0, item.selfDonePercent ?? 0));
  return (itemPlan(item) * pct) / 100;
}

/** Сколько ещё «ожидается» к оплате наёмным (план минус DIY) */
export function itemExpectedPaid(
  item: Pick<
    EstimateItem,
    'quantity' | 'unitPrice' | 'selfDonePercent' | 'extras'
  >,
): number {
  return Math.max(0, itemPlan(item) - itemDiyEconomy(item));
}

/** Остаток к оплате по позиции: ожидаемое − уже оплаченный факт */
export function itemRemaining(
  item: Pick<
    EstimateItem,
    'quantity' | 'unitPrice' | 'selfDonePercent' | 'extras'
  >,
  fact: number,
): number {
  return Math.max(0, itemExpectedPaid(item) - fact);
}
