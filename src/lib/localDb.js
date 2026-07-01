import { openDB } from 'idb';

const DB_NAME = 'carrinhocerto-db';
const DB_VERSION = 1;
const STORE_NAME = 'cars';

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('by-updatedAt', 'updatedAt');
      store.createIndex('by-nameNormalized', 'nameNormalized');
      store.createIndex('by-isFavorite', 'isFavorite');
    }
  },
});

export async function getAllLocalCars() {
  return (await dbPromise).getAll(STORE_NAME);
}

export async function saveLocalCar(car) {
  return (await dbPromise).put(STORE_NAME, car);
}

export async function saveLocalCars(cars) {
  const db = await dbPromise;
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await Promise.all(cars.map((car) => tx.store.put(car)));
  await tx.done;
}

export async function removeLocalCar(id) {
  return (await dbPromise).delete(STORE_NAME, id);
}

export async function clearLocalCars() {
  return (await dbPromise).clear(STORE_NAME);
}