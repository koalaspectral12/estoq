import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadString } from 'firebase/storage';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';
import type { Car } from '@/types/car';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

export const firebaseEnabled = Object.values(firebaseConfig).every(Boolean);

const app = firebaseEnabled ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const storage = app ? getStorage(app) : null;
const provider = auth ? new GoogleAuthProvider() : null;
let analyticsInstance: Analytics | null = null;

export function listenToAuth(callback: (user: User | null) => void) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function loginWithGoogle() {
  if (!auth || !provider) throw new Error('Firebase não configurado.');
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function logoutUser() {
  if (!auth) return;
  await signOut(auth);
}

export async function fetchRemoteCars(userId: string) {
  if (!db || !userId) return [] as Car[];
  const q = query(collection(db, 'cars'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Car[];
}

export async function saveRemoteCar(userId: string, car: Car) {
  if (!db || !storage || !userId) return car;
  const payload: Car & { updatedAtServer?: unknown } = {
    ...car,
    userId,
    updatedAt: new Date().toISOString(),
    syncStatus: 'synced',
  };

  if (car.photoData && !car.photoUrl) {
    const fileRef = ref(storage, `cars/${userId}/${car.id}.jpg`);
    await uploadString(fileRef, car.photoData, 'data_url');
    payload.photoUrl = await getDownloadURL(fileRef);
  }

  await setDoc(doc(db, 'cars', car.id), { ...payload, updatedAtServer: serverTimestamp() }, { merge: true });
  return payload;
}

export async function initFirebaseAnalytics() {
  if (!app || typeof window === 'undefined') return null;
  if (analyticsInstance) return analyticsInstance;

  const supported = await isSupported().catch(() => false);
  if (!supported) return null;

  analyticsInstance = getAnalytics(app);
  return analyticsInstance;
}

export async function deleteRemoteCar(userId: string, carId: string) {
  if (!db || !userId || !carId) return;
  await deleteDoc(doc(db, 'cars', carId));
}