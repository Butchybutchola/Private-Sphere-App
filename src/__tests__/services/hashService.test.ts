import { hashFile, hashString, verifyFileIntegrity } from '../../services/hashService';

describe('hashService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashFile', () => {
    it('returns a 64-char hex SHA-256 hash', async () => {
      const hash = await hashFile('/mock/test.jpg');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64);
    });
  });

  describe('hashString', () => {
    it('returns a 64-char hex SHA-256 hash of input', async () => {
      const hash = await hashString('hello world');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64);
    });
  });

  describe('verifyFileIntegrity', () => {
    it('returns true when hash matches', async () => {
      // Our mock always returns the same hash
      const expectedHash = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      const result = await verifyFileIntegrity('/mock/test.jpg', expectedHash);
      expect(result).toBe(true);
    });

    it('returns false when hash does not match', async () => {
      const result = await verifyFileIntegrity('/mock/test.jpg', 'wrong_hash');
      expect(result).toBe(false);
    });
  });
});
