import { isFirebaseConfigured } from '../../config/firebase';

jest.mock('../../config/firebase', () => ({
  isFirebaseConfigured: jest.fn().mockReturnValue(false),
  getFirebaseAuth: jest.fn(),
  getFirestoreDb: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signInAnonymously: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn((_, callback) => {
    callback(null);
    return jest.fn();
  }),
  updateProfile: jest.fn(),
  updatePassword: jest.fn(),
  reauthenticateWithCredential: jest.fn(),
  EmailAuthProvider: { credential: jest.fn() },
  deleteUser: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  serverTimestamp: jest.fn(),
}));

import { getCurrentUser as getUser, onAuthChange } from '../../services/authService';

describe('authService', () => {
  it('getCurrentUser returns null when Firebase is not configured', () => {
    (isFirebaseConfigured as jest.Mock).mockReturnValue(false);
    const user = getUser();
    expect(user).toBeNull();
  });

  it('onAuthChange calls callback with null when Firebase is not configured', () => {
    (isFirebaseConfigured as jest.Mock).mockReturnValue(false);
    const callback = jest.fn();
    const unsub = onAuthChange(callback);

    expect(callback).toHaveBeenCalledWith(null);
    expect(typeof unsub).toBe('function');
  });
});
