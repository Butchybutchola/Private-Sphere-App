import { getDatabase } from './db';
import { Legislation, LegislationUpdate, LegislationUpdateLog, CourtFeedItem, LegislationJurisdiction } from '../types';
import uuid from 'react-native-uuid';

// ---- Legislation ----

export async function getAllLegislation(): Promise<Legislation[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM legislation ORDER BY jurisdiction, category, title'
  );
  return rows.map(mapLegislation);
}

export async function getLegislationByJurisdiction(jurisdiction: LegislationJurisdiction): Promise<Legislation[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM legislation WHERE jurisdiction = ? ORDER BY category, title', jurisdiction
  );
  return rows.map(mapLegislation);
}

export async function getLegislationByCategory(category: string): Promise<Legislation[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM legislation WHERE category = ? ORDER BY jurisdiction, title', category
  );
  return rows.map(mapLegislation);
}

export async function upsertLegislation(item: Omit<Legislation, 'createdAt' | 'updatedAt'>): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO legislation (id, jurisdiction, title, short_title, category, description, url, full_text_url, last_amended, version_date, content_hash, key_provisions, last_checked, attribution, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title, short_title = excluded.short_title,
       description = excluded.description, url = excluded.url,
       full_text_url = excluded.full_text_url,
       last_amended = excluded.last_amended, version_date = excluded.version_date,
       content_hash = excluded.content_hash, key_provisions = excluded.key_provisions,
       last_checked = excluded.last_checked, attribution = excluded.attribution,
       updated_at = ?`,
    item.id, item.jurisdiction, item.title, item.shortTitle,
    item.category, item.description, item.url, item.fullTextUrl || null,
    item.lastAmended || null, item.versionDate || null, item.contentHash || null,
    item.keyProvisions, item.lastChecked, item.attribution || null,
    now, now, now
  );
}

export async function updateLegislationHash(id: string, contentHash: string, versionDate?: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE legislation SET content_hash = ?, version_date = ?, last_checked = ?, updated_at = ? WHERE id = ?',
    contentHash, versionDate || null, now, now, id
  );
}

export async function getLegislationById(id: string): Promise<Legislation | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    'SELECT * FROM legislation WHERE id = ?', id
  );
  return row ? mapLegislation(row) : null;
}

function mapLegislation(row: Record<string, unknown>): Legislation {
  return {
    id: row.id as string,
    jurisdiction: row.jurisdiction as LegislationJurisdiction,
    title: row.title as string,
    shortTitle: row.short_title as string,
    category: row.category as Legislation['category'],
    description: row.description as string,
    url: row.url as string,
    fullTextUrl: row.full_text_url as string | undefined,
    lastAmended: row.last_amended as string | undefined,
    versionDate: row.version_date as string | undefined,
    contentHash: row.content_hash as string | undefined,
    keyProvisions: row.key_provisions as string,
    lastChecked: row.last_checked as string,
    attribution: row.attribution as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ---- Legislation Updates ----

export async function addLegislationUpdate(update: Omit<LegislationUpdate, 'id' | 'createdAt'>): Promise<LegislationUpdate> {
  const db = await getDatabase();
  const id = uuid.v4() as string;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO legislation_updates (id, legislation_id, title, summary, effective_date, source_url, published_at, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, update.legislationId, update.title, update.summary,
    update.effectiveDate || null, update.sourceUrl, update.publishedAt,
    update.isRead ? 1 : 0, now
  );

  return { id, ...update, createdAt: now };
}

export async function getLegislationUpdates(limit = 50): Promise<LegislationUpdate[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM legislation_updates ORDER BY published_at DESC LIMIT ?', limit
  );
  return rows.map(mapLegislationUpdate);
}

export async function markUpdateRead(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE legislation_updates SET is_read = 1 WHERE id = ?', id);
}

export async function getUnreadUpdateCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM legislation_updates WHERE is_read = 0');
  return row?.count || 0;
}

function mapLegislationUpdate(row: Record<string, unknown>): LegislationUpdate {
  return {
    id: row.id as string,
    legislationId: row.legislation_id as string,
    title: row.title as string,
    summary: row.summary as string,
    effectiveDate: row.effective_date as string | undefined,
    sourceUrl: row.source_url as string,
    publishedAt: row.published_at as string,
    isRead: row.is_read === 1,
    createdAt: row.created_at as string,
  };
}

// ---- Court Feed ----

export async function addCourtFeedItem(item: Omit<CourtFeedItem, 'id' | 'createdAt'>): Promise<CourtFeedItem> {
  const db = await getDatabase();
  const id = uuid.v4() as string;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO court_feed (id, court, jurisdiction, title, summary, url, category, published_at, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, item.court, item.jurisdiction, item.title, item.summary,
    item.url, item.category, item.publishedAt, item.isRead ? 1 : 0, now
  );

  return { id, ...item, createdAt: now };
}

export async function getCourtFeed(jurisdiction?: LegislationJurisdiction, limit = 50): Promise<CourtFeedItem[]> {
  const db = await getDatabase();
  let query = 'SELECT * FROM court_feed';
  const params: (string | number | boolean | null)[] = [];

  if (jurisdiction) {
    query += ' WHERE jurisdiction = ?';
    params.push(jurisdiction);
  }

  query += ' ORDER BY published_at DESC LIMIT ?';
  params.push(limit);

  const rows = await db.getAllAsync<Record<string, unknown>>(query, ...params);
  return rows.map(mapCourtFeedItem);
}

export async function markFeedItemRead(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE court_feed SET is_read = 1 WHERE id = ?', id);
}

function mapCourtFeedItem(row: Record<string, unknown>): CourtFeedItem {
  return {
    id: row.id as string,
    court: row.court as string,
    jurisdiction: row.jurisdiction as LegislationJurisdiction,
    title: row.title as string,
    summary: row.summary as string,
    url: row.url as string,
    category: row.category as CourtFeedItem['category'],
    publishedAt: row.published_at as string,
    isRead: row.is_read === 1,
    createdAt: row.created_at as string,
  };
}

// ---- Legislation Update Log ----

export async function addUpdateLog(log: Omit<LegislationUpdateLog, 'id' | 'timestamp'>): Promise<LegislationUpdateLog> {
  const db = await getDatabase();
  const id = uuid.v4() as string;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO legislation_update_log (id, legislation_id, change_type, previous_hash, new_hash, previous_version_date, new_version_date, source_url, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, log.legislationId, log.changeType,
    log.previousHash || null, log.newHash || null,
    log.previousVersionDate || null, log.newVersionDate || null,
    log.sourceUrl, now
  );

  return { id, ...log, timestamp: now };
}

export async function getUpdateLogs(legislationId?: string, limit = 50): Promise<LegislationUpdateLog[]> {
  const db = await getDatabase();
  let query = 'SELECT * FROM legislation_update_log';
  const params: (string | number | boolean | null)[] = [];

  if (legislationId) {
    query += ' WHERE legislation_id = ?';
    params.push(legislationId);
  }

  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);

  const rows = await db.getAllAsync<Record<string, unknown>>(query, ...params);
  return rows.map(mapUpdateLog);
}

export async function getLastCheckTime(): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ latest: string | null }>(
    'SELECT MAX(last_checked) as latest FROM legislation'
  );
  return row?.latest || null;
}

export async function getJurisdictionStats(): Promise<Record<string, number>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ jurisdiction: string; count: number }>(
    'SELECT jurisdiction, COUNT(*) as count FROM legislation GROUP BY jurisdiction ORDER BY jurisdiction'
  );
  const stats: Record<string, number> = {};
  for (const row of rows) {
    stats[row.jurisdiction] = row.count;
  }
  return stats;
}

function mapUpdateLog(row: Record<string, unknown>): LegislationUpdateLog {
  return {
    id: row.id as string,
    legislationId: row.legislation_id as string,
    changeType: row.change_type as LegislationUpdateLog['changeType'],
    previousHash: row.previous_hash as string | undefined,
    newHash: row.new_hash as string | undefined,
    previousVersionDate: row.previous_version_date as string | undefined,
    newVersionDate: row.new_version_date as string | undefined,
    sourceUrl: row.source_url as string,
    timestamp: row.timestamp as string,
  };
}
