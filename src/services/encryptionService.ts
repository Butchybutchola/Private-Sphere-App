/**
 * Encryption Service
 *
 * Provides AES-256-GCM encryption for evidence at rest.
 * Uses the Web Crypto API (SubtleCrypto) available in Expo SDK 52+ / Hermes.
 *
 * Key storage: AES-GCM key exported as JWK and stored in expo-secure-store.
 * Ciphertext format: EG2:<iv_base64>:<ciphertext_base64>
 *
 * Backward compatibility: EG1 (MVP base64) ciphertexts are still decryptable.
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEY_STORE_V2 = 'evidence_guardian_enc_key_v2';
const KEY_STORE_V1 = 'evidence_guardian_enc_key';

// ---- SubtleCrypto access ----

function getSubtle(): SubtleCrypto {
  if (typeof globalThis.crypto?.subtle !== 'undefined') {
    return globalThis.crypto.subtle;
  }
  throw new Error('Web Crypto API (SubtleCrypto) not available in this environment');
}

// ---- Key management ----

async function getOrCreateAesKey(): Promise<CryptoKey> {
  const subtle = getSubtle();
  const stored = await SecureStore.getItemAsync(KEY_STORE_V2);

  if (stored) {
    const jwk = JSON.parse(stored) as JsonWebKey;
    return subtle.importKey(
      'jwk',
      jwk,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  // Generate a new 256-bit AES-GCM key
  const key = await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );

  const jwk = await subtle.exportKey('jwk', key);
  await SecureStore.setItemAsync(KEY_STORE_V2, JSON.stringify(jwk));
  return key;
}

// ---- Encoding helpers ----

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---- Public API ----

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a ciphertext string in EG2 format.
 */
export async function encryptString(plaintext: string): Promise<string> {
  const subtle = getSubtle();
  const key = await getOrCreateAesKey();

  // 96-bit random IV (recommended for AES-GCM)
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuffer = await subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  const ivB64 = uint8ToBase64(iv);
  const cipherB64 = uint8ToBase64(new Uint8Array(cipherBuffer));

  return `EG2:${ivB64}:${cipherB64}`;
}

/**
 * Decrypts an EG2 ciphertext string.
 * Also handles legacy EG1 (MVP base64) format for backward compatibility.
 */
export async function decryptString(ciphertext: string): Promise<string> {
  if (ciphertext.startsWith('EG1:')) {
    return decryptLegacyEg1(ciphertext);
  }

  if (!ciphertext.startsWith('EG2:')) {
    throw new Error('Invalid encrypted format');
  }

  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Corrupted encrypted data');
  }

  const subtle = getSubtle();
  const key = await getOrCreateAesKey();
  const iv = base64ToUint8(parts[1]);
  const cipherBytes = base64ToUint8(parts[2]);

  try {
    const plainBuffer = await subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBytes);
    return new TextDecoder().decode(plainBuffer);
  } catch {
    throw new Error('Decryption failed: data may be corrupted or tampered with');
  }
}

/**
 * Backward-compatible decryption for EG1 (MVP base64 format).
 * EG1 was base64-encoded plaintext with an integrity tag — not real encryption.
 * Kept so any EG1 records stored in the database can still be read.
 */
async function decryptLegacyEg1(ciphertext: string): Promise<string> {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Corrupted EG1 data');
  }
  try {
    return atob(parts[1]);
  } catch {
    throw new Error('Failed to decode legacy EG1 data');
  }
}

/**
 * Returns true if an encryption key exists in secure storage.
 */
export async function isEncryptionConfigured(): Promise<boolean> {
  const v2 = await SecureStore.getItemAsync(KEY_STORE_V2);
  if (v2) return true;
  const v1 = await SecureStore.getItemAsync(KEY_STORE_V1);
  return v1 !== null;
}

/**
 * Returns a hex string identifier derived from the encryption key.
 * Used by services that need a stable key identifier (e.g. captureEngine).
 */
export async function getOrCreateEncryptionKey(): Promise<string> {
  const stored = await SecureStore.getItemAsync(KEY_STORE_V2);

  if (stored) {
    return Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      stored,
      { encoding: Crypto.CryptoEncoding.HEX },
    );
  }

  // Trigger key creation then recurse once
  await getOrCreateAesKey();
  return getOrCreateEncryptionKey();
}
