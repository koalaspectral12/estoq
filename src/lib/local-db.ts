import { openDB, type IDBPDatabase } from 'idb';
import type { Car } from '@/types/car';

const DB_NAME = 'carrinhocerto-next-db';
const DB_VERSION = 1;
const STORE_NAME = 'cars';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (typeof indexedDB === 'undefined') return null;

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('by-updatedAt', 'updatedAt');
          store.createIndex('by-nameNormalized', 'nameNormalized');
          store.createIndex('by-isFavorite', 'isFavorite');
        }
      },
    });
  }

  return dbPromise;
}

export async function getAllLocalCars() {
  const db = getDb();
  if (!db) return [] as Car[];
  return (await db).getAll(STORE_NAME) as Promise<Car[]>;
}

export async function saveLocalCar(car: Car) {
  const db = getDb();
  if (!db) return;
  return (await db).put(STORE_NAME, car);
}

export async function saveLocalCars(cars: Car[]) {
  const db = getDb();
  if (!db) return;
  const connection = await db;
  const tx = connection.transaction(STORE_NAME, 'readwrite');
  await Promise.all(cars.map((car) => tx.store.put(car)));
  await tx.done;
}

export async function removeLocalCar(id: string) {
  const db = getDb();
  if (!db) return;
  return (await db).delete(STORE_NAME, id);
}

export async function clearLocalCars() {
  const db = getDb();
  if (!db) return;
  return (await db).clear(STORE_NAME);
}