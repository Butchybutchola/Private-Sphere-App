/**
 * Firebase Configuration
 *
 * Initialize Firebase services for Evidence Guardian.
 * Config values should come from environment/secure storage in production.
 *
 * SETUP: Replace the placeholder config below with your Firebase project credentials.
 * Get these from: Firebase Console > Project Settings > General > Your Apps > Web App
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { initializeAuth, Auth } from 'firebase/auth';
// @ts-expect-error – React Native persistence lives in a sub-path since Firebase v11
import { getReactNativePersistence } from 'firebase/auth/react-native';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBc_ogfELglUD-KRvCYYwgzLhrhxQyhDCI',
  authDomain: 'evidence-guardian.firebaseapp.com',
  projectId: 'evidence-guardian',
  storageBucket: 'evidence-guardian.firebasestorage.app',
  messagingSenderId: '284116413852',
  appId: '1:284116413852:web:df6a3df4ea7d546577ac59',
  measurementId: 'G-TPS8WBZR6C',
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      app = existingApps[0];
    } else {
      app = initializeApp(firebaseConfig);
    }
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = initializeAuth(getFirebaseApp(), {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
  return auth;
}

export function getFirestoreDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(getFirebaseApp());
  }
  return storage;
}

export function isFirebaseConfigured(): boolean {
  return firebaseConfig.apiKey !== 'YOUR_API_KEY';
}
