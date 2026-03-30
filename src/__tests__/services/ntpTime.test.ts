// NTP module caches offset between calls, so we re-import fresh each test
let getNTPTime: typeof import('../../services/ntpTime').getNTPTime;
let getLastSyncInfo: typeof import('../../services/ntpTime').getLastSyncInfo;
let fetchMock: jest.Mock;

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  fetchMock = jest.fn();
  (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;

  // Re-import to reset module-level cache
  const mod = require('../../services/ntpTime');
  getNTPTime = mod.getNTPTime;
  getLastSyncInfo = mod.getLastSyncInfo;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('ntpTime', () => {
  const mockDate = '2026-02-20T12:00:00.000Z';

  it('fetches time from worldtimeapi and returns NTP result', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ utc_datetime: mockDate }),
    });

    const result = await getNTPTime();

    expect(result.utcTime).toBeDefined();
    expect(result.serverUsed).toContain('worldtimeapi');
    expect(result.accuracy).toBe('ntp');
  });

  it('falls back to second API when first fails', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ dateTime: '2026-02-20T12:00:00' }),
      });

    const result = await getNTPTime();

    expect(result.utcTime).toBeDefined();
    expect(result.serverUsed).toContain('timeapi');
    expect(result.accuracy).toBe('ntp');
  });

  it('returns device fallback when all APIs fail', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'));

    const result = await getNTPTime();

    expect(result.serverUsed).toBe('device_fallback');
    expect(result.accuracy).toBe('fallback');
    expect(result.utcTime).toBeDefined();
  });

  it('getLastSyncInfo returns offset and lastSync', () => {
    const info = getLastSyncInfo();
    expect(info).toHaveProperty('offset');
    expect(info).toHaveProperty('lastSync');
  });
});
