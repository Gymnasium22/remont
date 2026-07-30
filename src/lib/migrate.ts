import type {
  AppData,
  AppDataV1,
  EstimateItem,
  MaterialStock,
  WishlistItem,
  ZonePhoto,
} from '../types';
import { APP_DATA_VERSION } from '../types';
import { normalizeExpense } from './expense';
import { normalizeWishlistItem } from './wishlist';
import { getItemZoneIds } from './zones';

function normalizeEstimateItems(raw: EstimateItem[] | undefined): EstimateItem[] {
  return (raw ?? []).map((item) => {
    const zoneIds = getItemZoneIds(item);
    return {
      ...item,
      zoneIds,
      zoneId: zoneIds[0],
      selfDonePercent: Math.min(
        100,
        Math.max(0, Number(item.selfDonePercent) || 0),
      ),
      extras: Array.isArray(item.extras) ? item.extras : [],
    };
  });
}

function normalizeMaterials(raw: MaterialStock[] | undefined): MaterialStock[] {
  return (raw ?? []).map((m) => ({
    ...m,
    name: String(m.name ?? '').trim() || 'Материал',
    unit: String(m.unit ?? 'шт').trim() || 'шт',
    qtyIn: Math.max(0, Number(m.qtyIn) || 0),
    qtyOut: Math.max(0, Number(m.qtyOut) || 0),
    zoneIds: Array.isArray(m.zoneIds) ? m.zoneIds.filter(Boolean) : [],
    note: String(m.note ?? ''),
    createdAt: m.createdAt || new Date().toISOString(),
    updatedAt: m.updatedAt || m.createdAt || new Date().toISOString(),
  }));
}

function normalizeZonePhotos(raw: ZonePhoto[] | undefined): ZonePhoto[] {
  return (raw ?? [])
    .filter((p) => p && p.dataUrl && p.zoneId)
    .map((p) => ({
      ...p,
      kind:
        p.kind === 'before' || p.kind === 'process' || p.kind === 'after'
          ? p.kind
          : 'process',
      caption: String(p.caption ?? ''),
      takenAt: p.takenAt || p.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      createdAt: p.createdAt || new Date().toISOString(),
    }));
}

/** Нормализация уже v2 (или почти v2) */
export function normalizeAppData(raw: Partial<AppData> & { version?: number }): AppData {
  return {
    version: APP_DATA_VERSION,
    project: raw.project ?? {
      name: 'Мой ремонт',
      startDate: new Date().toISOString().slice(0, 10),
      totalBudget: 0,
      activeZones: [],
    },
    zones: raw.zones ?? [],
    categories: raw.categories ?? [],
    stages: raw.stages ?? [],
    contractors: raw.contractors ?? [],
    estimateItems: normalizeEstimateItems(raw.estimateItems),
    expenses: (raw.expenses ?? []).map((e) => normalizeExpense(e)),
    wishlistItems: (raw.wishlistItems ?? []).map((w) =>
      normalizeWishlistItem(w as WishlistItem),
    ),
    materials: normalizeMaterials(raw.materials),
    zonePhotos: normalizeZonePhotos(raw.zonePhotos),
    settings: raw.settings ?? { theme: 'system' },
  };
}

/** v1 → v2 */
export function migrateV1ToV2(raw: AppDataV1 | (Partial<AppData> & { version: 1 })): AppData {
  return normalizeAppData({
    ...raw,
    version: APP_DATA_VERSION,
    materials: [],
    zonePhotos: [],
  });
}

/**
 * Принимает export JSON любой поддерживаемой версии.
 * @throws если version отсутствует или неизвестна
 */
export function migrateToLatest(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Неверный формат файла');
  }
  const data = raw as { version?: number };
  if (data.version === 1) {
    return migrateV1ToV2(data as AppDataV1);
  }
  if (data.version === 2 || data.version === APP_DATA_VERSION) {
    return normalizeAppData(data as Partial<AppData>);
  }
  // Данные без version, но с полями — пробуем как v1
  if (
    'project' in (raw as object) &&
    (data.version == null || data.version === undefined)
  ) {
    return migrateV1ToV2({ ...(raw as object), version: 1 } as AppDataV1);
  }
  throw new Error(
    `Неподдерживаемая версия данных: ${String(data.version)}. Ожидается 1 или ${APP_DATA_VERSION}.`,
  );
}

export function isSupportedDataVersion(v: unknown): v is 1 | 2 {
  return v === 1 || v === 2;
}
