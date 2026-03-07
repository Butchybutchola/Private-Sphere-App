/**
 * Legislation Update Service
 *
 * Polls legislation sources for updates using:
 * - QLD API (JSON endpoint)
 * - NSW/WA RSS feeds (with proper XML item extraction)
 * - Federal legislation.gov.au hash-based change detection
 * - AustLII fallback for other jurisdictions
 *
 * Runs on a configurable schedule and logs all polling results
 * to the legislation_update_log table for audit trail.
 */

import {
  getAllLegislation,
  updateLegislationHash,
  addUpdateLog,
  addLegislationUpdate,
  getLastCheckTime,
} from '../database/legislationRepository';
import { Legislation } from '../types';
import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';

// ---- Configuration ----

/** Minimum interval between full update checks (ms) — default 7 days */
const MIN_CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/** Known RSS feed URLs for state legislation updates */
const RSS_FEEDS: Record<string, string> = {
  NSW: 'https://legislation.nsw.gov.au/rss',
  WA: 'https://www.legislation.wa.gov.au/legislation/statutes.nsf/feeds.html',
};

/** QLD API base URL */
const QLD_API_BASE = 'https://api.legislation.qld.gov.au/v1';

// ---- Public types ----

export interface UpdateCheckResult {
  legislationId: string;
  shortTitle: string;
  jurisdiction: string;
  changed: boolean;
  changeType?: string;
  error?: string;
}

export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate?: string;
  guid?: string;
}

// ---- Public API ----

/**
 * Check all legislation for updates.
 * Returns results for each item checked.
 * Safe to call frequently — skips if last check was within MIN_CHECK_INTERVAL_MS.
 */
export async function checkForUpdates(force = false): Promise<UpdateCheckResult[]> {
  if (!force) {
    const lastCheck = await getLastCheckTime();
    if (lastCheck) {
      const elapsed = Date.now() - new Date(lastCheck).getTime();
      if (elapsed < MIN_CHECK_INTERVAL_MS) {
        return [];
      }
    }
  }

  const allLegislation = await getAllLegislation();
  const results: UpdateCheckResult[] = [];

  // Check each legislation item, throttled to avoid hammering external APIs
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

    // Small delay between checks to be a polite API consumer
    await sleep(250);
  }

  return results;
}

/**
 * Check a single legislation item for updates.
 * Uses the appropriate strategy based on jurisdiction.
 */
async function checkSingleLegislation(item: Legislation): Promise<UpdateCheckResult> {
  const base = {
    legislationId: item.id,
    shortTitle: item.shortTitle,
    jurisdiction: item.jurisdiction,
  };

  if (item.jurisdiction === 'QLD' && item.fullTextUrl?.includes('api.legislation.qld.gov.au')) {
    return checkViaQldApi(item, base);
  }

  if (item.jurisdiction === 'Federal') {
    return checkViaFetchHash(item, base);
  }

  if (RSS_FEEDS[item.jurisdiction]) {
    return checkViaRssFeed(item, base);
  }

  return checkViaFetchHash(item, base);
}

// ---- QLD API Strategy ----

async function checkViaQldApi(
  item: Legislation,
  base: Pick<UpdateCheckResult, 'legislationId' | 'shortTitle' | 'jurisdiction'>,
): Promise<UpdateCheckResult> {
  try {
    const response = await fetch(item.fullTextUrl!, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { ...base, changed: false, error: `QLD API returned ${response.status}` };
    }

    const data = await response.json();
    const newHash = await computeHash(JSON.stringify(data));
    const previousHash = item.contentHash;
    const newVersionDate = data?.version_date || data?.lastAmended || undefined;

    if (previousHash && previousHash !== newHash) {
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
        title: `${item.shortTitle} — Content Update Detected`,
        summary: `A change was detected in ${item.shortTitle} via the QLD legislation API. Please verify at the official source.`,
        sourceUrl: item.fullTextUrl!,
        publishedAt: new Date().toISOString(),
        isRead: false,
      });
      return { ...base, changed: true, changeType: 'hash_mismatch' };
    }

    await updateLegislationHash(item.id, newHash || previousHash || '', newVersionDate);
    await addUpdateLog({
      legislationId: item.id,
      changeType: 'no_change',
      previousHash,
      newHash,
      sourceUrl: item.fullTextUrl!,
    });
    return { ...base, changed: false };
  } catch (err) {
    return { ...base, changed: false, error: err instanceof Error ? err.message : 'QLD API error' };
  }
}

// ---- Fetch + Hash Strategy (Federal and fallback) ----

async function checkViaFetchHash(
  item: Legislation,
  base: Pick<UpdateCheckResult, 'legislationId' | 'shortTitle' | 'jurisdiction'>,
): Promise<UpdateCheckResult> {
  try {
    const targetUrl = item.fullTextUrl || item.url;
    const response = await fetch(targetUrl, {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { ...base, changed: false, error: `HTTP ${response.status}` };
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
        title: `${item.shortTitle} — Update Detected`,
        summary: `Content change detected for ${item.title}. Please verify at the official source: ${item.url}`,
        sourceUrl: targetUrl,
        publishedAt: new Date().toISOString(),
        isRead: false,
      });
      return { ...base, changed: true, changeType: 'hash_mismatch' };
    }

    await updateLegislationHash(item.id, newHash);
    await addUpdateLog({
      legislationId: item.id,
      changeType: 'no_change',
      previousHash,
      newHash,
      sourceUrl: targetUrl,
    });
    return { ...base, changed: false };
  } catch (err) {
    return { ...base, changed: false, error: err instanceof Error ? err.message : 'Fetch error' };
  }
}

