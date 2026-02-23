/**
 * Legislation Update Service
 *
 * Polls legislation sources for updates using:
 * - QLD API (JSON endpoint)
 * - NSW/WA RSS feeds
 * - Federal legislation.gov.au hash-based change detection
 * - AustLII fallback for other jurisdictions
 *
 * Runs on a configurable schedule and logs all polling results
 * to the legislation_update_log table for audit trail.
 */

import {
  getAllLegislation,
  getLegislationById,
  updateLegislationHash,
  addUpdateLog,
  addLegislationUpdate,
  getLastCheckTime,
} from '../database/legislationRepository';
import { Legislation } from '../types';

// ---- Configuration ----

/** Minimum interval between full update checks (ms) - default 7 days */
const MIN_CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/** Known RSS feed URLs for state legislation updates */
const RSS_FEEDS: Record<string, string> = {
  NSW: 'https://legislation.nsw.gov.au/rss',
  WA: 'https://www.legislation.wa.gov.au/legislation/statutes.nsf/feeds.html',
};

/** QLD API configuration */
const QLD_API_BASE = 'https://api.legislation.qld.gov.au/v1';

/** Federal legislation browse page for polling */
const FEDERAL_BROWSE_URL = 'https://www.legislation.gov.au/browse';

// ---- Public API ----

export interface UpdateCheckResult {
  legislationId: string;
  shortTitle: string;
  jurisdiction: string;
  changed: boolean;
  changeType?: string;
  error?: string;
}

/**
 * Check all legislation for updates.
 * Returns results for each item checked.
 * Safe to call frequently - skips if last check was within MIN_CHECK_INTERVAL_MS.
 */
