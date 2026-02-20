/**
 * Cryptographic Hash Service
 *
 * Generates SHA-256 hashes of evidence files to create
 * tamper-proof digital fingerprints.
 */

import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';

export async function hashFile(fileUri: string): Promise<string> {
  // Read file as base64
  const fileContent = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Generate SHA-256 hash
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    fileContent,
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  return hash;
}

export async function hashString(input: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    input,
    { encoding: Crypto.CryptoEncoding.HEX }
  );

  return hash;
}

export async function verifyFileIntegrity(
  fileUri: string,
  expectedHash: string
): Promise<boolean> {
  const currentHash = await hashFile(fileUri);
  return currentHash === expectedHash;
}
