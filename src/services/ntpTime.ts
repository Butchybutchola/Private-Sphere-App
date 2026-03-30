/**
 * NTP Time Service
 *
 * Fetches UTC time from external time servers to prevent users from
 * faking timestamps by changing their device clock.
 *
 * Falls back to a chain of time APIs to ensure reliability.
 */

const TIME_APIS = [
  'https://worldtimeapi.org/api/timezone/Etc/UTC',
  'https://timeapi.io/api/Time/current/zone?timeZone=UTC',
];

interface NTPResult {
  utcTime: string; // ISO 8601
  serverUsed: string;
  accuracy: 'ntp' | 'fallback';
}

let cachedOffset: number | null = null;
let lastSyncTime: number | null = null;
const SYNC_INTERVAL = 5 * 60 * 1000; // Re-sync every 5 minutes

export async function getNTPTime(): Promise<NTPResult> {
  // If we have a recent offset, use it for speed
  if (cachedOffset !== null && lastSyncTime !== null) {
    const elapsed = Date.now() - lastSyncTime;
    if (elapsed < SYNC_INTERVAL) {
      const correctedTime = new Date(Date.now() + cachedOffset);
      return {
        utcTime: correctedTime.toISOString(),
        serverUsed: 'cached_offset',
        accuracy: 'ntp',
      };
    }
  }

  // Try each time API
  for (const apiUrl of TIME_APIS) {
    try {
      const localBefore = Date.now();
      const response = await fetch(apiUrl, { signal: AbortSignal.timeout(5000) });

      if (!response.ok) continue;

      const data = await response.json();
      const localAfter = Date.now();
      const localMid = (localBefore + localAfter) / 2;

      // Parse server time based on API response format
      let serverTime: Date;
      if (data.utc_datetime) {
        // worldtimeapi.org format
        serverTime = new Date(data.utc_datetime);
      } else if (data.dateTime) {
        // timeapi.io format
        serverTime = new Date(data.dateTime + 'Z');
      } else {
        continue;
      }

      // Calculate and cache offset
      cachedOffset = serverTime.getTime() - localMid;
      lastSyncTime = Date.now();

      return {
        utcTime: serverTime.toISOString(),
        serverUsed: apiUrl,
        accuracy: 'ntp',
      };
    } catch {
      // Try next API
      continue;
    }
  }

  // Final fallback: use device time but flag it
  console.warn('NTP: All time servers unreachable. Using device time as fallback.');
  return {
    utcTime: new Date().toISOString(),
    serverUsed: 'device_fallback',
    accuracy: 'fallback',
  };
}

export async function syncNTPOffset(): Promise<void> {
  await getNTPTime();
}

export function getLastSyncInfo(): { offset: number | null; lastSync: number | null } {
  return { offset: cachedOffset, lastSync: lastSyncTime };
}
