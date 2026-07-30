import type { Expense, PaymentMethod, PaymentPart } from '../types';

function asIds(
  multi: string[] | undefined | null,
  single: string | null | undefined,
): string[] {
  if (Array.isArray(multi) && multi.length > 0) {
    return [...new Set(multi.filter(Boolean))];
  }
  if (single) return [single];
  return [];
}

export function getExpenseZoneIds(e: Pick<Expense, 'zoneIds' | 'zoneId'>): string[] {
  return asIds(e.zoneIds, e.zoneId);
}

export function getExpenseCategoryIds(
  e: Pick<Expense, 'categoryIds' | 'categoryId'>,
): string[] {
  return asIds(e.categoryIds, e.categoryId);
}

export function getExpenseStageIds(
  e: Pick<Expense, 'stageIds' | 'stageId'>,
): string[] {
  return asIds(e.stageIds, e.stageId);
}

export function getExpenseContractorIds(
  e: Pick<Expense, 'contractorIds' | 'contractorId'>,
): string[] {
  return asIds(e.contractorIds, e.contractorId);
}

export function getExpenseEstimateIds(
  e: Pick<Expense, 'estimateItemIds' | 'estimateItemId'>,
): string[] {
  return asIds(e.estimateItemIds, e.estimateItemId);
}

/** Связанные позиции списка «К покупке» */
export function getExpenseWishlistIds(
  e: Pick<Expense, 'wishlistItemIds'>,
): string[] {
  if (!Array.isArray(e.wishlistItemIds)) return [];
  return [...new Set(e.wishlistItemIds.filter(Boolean))];
}

/** Фото/вложения расхода (миграция с receiptPhoto) */
export function getExpenseAttachments(
  e: Pick<Expense, 'attachments' | 'receiptPhoto'>,
): string[] {
  if (Array.isArray(e.attachments) && e.attachments.length > 0) {
    return e.attachments.filter(Boolean);
  }
  if (e.receiptPhoto) return [e.receiptPhoto];
  return [];
}

/**
 * Ручные доли по позициям, если заданы и сумма сходится (±0.02).
 * Иначе null → пропорционально плану.
 */
export function getManualEstimateShares(
  e: Pick<Expense, 'estimateShares' | 'estimateItemIds' | 'estimateItemId' | 'amount'>,
): Record<string, number> | null {
  const ids = getExpenseEstimateIds(e);
  if (ids.length === 0 || !e.estimateShares) return null;
  const shares = e.estimateShares;
  const values = ids.map((id) => Number(shares[id]) || 0);
  if (values.every((v) => v <= 0) && ids.length > 1) return null;
  // Все id должны иметь явную долю (допускаем 0 только если остальные покрывают)
  const hasAny = values.some((v) => v > 0);
  if (!hasAny) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  const amount = Number(e.amount) || 0;
  if (amount > 0 && Math.abs(sum - amount) > 0.05) {
    // Неполная/кривая ручная разбивка — не применяем
    return null;
  }
  const result: Record<string, number> = {};
  for (const id of ids) {
    result[id] = Math.round((Number(shares[id]) || 0) * 100) / 100;
  }
  return result;
}

/** Нормализация разбивки оплаты (поддержка старого paymentMethod) */
export function getPaymentParts(
  e: Pick<Expense, 'paymentParts' | 'paymentMethod' | 'amount'>,
): PaymentPart[] {
  if (Array.isArray(e.paymentParts) && e.paymentParts.length > 0) {
    return e.paymentParts
      .map((p) => ({
        method: p.method,
        amount: Number(p.amount) || 0,
      }))
      .filter((p) => p.amount > 0);
  }
  if (e.paymentMethod && (e.amount ?? 0) > 0) {
    return [{ method: e.paymentMethod, amount: e.amount }];
  }
  return [];
}

export function paymentPartsTotal(parts: PaymentPart[]): number {
  return parts.reduce((s, p) => s + (Number(p.amount) || 0), 0);
}

export function paymentAmountByMethod(
  e: Pick<Expense, 'paymentParts' | 'paymentMethod' | 'amount'>,
  method: PaymentMethod,
): number {
  return getPaymentParts(e)
    .filter((p) => p.method === method)
    .reduce((s, p) => s + p.amount, 0);
}

export function expenseHasPaymentMethod(
  e: Pick<Expense, 'paymentParts' | 'paymentMethod' | 'amount'>,
  method: PaymentMethod,
): boolean {
  return getPaymentParts(e).some((p) => p.method === method && p.amount > 0);
}

export function expenseHasZone(
  e: Pick<Expense, 'zoneIds' | 'zoneId'>,
  zoneId: string,
): boolean {
  return getExpenseZoneIds(e).includes(zoneId);
}

export function expenseHasCategory(
  e: Pick<Expense, 'categoryIds' | 'categoryId'>,
  categoryId: string,
): boolean {
  return getExpenseCategoryIds(e).includes(categoryId);
}

export function expenseHasContractor(
  e: Pick<Expense, 'contractorIds' | 'contractorId'>,
  contractorId: string | 'none',
): boolean {
  const ids = getExpenseContractorIds(e);
  if (contractorId === 'none') return ids.length === 0;
  return ids.includes(contractorId);
}

