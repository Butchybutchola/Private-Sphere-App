// DeviceInfo caches the device ID at module level, so re-import each test
let getDeviceId: typeof import('../../services/deviceInfo').getDeviceId;
let getDevicePlatform: typeof import('../../services/deviceInfo').getDevicePlatform;
let getAppVersion: typeof import('../../services/deviceInfo').getAppVersion;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();

  const mod = require('../../services/deviceInfo');
  getDeviceId = mod.getDeviceId;
  getDevicePlatform = mod.getDevicePlatform;
  getAppVersion = mod.getAppVersion;
});

describe('deviceInfo', () => {
  describe('getDeviceId', () => {
    it('returns a UUID string', async () => {
      const id = await getDeviceId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('returns same ID on repeated calls (caching)', async () => {
      const id1 = await getDeviceId();
      const id2 = await getDeviceId();
      expect(id1).toBe(id2);
    });
  });

  describe('getDevicePlatform', () => {
    it('returns a platform string containing OS', () => {
      const platform = getDevicePlatform();
      expect(platform).toContain('ios');
    });
  });

  describe('getAppVersion', () => {
    it('returns MVP version string', () => {
      expect(getAppVersion()).toBe('1.0.0-mvp');
    });
  });
});
