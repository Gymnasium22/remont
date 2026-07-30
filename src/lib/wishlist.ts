import type {
  Expense,
  WishlistItem,
  WishlistOffer,
  WishlistPriority,
  WishlistStatus,
} from '../types';
import { getExpenseWishlistIds } from './expense';
import { uid } from './utils';

const STATUSES: WishlistStatus[] = ['planned', 'ordered', 'bought'];
const PRIORITIES: WishlistPriority[] = ['low', 'normal', 'high'];

/** Добавляет https:// если схема не указана */
export function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (/^\/\//.test(v)) return `https:${v}`;
  return `https://${v}`;
}

/** Домен магазина из URL (без www) */
export function storeFromUrl(url: string): string {
  try {
    const u = new URL(normalizeUrl(url));
    return u.hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

export function normalizeOffer(
  raw: Partial<WishlistOffer> & { id?: string },
): WishlistOffer {
  const url = normalizeUrl(String(raw.url ?? ''));
  return {
    id: raw.id || uid(),
    url,
    store: String(raw.store ?? '').trim() || storeFromUrl(url),
    unitPrice: Math.max(0, Number(raw.unitPrice) || 0),
    note: String(raw.note ?? ''),
  };
}

/** Лучшая (минимальная ненулевая) цена среди offers; иначе 0 */
export function bestOfferPrice(offers: WishlistOffer[]): number {
  const priced = offers
    .map((o) => o.unitPrice)
    .filter((p) => p > 0);
  if (priced.length === 0) return 0;
  return Math.min(...priced);
}

export function bestOffer(offers: WishlistOffer[]): WishlistOffer | null {
  if (offers.length === 0) return null;
  const priced = offers.filter((o) => o.unitPrice > 0);
  if (priced.length === 0) return offers[0];
  return priced.reduce((a, b) => (a.unitPrice <= b.unitPrice ? a : b));
}

export function wishlistLineTotal(
  item: Pick<WishlistItem, 'price' | 'quantity' | 'offers'>,
): number {
  const q = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
  const fromOffers = bestOfferPrice(item.offers ?? []);
  const p = fromOffers > 0 ? fromOffers : Number(item.price) || 0;
  return p * q;
}

/** Сравнение: мин / макс / экономия при выборе лучшего */
export function wishlistPriceCompare(item: WishlistItem): {
  min: number;
  max: number;
  savings: number;
  count: number;
} | null {
  const prices = (item.offers ?? [])
    .map((o) => o.unitPrice)
    .filter((p) => p > 0);
  if (prices.length < 2) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return {
    min,
    max,
    savings: (max - min) * (item.quantity || 1),
    count: prices.length,
  };
}

export function getWishlistExpenseIds(
  item: Pick<WishlistItem, 'expenseIds'>,
): string[] {
  if (!Array.isArray(item.expenseIds)) return [];
  return [...new Set(item.expenseIds.filter(Boolean))];
}

/** Расходы, связанные с позицией списка покупок */
export function expensesForWishlistItem(
  expenses: Expense[],
  itemId: string,
  item?: Pick<WishlistItem, 'expenseIds'>,
): Expense[] {
  const fromItem = new Set(item ? getWishlistExpenseIds(item) : []);
  return expenses.filter(
    (e) =>
      fromItem.has(e.id) || getExpenseWishlistIds(e).includes(itemId),
  );
}

export function wishlistPaidTotal(
  expenses: Expense[],
  item: WishlistItem,
): number {
  return expensesForWishlistItem(expenses, item.id, item).reduce(
    (s, e) => s + e.amount,
    0,
  );
}

/** Комментарий расхода из позиции «К покупке» */
export function expenseCommentFromWishlist(item: WishlistItem): string {
  const parts = [item.name.trim()];
  const store = item.store?.trim() || bestOffer(item.offers ?? [])?.store;
  if (store) parts.push(`(${store})`);
  const base = parts.join(' ');
  if (item.note?.trim()) return `${base}. ${item.note.trim()}`;
  return base;
}

export function expenseCommentFromWishlists(items: WishlistItem[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return expenseCommentFromWishlist(items[0]);
  return items.map((i) => i.name.trim()).filter(Boolean).join(', ');
}

export function normalizeWishlistItem(
  raw: Partial<WishlistItem> & { id?: string },
): WishlistItem {
  let offers: WishlistOffer[] = Array.isArray(raw.offers)
    ? raw.offers.map((o) => normalizeOffer(o))
    : [];

  // Миграция: одиночная url/price → offers
  const legacyUrl = normalizeUrl(String(raw.url ?? ''));
  const legacyPrice = Math.max(0, Number(raw.price) || 0);
  const legacyStore = String(raw.store ?? '').trim();

  if (offers.length === 0 && legacyUrl) {
    offers = [
      normalizeOffer({
        url: legacyUrl,
        store: legacyStore,
        unitPrice: legacyPrice,
      }),
    ];
  } else if (offers.length === 0 && legacyPrice > 0) {
    offers = [
      normalizeOffer({
        url: '',
        store: legacyStore || '—',
        unitPrice: legacyPrice,
      }),
    ];
  }

  const best = bestOffer(offers);
  const url = best?.url || legacyUrl;
  const store =
    best?.store || legacyStore || (url ? storeFromUrl(url) : '');
  const price =
    bestOfferPrice(offers) || legacyPrice || best?.unitPrice || 0;

  const status = STATUSES.includes(raw.status as WishlistStatus)
    ? (raw.status as WishlistStatus)
    : 'planned';
  const priority = PRIORITIES.includes(raw.priority as WishlistPriority)
    ? (raw.priority as WishlistPriority)
    : 'normal';
  const zoneIds = Array.isArray(raw.zoneIds)
    ? raw.zoneIds.filter((id): id is string => typeof id === 'string' && !!id)
    : [];
  const expenseIds = Array.isArray(raw.expenseIds)
    ? [...new Set(raw.expenseIds.filter((id): id is string => !!id))]
    : [];
  const now = new Date().toISOString();

  return {
    id: raw.id || uid(),
    name: String(raw.name ?? '').trim() || 'Без названия',
    url,
    store,
    price,
    offers,
    quantity: Math.max(0.001, Number(raw.quantity) || 1),
    unit: String(raw.unit ?? 'шт').trim() || 'шт',
    zoneIds,
    categoryId: raw.categoryId ?? null,
    priority,
    status,
    note: String(raw.note ?? ''),
    expenseIds,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
  };
}
