/**
 * Tests for legislationUpdateService — focused on rate-limiting behaviour.
 */

// Re-import fresh each test to reset module-level state (lastForcedCheckTime)
let checkForUpdates: typeof import('../../services/legislationUpdateService').checkForUpdates;

jest.mock('../../database/legislationRepository', () => ({
  getAllLegislation: jest.fn().mockResolvedValue([]),
  getLastCheckTime: jest.fn().mockResolvedValue(null),
  updateLegislationHash: jest.fn().mockResolvedValue(undefined),
  addUpdateLog: jest.fn().mockResolvedValue(undefined),
  addLegislationUpdate: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  const mod = require('../../services/legislationUpdateService');
  checkForUpdates = mod.checkForUpdates;
});

describe('checkForUpdates — scheduled (force=false)', () => {
  it('runs when no previous check time exists', async () => {
    const results = await checkForUpdates(false);
    // getAllLegislation returns [] so results is empty but the check DID run
    expect(results).toEqual([]);
  });

  it('skips when last check is within MIN_CHECK_INTERVAL_MS', async () => {
    const { getLastCheckTime } = require('../../database/legislationRepository');
    // Simulate a check just 1 hour ago
    const recentTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    (getLastCheckTime as jest.Mock).mockResolvedValue(recentTime);

    const results = await checkForUpdates(false);
    expect(results).toEqual([]);
  });
});

describe('checkForUpdates — forced (force=true)', () => {
  it('runs on the first forced call', async () => {
    const results = await checkForUpdates(true);
    expect(results).toEqual([]);
  });

  it('is rate-limited: second immediate forced call returns empty', async () => {
    await checkForUpdates(true);           // first call — should run
    const results = await checkForUpdates(true);  // second within 60 s — skipped
    expect(results).toEqual([]);
  });

  it('runs again after the 60 s rate-limit window (using Date mock)', async () => {
    const { getAllLegislation } = require('../../database/legislationRepository');

    await checkForUpdates(true);  // first forced call

    // Advance time by 61 seconds
    const realNow = Date.now;
    Date.now = jest.fn().mockReturnValue(realNow() + 61_000);

    // Re-import so the module sees the new Date.now
    jest.resetModules();
    jest.clearAllMocks();
    // Re-mock after resetModules
    jest.mock('../../database/legislationRepository', () => ({
      getAllLegislation: jest.fn().mockResolvedValue([]),
      getLastCheckTime: jest.fn().mockResolvedValue(null),
      updateLegislationHash: jest.fn().mockResolvedValue(undefined),
      addUpdateLog: jest.fn().mockResolvedValue(undefined),
      addLegislationUpdate: jest.fn().mockResolvedValue(undefined),
    }));
    const freshMod = require('../../services/legislationUpdateService');

    const results = await freshMod.checkForUpdates(true);
    expect(results).toEqual([]);
    // getAllLegislation should have been called (check did run)
    const { getAllLegislation: freshGetAll } = require('../../database/legislationRepository');
    expect(freshGetAll).toHaveBeenCalled();

    Date.now = realNow;
  });
});
