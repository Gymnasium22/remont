import type { WishlistItem, WishlistPriority, WishlistStatus } from '../types';
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

export function wishlistLineTotal(item: Pick<WishlistItem, 'price' | 'quantity'>): number {
  const q = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
  const p = Number(item.price) || 0;
  return p * q;
}

export function normalizeWishlistItem(
  raw: Partial<WishlistItem> & { id?: string },
): WishlistItem {
  const url = normalizeUrl(String(raw.url ?? ''));
  const status = STATUSES.includes(raw.status as WishlistStatus)
    ? (raw.status as WishlistStatus)
    : 'planned';
  const priority = PRIORITIES.includes(raw.priority as WishlistPriority)
    ? (raw.priority as WishlistPriority)
    : 'normal';
  const zoneIds = Array.isArray(raw.zoneIds)
    ? raw.zoneIds.filter((id): id is string => typeof id === 'string' && !!id)
    : [];
  const now = new Date().toISOString();

  return {
    id: raw.id || uid(),
    name: String(raw.name ?? '').trim() || 'Без названия',
    url,
    store: String(raw.store ?? '').trim() || storeFromUrl(url),
    price: Math.max(0, Number(raw.price) || 0),
    quantity: Math.max(0.001, Number(raw.quantity) || 1),
    unit: String(raw.unit ?? 'шт').trim() || 'шт',
    zoneIds,
    categoryId: raw.categoryId ?? null,
    priority,
    status,
    note: String(raw.note ?? ''),
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
  };
}
