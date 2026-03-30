import { encryptString, decryptString, getOrCreateEncryptionKey, rotateEncryptionKey } from '../../services/encryptionService';

describe('encryptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateEncryptionKey', () => {
    it('returns a non-empty hex string', async () => {
      const key = await getOrCreateEncryptionKey();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });
  });

  describe('encryptString / decryptString (AES-256-GCM)', () => {
    it('encrypts and decrypts a string round-trip', async () => {
      const plaintext = 'sensitive evidence data';
      const encrypted = await encryptString(plaintext);

      // Should use EG2 format: EG2:<iv_b64>:<cipher_b64>
      expect(encrypted.startsWith('EG2:')).toBe(true);
      const parts = encrypted.split(':');
      expect(parts.length).toBe(3);

      const decrypted = await decryptString(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertexts for the same plaintext (random IV)', async () => {
      const plaintext = 'same input';
      const enc1 = await encryptString(plaintext);
      const enc2 = await encryptString(plaintext);
      expect(enc1).not.toBe(enc2);
    });

    it('rejects an unrecognised format prefix', async () => {
      await expect(decryptString('INVALID:data')).rejects.toThrow('Invalid encrypted format');
    });

    it('rejects a corrupted EG2 payload (wrong part count)', async () => {
      await expect(decryptString('EG2:a:b:c')).rejects.toThrow('Corrupted encrypted data');
    });
  });

  describe('backward compatibility — EG1 (MVP base64) format', () => {
    it('decrypts a valid EG1 ciphertext', async () => {
      // EG1 format: EG2 prefix was base64(plaintext) with an integrity tag
      const plaintext = 'legacy record';
      const eg1 = `EG1:${btoa(plaintext)}:deadbeef01234567`;
      const result = await decryptString(eg1);
      expect(result).toBe(plaintext);
    });

    it('rejects a corrupted EG1 payload (wrong part count)', async () => {
      await expect(decryptString('EG1:onlytwoparts')).rejects.toThrow('Corrupted EG1 data');
    });
  });

  describe('rotateEncryptionKey', () => {
    it('returns a non-empty newKeyId string', async () => {
      const { newKeyId } = await rotateEncryptionKey();
      expect(typeof newKeyId).toBe('string');
      expect(newKeyId.length).toBeGreaterThan(0);
    });

    it('returns an empty reEncrypted map when no ciphertexts supplied', async () => {
      const { reEncrypted } = await rotateEncryptionKey();
      expect(reEncrypted).toEqual({});
    });

    it('re-encrypts EG2 ciphertexts so they decrypt to the original plaintext', async () => {
      const plaintext = 'sensitive evidence note';
      const original = await encryptString(plaintext);
      expect(original.startsWith('EG2:')).toBe(true);

      const { reEncrypted } = await rotateEncryptionKey({ note: original });

      // Re-encrypted value must differ (new IV + new key)
      expect(reEncrypted.note).not.toBe(original);
      expect(reEncrypted.note.startsWith('EG2:')).toBe(true);

      // Must still decrypt to the same plaintext with the new key
      const recovered = await decryptString(reEncrypted.note);
      expect(recovered).toBe(plaintext);
    });

    it('passes EG1 ciphertexts through unchanged', async () => {
      const eg1 = `EG1:${btoa('legacy')}:deadbeef`;
      const { reEncrypted } = await rotateEncryptionKey({ old: eg1 });
      expect(reEncrypted.old).toBe(eg1);
    });

    it('cleans up the rotation backup key after successful rotation', async () => {
      const SecureStore = require('expo-secure-store');
      await rotateEncryptionKey();
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(
        'evidence_guardian_enc_key_rotation_backup',
      );
    });

    it('old ciphertexts cannot be decrypted after rotation (key replaced)', async () => {
      const plaintext = 'pre-rotation secret';
      const oldCipher = await encryptString(plaintext);

      // Rotate without re-encrypting oldCipher
      await rotateEncryptionKey();

      // oldCipher was encrypted with the previous key — decryption should now fail
      await expect(decryptString(oldCipher)).rejects.toThrow();
    });
  });
});
