import { openDB, type IDBPDatabase } from 'idb';
import type { AppData } from '../types';
import { createDefaultData } from './defaults';
import { migrateToLatest } from './migrate';

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

export async function loadAppData(): Promise<AppData> {
  try {
    const db = await getDb();
    const data = await db.get(STORE, KEY);
    if (data && typeof data === 'object') {
      try {
        return migrateToLatest(data);
      } catch (e) {
        console.warn('IDB migrate failed', e);
      }
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
