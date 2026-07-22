import { openDB, type IDBPDatabase } from 'idb';
import type { AppData, EstimateItem } from '../types';
import { createDefaultData } from './defaults';
import { normalizeExpense } from './expense';
import { getItemZoneIds } from './zones';

const DB_NAME = 'moy-remont';
const STORE = 'app';
const KEY = 'data';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
    });
  }
  return dbPromise;
}

function normalizeData(raw: AppData): AppData {
  const estimateItems = (raw.estimateItems ?? []).map((item) => {
    const zoneIds = getItemZoneIds(item as EstimateItem);
    const rawItem = item as EstimateItem;
    return {
      ...rawItem,
      zoneIds,
      zoneId: zoneIds[0],
      selfDonePercent: Math.min(
        100,
        Math.max(0, Number(rawItem.selfDonePercent) || 0),
      ),
      extras: Array.isArray(rawItem.extras) ? rawItem.extras : [],
    } as EstimateItem;
  });
  const expenses = (raw.expenses ?? []).map((e) => normalizeExpense(e));
  return { ...raw, estimateItems, expenses };
}

export async function loadAppData(): Promise<AppData> {
  try {
    const db = await getDb();
    const data = await db.get(STORE, KEY);
    if (data && typeof data === 'object' && data.version === 1) {
      return normalizeData(data as AppData);
    }
  } catch (e) {
    console.warn('IDB load failed', e);
  }
  return createDefaultData();
}

export async function saveAppData(data: AppData): Promise<void> {
  const db = await getDb();
  await db.put(STORE, data, KEY);
}

export async function clearAppData(): Promise<void> {
  const db = await getDb();
  await db.delete(STORE, KEY);
}