// ---- RSS Feed Strategy ----

async function checkViaRssFeed(
  item: Legislation,
  base: Pick<UpdateCheckResult, 'legislationId' | 'shortTitle' | 'jurisdiction'>,
): Promise<UpdateCheckResult> {
  try {
    const feedUrl = RSS_FEEDS[item.jurisdiction];
    if (!feedUrl) {
      return checkViaFetchHash(item, base);
    }

    const response = await fetch(feedUrl, { signal: AbortSignal.timeout(15000) });

    if (!response.ok) {
      return checkViaFetchHash(item, base);
    }

    const xmlText = await response.text();
    const feedItems = parseRssFeed(xmlText);

    // Match feed items against this legislation by title keywords
    const matchedItem = findMatchingFeedItem(item, feedItems);

    if (matchedItem) {
      // An RSS item matching this act was found — compute hash to detect if it's new
      const itemSignature = `${matchedItem.title}|${matchedItem.link}|${matchedItem.pubDate ?? ''}`;
      const newHash = await computeHash(itemSignature);
      const previousHash = item.contentHash;

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
          title: matchedItem.title || `${item.shortTitle} — RSS Update`,
          summary:
            matchedItem.description ||
            `The ${item.jurisdiction} legislation RSS feed reports an update to ${item.shortTitle}. Verify at the official source.`,
          sourceUrl: matchedItem.link || feedUrl,
          publishedAt: matchedItem.pubDate || new Date().toISOString(),
          isRead: false,
        });
        return { ...base, changed: true, changeType: 'rss_update' };
      }
    }

    // No new updates for this act in the feed
    await addUpdateLog({
      legislationId: item.id,
      changeType: 'no_change',
      sourceUrl: feedUrl,
    });
    return { ...base, changed: false };
  } catch {
    return checkViaFetchHash(item, base);
  }
}

// ---- RSS XML Parsing ----

/**
 * Parse an RSS 2.0 or Atom feed XML string into a list of items.
 * Uses lightweight regex extraction — no DOMParser dependency.
 */
export function parseRssFeed(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const isAtom = xml.includes('<feed') && xml.includes('xmlns="http://www.w3.org/2005/Atom"');

  if (isAtom) {
    return parseAtomFeed(xml);
  }

  // RSS 2.0: extract <item>...</item> blocks
  const itemPattern = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(xml)) !== null) {
    const block = match[1];
    items.push({
      title: extractXmlText(block, 'title'),
      link: extractXmlText(block, 'link') || extractXmlCdata(block, 'link'),
      description: extractXmlCdata(block, 'description') || extractXmlText(block, 'description'),
      pubDate: extractXmlText(block, 'pubDate'),
      guid: extractXmlText(block, 'guid') || extractXmlCdata(block, 'guid'),
    });
  }

  return items;
}

function parseAtomFeed(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const entryPattern = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  let match: RegExpExecArray | null;

  while ((match = entryPattern.exec(xml)) !== null) {
    const block = match[1];
    // Atom link: <link href="..." />
    const linkMatch = block.match(/<link[^>]+href="([^"]+)"/i);
    items.push({
      title: extractXmlText(block, 'title'),
      link: linkMatch?.[1] || '',
      description: extractXmlText(block, 'summary') || extractXmlText(block, 'content'),
      pubDate: extractXmlText(block, 'updated') || extractXmlText(block, 'published'),
      guid: extractXmlText(block, 'id'),
    });
  }

  return items;
}

/** Extract text content of a simple XML element (no CDATA). */
function extractXmlText(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'));
  return match ? decodeHtmlEntities(match[1].trim()) : '';
}

/** Extract text from a CDATA-wrapped XML element. */
function extractXmlCdata(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Find the RSS item that most likely corresponds to a legislation record.
 * Matches on significant words from the short title (ignoring common words).
 */
function findMatchingFeedItem(item: Legislation, feedItems: RssItem[]): RssItem | undefined {
  const STOP_WORDS = new Set(['act', 'the', 'of', 'and', 'for', 'a', 'in', 'to', 'no']);

  // Extract significant keywords from the legislation short title
  const keywords = item.shortTitle
    .toLowerCase()
    .replace(/[()[\]]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  if (keywords.length === 0) return undefined;

  // Score each feed item: count how many keywords appear in the title
  let bestScore = 0;
  let bestItem: RssItem | undefined;

  for (const feedItem of feedItems) {
    const titleLower = feedItem.title.toLowerCase();
    const score = keywords.filter(kw => titleLower.includes(kw)).length;

    // Require at least half the keywords to match, and at least 2 matches
    if (score >= Math.max(2, Math.ceil(keywords.length / 2)) && score > bestScore) {
      bestScore = score;
      bestItem = feedItem;
    }
  }

  return bestItem;
}

// ---- Utilities ----

/**
 * Compute a SHA-256 hash of content for change detection.
 */
async function computeHash(content: string): Promise<string> {
  try {
    return digestStringAsync(CryptoDigestAlgorithm.SHA256, content);
  } catch {
    // Fallback: djb2 hash for environments where expo-crypto isn't available
    let h = 5381;
    for (let i = 0; i < content.length; i++) {
      h = ((h << 5) + h) ^ content.charCodeAt(i);
      h |= 0;
    }
    return 'djb2-' + (h >>> 0).toString(16).padStart(8, '0');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
