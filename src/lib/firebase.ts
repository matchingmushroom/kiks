import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let _app: FirebaseApp | undefined;
let _auth: Auth | undefined;
let _db: Firestore | undefined;
let _storage: FirebaseStorage | undefined;

function initFirebase() {
  if (_app) return;
  if (typeof window === "undefined") return;
  if (!getApps().length) {
    _app = initializeApp(firebaseConfig);
    _auth = getAuth(_app);
    _db = getFirestore(_app);
    _storage = getStorage(_app);
  } else {
    _app = getApps()[0];
    _auth = getAuth(_app);
    _db = getFirestore(_app);
    _storage = getStorage(_app);
  }
}

initFirebase();

export const app = _app as FirebaseApp;
export const auth = _auth as Auth;
export const db = _db as Firestore;
export const storage = _storage as FirebaseStorage;
