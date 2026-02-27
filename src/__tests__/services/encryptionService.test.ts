import { encryptString, decryptString, getOrCreateEncryptionKey } from '../../services/encryptionService';

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
});