/** Доля суммы расхода на зону (равномерно) */
export function expenseZoneShare(
  e: Pick<Expense, 'zoneIds' | 'zoneId' | 'amount'>,
  zoneId: string,
): number {
  const ids = getExpenseZoneIds(e);
  if (!ids.includes(zoneId) || ids.length === 0) return 0;
  return e.amount / ids.length;
}

/** Доля суммы на категорию */
export function expenseCategoryShare(
  e: Pick<Expense, 'categoryIds' | 'categoryId' | 'amount'>,
  categoryId: string,
): number {
  const ids = getExpenseCategoryIds(e);
  if (!ids.includes(categoryId) || ids.length === 0) return 0;
  return e.amount / ids.length;
}

/**
 * Распределить сумму расхода по позициям сметы пропорционально плану.
 * Так аванс 615 на позиции 711 и 120 даёт ~526 + ~89, а не 307.5 + 307.5.
 */
export function allocateExpenseByPlan(
  amount: number,
  itemIds: string[],
  planByItemId: Record<string, number>,
): Record<string, number> {
  if (itemIds.length === 0) return {};
  if (itemIds.length === 1) return { [itemIds[0]]: amount };

  const weights = itemIds.map((id) => Math.max(0, planByItemId[id] ?? 0));
  const totalW = weights.reduce((a, b) => a + b, 0);

  if (totalW <= 0) {
    const each = amount / itemIds.length;
    return Object.fromEntries(itemIds.map((id) => [id, each]));
  }

  const result: Record<string, number> = {};
  let allocated = 0;
  for (let i = 0; i < itemIds.length; i++) {
    if (i === itemIds.length - 1) {
      // остаток копеек — последней позиции, чтобы сумма сходилась
      result[itemIds[i]] = Math.round((amount - allocated) * 100) / 100;
    } else {
      const share =
        Math.round(((amount * weights[i]) / totalW) * 100) / 100;
      result[itemIds[i]] = share;
      allocated += share;
    }
  }
  return result;
}

/**
 * Доля суммы расхода на позицию сметы.
 * Приоритет: ручные estimateShares → пропорционально плану.
 */
export function expenseEstimateShare(
  e: Pick<
    Expense,
    | 'estimateItemIds'
    | 'estimateItemId'
    | 'amount'
    | 'estimateShares'
  >,
  itemId: string,
  planByItemId: Record<string, number>,
): number {
  const ids = getExpenseEstimateIds(e);
  if (!ids.includes(itemId) || ids.length === 0) return 0;
  const manual = getManualEstimateShares(e);
  if (manual) return manual[itemId] ?? 0;
  const alloc = allocateExpenseByPlan(e.amount, ids, planByItemId);
  return alloc[itemId] ?? 0;
}

/** Равномерно разложить amount по itemIds (для UI «поровну») */
export function equalShares(
  amount: number,
  itemIds: string[],
): Record<string, number> {
  if (itemIds.length === 0) return {};
  if (itemIds.length === 1) return { [itemIds[0]]: amount };
  const result: Record<string, number> = {};
  let allocated = 0;
  const each = Math.round((amount / itemIds.length) * 100) / 100;
  for (let i = 0; i < itemIds.length; i++) {
    if (i === itemIds.length - 1) {
      result[itemIds[i]] = Math.round((amount - allocated) * 100) / 100;
    } else {
      result[itemIds[i]] = each;
      allocated += each;
    }
  }
  return result;
}

export function normalizeExpense(e: Expense): Expense {
  const zoneIds = getExpenseZoneIds(e);
  const categoryIds = getExpenseCategoryIds(e);
  const stageIds = getExpenseStageIds(e);
  const contractorIds = getExpenseContractorIds(e);
  const estimateItemIds = getExpenseEstimateIds(e);
  const paymentParts = getPaymentParts(e);
  const amount =
    paymentParts.length > 0
      ? paymentPartsTotal(paymentParts)
      : Number(e.amount) || 0;
  const attachments = getExpenseAttachments(e);

  let estimateShares: Record<string, number> | undefined;
  if (
    e.estimateShares &&
    typeof e.estimateShares === 'object' &&
    Object.keys(e.estimateShares).length > 0
  ) {
    const cleaned: Record<string, number> = {};
    for (const id of estimateItemIds) {
      if (e.estimateShares[id] != null) {
        cleaned[id] =
          Math.round((Number(e.estimateShares[id]) || 0) * 100) / 100;
      }
    }
    if (Object.keys(cleaned).length > 0) estimateShares = cleaned;
  }

  const wishlistItemIds = getExpenseWishlistIds(e);

  return {
    ...e,
    amount,
    paymentParts,
    paymentMethod: paymentParts[0]?.method ?? e.paymentMethod ?? 'cash',
    zoneIds,
    zoneId: zoneIds[0],
    categoryIds,
    categoryId: categoryIds[0],
    stageIds,
    stageId: stageIds[0],
    contractorIds,
    contractorId: contractorIds[0] ?? null,
    estimateItemIds,
    estimateItemId: estimateItemIds[0] ?? null,
    wishlistItemIds,
    attachments,
    receiptPhoto: attachments[0] ?? null,
    estimateShares,
  };
}

export function toggleId(
  list: string[],
  id: string,
  opts?: { minOne?: boolean },
): string[] {
  const has = list.includes(id);
  if (has) {
    if (opts?.minOne && list.length === 1) return list;
    return list.filter((x) => x !== id);
  }
  return [...list, id];
}
