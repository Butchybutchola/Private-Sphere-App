/**
 * Authentication Service
 *
 * Manages user authentication via Firebase Auth.
 * Supports email/password and anonymous sign-in.
 *
 * No third-party analytics or tracking is attached to auth events.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  User,
  UserCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseAuth, getFirestoreDb, isFirebaseConfigured } from '../config/firebase';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
  createdAt: string;
}

function mapFirebaseUser(user: User): AppUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    isAnonymous: user.isAnonymous,
    createdAt: user.metadata.creationTime || new Date().toISOString(),
  };
}

export function getCurrentUser(): AppUser | null {
  if (!isFirebaseConfigured()) return null;
  const auth = getFirebaseAuth();
  return auth.currentUser ? mapFirebaseUser(auth.currentUser) : null;
}

export function onAuthChange(callback: (user: AppUser | null) => void): () => void {
  if (!isFirebaseConfigured()) {
    callback(null);
    return () => {};
  }
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, (firebaseUser) => {
    callback(firebaseUser ? mapFirebaseUser(firebaseUser) : null);
  });
}

export async function signUp(
  email: string,
  password: string,
  displayName?: string
): Promise<AppUser> {
  const auth = getFirebaseAuth();
  const credential: UserCredential = await createUserWithEmailAndPassword(auth, email, password);

  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }

  // Create user profile in Firestore
  const db = getFirestoreDb();
  await setDoc(doc(db, 'users', credential.user.uid), {
    email,
    displayName: displayName || null,
    plan: 'free',
    evidenceCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return mapFirebaseUser(credential.user);
}

export async function signIn(email: string, password: string): Promise<AppUser> {
  const auth = getFirebaseAuth();
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return mapFirebaseUser(credential.user);
}

export async function signInAsGuest(): Promise<AppUser> {
  const auth = getFirebaseAuth();
  const credential = await signInAnonymously(auth);

  // Create minimal user profile
  const db = getFirestoreDb();
  await setDoc(doc(db, 'users', credential.user.uid), {
    email: null,
    displayName: 'Anonymous User',
    plan: 'free',
    evidenceCount: 0,
    isAnonymous: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  return mapFirebaseUser(credential.user);
}

export async function signOut(): Promise<void> {
  const auth = getFirebaseAuth();
  await firebaseSignOut(auth);
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('No authenticated user');

  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}

export async function updateUserProfile(displayName: string): Promise<void> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');

  await updateProfile(user, { displayName });

  const db = getFirestoreDb();
  await setDoc(doc(db, 'users', user.uid), {
    displayName,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function getUserProfile(uid: string): Promise<Record<string, unknown> | null> {
  const db = getFirestoreDb();
  const snapshot = await getDoc(doc(db, 'users', uid));
  return snapshot.exists() ? (snapshot.data() as Record<string, unknown>) : null;
}

export async function deleteAccount(): Promise<void> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');
  await deleteUser(user);
}