export async function checkForUpdates(force = false): Promise<UpdateCheckResult[]> {
  if (!force) {
    const lastCheck = await getLastCheckTime();
    if (lastCheck) {
      const elapsed = Date.now() - new Date(lastCheck).getTime();
      if (elapsed < MIN_CHECK_INTERVAL_MS) {
        return []; // Too soon, skip
      }
    }
  }

  const allLegislation = await getAllLegislation();
  const results: UpdateCheckResult[] = [];

  for (const item of allLegislation) {
    try {
      const result = await checkSingleLegislation(item);
      results.push(result);
    } catch (err) {
      results.push({
        legislationId: item.id,
        shortTitle: item.shortTitle,
        jurisdiction: item.jurisdiction,
        changed: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Check a single legislation item for updates.
 * Uses the appropriate method based on jurisdiction.
 */
async function checkSingleLegislation(item: Legislation): Promise<UpdateCheckResult> {
  const baseResult = {
    legislationId: item.id,
    shortTitle: item.shortTitle,
    jurisdiction: item.jurisdiction,
  };

  // Choose strategy based on jurisdiction
  if (item.jurisdiction === 'QLD' && item.fullTextUrl?.includes('api.legislation.qld.gov.au')) {
    return checkViaQldApi(item, baseResult);
  }

  if (item.jurisdiction === 'Federal') {
    return checkViaFetchHash(item, baseResult);
  }

  if (RSS_FEEDS[item.jurisdiction]) {
    return checkViaRssFeed(item, baseResult);
  }

  // Default: fetch page and compare hash
  return checkViaFetchHash(item, baseResult);
}

// ---- QLD API Strategy ----

async function checkViaQldApi(
  item: Legislation,
  baseResult: Pick<UpdateCheckResult, 'legislationId' | 'shortTitle' | 'jurisdiction'>,
): Promise<UpdateCheckResult> {
  try {
    const response = await fetch(item.fullTextUrl!, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { ...baseResult, changed: false, error: `QLD API returned ${response.status}` };
    }

    const data = await response.json();
    const newHash = await computeHash(JSON.stringify(data));
    const previousHash = item.contentHash;
    const newVersionDate = data?.version_date || data?.lastAmended || undefined;

    if (previousHash && previousHash !== newHash) {
      // Content changed
      await updateLegislationHash(item.id, newHash, newVersionDate);
      await addUpdateLog({
        legislationId: item.id,
        changeType: 'hash_mismatch',
        previousHash,
        newHash,
        previousVersionDate: item.versionDate,
        newVersionDate,
        sourceUrl: item.fullTextUrl!,
      });
      await addLegislationUpdate({
        legislationId: item.id,
        title: `${item.shortTitle} - Content Update Detected`,
        summary: `A change was detected in the ${item.shortTitle} via the QLD legislation API. Please verify at the official source.`,
        sourceUrl: item.fullTextUrl!,
        publishedAt: new Date().toISOString(),
        isRead: false,
      });
      return { ...baseResult, changed: true, changeType: 'hash_mismatch' };
    }

    // No change - still update last_checked
    await updateLegislationHash(item.id, newHash || previousHash || '', newVersionDate);
    await addUpdateLog({
      legislationId: item.id,
      changeType: 'no_change',
      previousHash,
      newHash,
      sourceUrl: item.fullTextUrl!,
    });
    return { ...baseResult, changed: false };
  } catch (err) {
    return { ...baseResult, changed: false, error: err instanceof Error ? err.message : 'QLD API error' };
  }
}

// ---- Fetch + Hash Strategy (Federal and fallback) ----

async function checkViaFetchHash(
  item: Legislation,
  baseResult: Pick<UpdateCheckResult, 'legislationId' | 'shortTitle' | 'jurisdiction'>,
): Promise<UpdateCheckResult> {
  try {
    const targetUrl = item.fullTextUrl || item.url;
    const response = await fetch(targetUrl, {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { ...baseResult, changed: false, error: `HTTP ${response.status}` };
    }

    const text = await response.text();
    const newHash = await computeHash(text);
    const previousHash = item.contentHash;

    if (previousHash && previousHash !== newHash) {
      await updateLegislationHash(item.id, newHash);
      await addUpdateLog({
        legislationId: item.id,
        changeType: 'hash_mismatch',
        previousHash,
        newHash,
        sourceUrl: targetUrl,
      });
      await addLegislationUpdate({
        legislationId: item.id,
        title: `${item.shortTitle} - Update Detected`,
        summary: `Content change detected for ${item.title}. Please verify at the official source: ${item.url}`,
        sourceUrl: targetUrl,
        publishedAt: new Date().toISOString(),
        isRead: false,
      });
      return { ...baseResult, changed: true, changeType: 'hash_mismatch' };
    }

    // First check or no change
    await updateLegislationHash(item.id, newHash);
    await addUpdateLog({
      legislationId: item.id,
      changeType: 'no_change',
      previousHash,
      newHash,
      sourceUrl: targetUrl,
    });
    return { ...baseResult, changed: false };
  } catch (err) {
    return { ...baseResult, changed: false, error: err instanceof Error ? err.message : 'Fetch error' };
  }
}

// ---- RSS Feed Strategy ----

async function checkViaRssFeed(
  item: Legislation,
  baseResult: Pick<UpdateCheckResult, 'legislationId' | 'shortTitle' | 'jurisdiction'>,
): Promise<UpdateCheckResult> {
  try {
    const feedUrl = RSS_FEEDS[item.jurisdiction];
    if (!feedUrl) {
      return checkViaFetchHash(item, baseResult);
    }

    const response = await fetch(feedUrl, {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      // Fallback to hash check
      return checkViaFetchHash(item, baseResult);
    }

    const text = await response.text();

    // Search for the act name in RSS content (simple text match)
    const actNamePattern = item.title.replace(/\(.*?\)/g, '').trim().toLowerCase();
    const hasMatch = text.toLowerCase().includes(actNamePattern);

    if (hasMatch) {
      // RSS mentions this act - likely an update
      const previousHash = item.contentHash;
      const newHash = await computeHash(text + item.id);

      if (previousHash !== newHash) {
        await updateLegislationHash(item.id, newHash);
        await addUpdateLog({
          legislationId: item.id,
          changeType: 'rss_update',
          previousHash,
          newHash,
          sourceUrl: feedUrl,
        });
        await addLegislationUpdate({
          legislationId: item.id,
          title: `${item.shortTitle} - RSS Update`,
          summary: `The ${item.jurisdiction} legislation RSS feed mentions an update to ${item.shortTitle}. Verify at the official source.`,
          sourceUrl: feedUrl,
          publishedAt: new Date().toISOString(),
          isRead: false,
        });
        return { ...baseResult, changed: true, changeType: 'rss_update' };
      }
    }

    // No relevant updates in RSS
    await addUpdateLog({
      legislationId: item.id,
      changeType: 'no_change',
      sourceUrl: feedUrl,
    });
    return { ...baseResult, changed: false };
  } catch {
    // Fallback to hash check
    return checkViaFetchHash(item, baseResult);
  }
}

// ---- Utility ----

/**
 * Compute a simple hash of content for change detection.
 * Uses Web Crypto API (available in React Native via expo-crypto).
 */
async function computeHash(content: string): Promise<string> {
  try {
    // Try expo-crypto if available
    const { digestStringAsync, CryptoDigestAlgorithm } = await import('expo-crypto');
    return await digestStringAsync(CryptoDigestAlgorithm.SHA256, content);
  } catch {
    // Fallback: simple string hash for environments where expo-crypto isn't available
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return 'simple-' + Math.abs(hash).toString(16);
  }
}
