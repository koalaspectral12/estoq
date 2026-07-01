import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseEnabled = Object.values(firebaseConfig).every(Boolean);

let app;
let auth;
let db;
let storage;
let provider;

if (firebaseEnabled) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  provider = new GoogleAuthProvider();
}

export function listenToAuth(callback) {
  if (!firebaseEnabled) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function loginWithGoogle() {
  if (!firebaseEnabled) throw new Error('Firebase não configurado');
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function logoutUser() {
  if (!firebaseEnabled) return;
  await signOut(auth);
}

export async function fetchRemoteCars(userId) {
  if (!firebaseEnabled || !userId) return [];
  const q = query(collection(db, 'cars'), where('userId', '==', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function saveRemoteCar(userId, car) {
  if (!firebaseEnabled || !userId) return car;
  const payload = { ...car, userId, updatedAt: new Date().toISOString(), updatedAtServer: serverTimestamp() };

  if (car.photoData && !car.photoUrl) {
    const fileRef = ref(storage, `cars/${userId}/${car.id}.jpg`);
    await uploadString(fileRef, car.photoData, 'data_url');
    payload.photoUrl = await getDownloadURL(fileRef);
  }

  await setDoc(doc(db, 'cars', car.id), payload, { merge: true });
  return payload;
}

export async function deleteRemoteCar(userId, carId) {
  if (!firebaseEnabled || !userId) return;
  await deleteDoc(doc(db, 'cars', carId));
}