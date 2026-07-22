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

/** Доля суммы на позицию сметы */
export function expenseEstimateShare(
  e: Pick<Expense, 'estimateItemIds' | 'estimateItemId' | 'amount'>,
  itemId: string,
): number {
  const ids = getExpenseEstimateIds(e);
  if (!ids.includes(itemId) || ids.length === 0) return 0;
  return e.amount / ids.length;
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
