import { encryptString, decryptString, getOrCreateEncryptionKey } from '../../services/encryptionService';

describe('encryptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCreateEncryptionKey', () => {
    it('returns a hex key string', async () => {
      const key = await getOrCreateEncryptionKey();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
    });
  });

  describe('encryptString / decryptString', () => {
    it('encrypts and decrypts a string round-trip', async () => {
      const plaintext = 'sensitive evidence data';
      const encrypted = await encryptString(plaintext);

      // Should have EG1 prefix format
      expect(encrypted.startsWith('EG1:')).toBe(true);
      const parts = encrypted.split(':');
      expect(parts.length).toBe(3);

      const decrypted = await decryptString(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('rejects invalid encrypted format', async () => {
      await expect(decryptString('INVALID:data')).rejects.toThrow('Invalid encrypted format');
    });

    it('rejects corrupted data with wrong part count', async () => {
      await expect(decryptString('EG1:a:b:c')).rejects.toThrow('Corrupted encrypted data');
    });
  });
});
