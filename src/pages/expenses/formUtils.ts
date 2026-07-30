/** Чистые хелперы формы расхода (вынесено из ExpensesPage) */
import type { PaymentMethod, PaymentPart } from '../../types';
import { getItemZoneIds } from '../../lib/zones';
import { todayISO } from '../../lib/utils';
import { paymentPartsTotal } from '../../lib/expense';

export type ExpenseKind = 'estimate' | 'shop';

export type ExpenseFormState = {
  kind: ExpenseKind;
  date: string;
  payCash: string;
  payCard: string;
  payTransfer: string;
  estimateItemIds: string[];
  zoneIds: string[];
  categoryIds: string[];
  stageIds: string[];
  contractorIds: string[];
  wishlistItemIds: string[];
  comment: string;
  attachments: string[];
  shareMode: 'auto' | 'manual';
  shares: Record<string, string>;
};

export function emptyExpenseForm(): ExpenseFormState {
  return {
    kind: 'estimate',
    date: todayISO(),
    payCash: '',
    payCard: '',
    payTransfer: '',
    estimateItemIds: [],
    zoneIds: [],
    categoryIds: [],
    stageIds: [],
    contractorIds: [],
    wishlistItemIds: [],
    comment: '',
    attachments: [],
    shareMode: 'auto',
    shares: {},
  };
}

export function deriveFromEstimateItems(
  itemIds: string[],
  estimateItems: {
    id: string;
    name: string;
    zoneIds?: string[];
    zoneId?: string;
    categoryId: string;
    stageId: string;
  }[],
) {
  const zoneIds = new Set<string>();
  const categoryIds = new Set<string>();
  const stageIds = new Set<string>();

  for (const id of itemIds) {
    const item = estimateItems.find((i) => i.id === id);
    if (!item) continue;
    for (const z of getItemZoneIds({
      zoneIds: item.zoneIds ?? [],
      zoneId: item.zoneId,
    })) {
      zoneIds.add(z);
    }
    if (item.categoryId) categoryIds.add(item.categoryId);
    if (item.stageId) stageIds.add(item.stageId);
  }

  return {
    zoneIds: [...zoneIds],
    categoryIds: [...categoryIds],
    stageIds: [...stageIds],
  };
}

export function autoCommentFromItems(
  itemIds: string[],
  estimateItems: { id: string; name: string }[],
): string {
  return itemIds
    .map((id) => estimateItems.find((i) => i.id === id)?.name)
    .filter(Boolean)
    .join(', ');
}

export function formToPaymentParts(form: ExpenseFormState): PaymentPart[] {
  const parts: PaymentPart[] = [];
  const cash = Number(form.payCash) || 0;
  const card = Number(form.payCard) || 0;
  const transfer = Number(form.payTransfer) || 0;
  if (cash > 0) parts.push({ method: 'cash', amount: cash });
  if (card > 0) parts.push({ method: 'card', amount: card });
  if (transfer > 0) parts.push({ method: 'transfer', amount: transfer });
  return parts;
}

export function partsToFormFields(parts: PaymentPart[]) {
  const by = (m: PaymentMethod) =>
    parts.filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0);
  const cash = by('cash');
  const card = by('card');
  const transfer = by('transfer');
  return {
    payCash: cash > 0 ? String(cash) : '',
    payCard: card > 0 ? String(card) : '',
    payTransfer: transfer > 0 ? String(transfer) : '',
  };
}

export function applyRemainingToCash(remain: number) {
  if (remain <= 0) {
    return { payCash: '', payCard: '', payTransfer: '' };
  }
  return {
    payCash: String(Math.round(remain * 100) / 100),
    payCard: '',
    payTransfer: '',
  };
}

export { paymentPartsTotal };
