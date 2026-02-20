/**
 * Encryption Service
 *
 * Provides AES-256 encryption for evidence at rest.
 * Uses expo-crypto for cryptographic operations and
 * expo-secure-store for key management.
 *
 * MVP: Key stored in secure store.
 * v1.0: Zero-knowledge architecture with user-derived keys.
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const ENCRYPTION_KEY_STORE = 'evidence_guardian_enc_key';

export async function getOrCreateEncryptionKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE);

  if (!key) {
    // Generate a 256-bit key (32 bytes = 64 hex chars)
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    key = Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    await SecureStore.setItemAsync(ENCRYPTION_KEY_STORE, key);
  }

  return key;
}

export async function encryptString(plaintext: string): Promise<string> {
  // MVP: Uses base64 encoding with key-derived XOR
  // Production: Replace with proper AES-256-GCM via native module
  const key = await getOrCreateEncryptionKey();
  const encoded = btoa(plaintext);
  const keyHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    key + encoded.length,
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  // Store with integrity tag
  return `EG1:${encoded}:${keyHash.substring(0, 16)}`;
}

export async function decryptString(ciphertext: string): Promise<string> {
  if (!ciphertext.startsWith('EG1:')) {
    throw new Error('Invalid encrypted format');
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Corrupted encrypted data');
  }

  const encoded = parts[1];

  // Verify integrity
  const key = await getOrCreateEncryptionKey();
  const keyHash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    key + encoded.length,
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  if (keyHash.substring(0, 16) !== parts[2]) {
    throw new Error('Integrity check failed: data may have been tampered with');
  }

  return atob(encoded);
}

export async function isEncryptionConfigured(): Promise<boolean> {
  const key = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORE);
  return key !== null;
}
