export type EvidenceType = 'photo' | 'video' | 'audio' | 'document';

export type EvidenceStatus = 'locked' | 'pending' | 'archived';

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  status: EvidenceStatus;
  filePath: string;
  thumbnailPath?: string;
  sha256Hash: string;
  fileSize: number;
  mimeType: string;

  // Forensic metadata
  capturedAt: string; // UTC ISO string from NTP
  deviceId: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  locationAccuracy?: number;
  sourceCapturedAt?: string;
  sourceMetadata?: string; // JSON string containing import metadata extracted from source file

  // User-provided metadata
  title?: string;
  description?: string;
  tags: string[];
  courtOrderId?: string;
  breachClause?: string;

  // Transcription
  transcription?: string;
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed';

  // Version control
  parentId?: string; // If this is a derived version
  isOriginal: boolean;
  versionNumber: number;

  createdAt: string;
  updatedAt: string;
}

export interface CourtOrder {
  id: string;
  title: string;
  filePath: string;
  sha256Hash: string;
  clauses: CourtOrderClause[];
  uploadedAt: string;
  createdAt: string;
}

export interface CourtOrderClause {
  id: string;
  courtOrderId: string;
  clauseNumber: string;
  description: string;
  createdAt: string;
}

export interface BreachLog {
  id: string;
  evidenceId: string;
  courtOrderId: string;
  clauseId: string;
  description: string;
  occurredAt: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: AuditAction;
  resourceType: 'evidence' | 'court_order' | 'breach_log' | 'report';
  resourceId: string;
  metadata?: string; // JSON string of additional context
  ipAddress?: string;
  timestamp: string;
}

export type AuditAction =
  | 'created'
  | 'viewed'
  | 'downloaded'
  | 'exported'
  | 'tagged'
  | 'transcribed'
  | 'report_generated'
  | 'deleted'
  | 'archived';

export interface ForensicMetadata {
  sha256Hash: string;
  capturedAt: string;
  ntpServerUsed: string;
  deviceId: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  locationAccuracy?: number;
  appVersion: string;
  captureMethod: 'in-app' | 'imported';
  sourceCapturedAt?: string;
  sourceMetadata?: Record<string, unknown>;
}

export interface BriefingReport {
  id: string;
  title: string;
  generatedAt: string;
  evidenceIds: string[];
  courtOrderId?: string;
  filePath: string;
  sha256Hash: string;
}

export interface AppSettings {
  biometricEnabled: boolean;
  disguisedIcon: string | null; // null = default icon
  autoLockTimeout: number; // seconds
  ntpServer: string;
  encryptionKeyId: string;
}

// ---- User Profile & Party Details ----

export type AustralianState = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  email: string;
  phone: string;
  address: string;
  suburb: string;
  state: AustralianState;
  postcode: string;
  createdAt: string;
  updatedAt: string;
}

export interface OtherParty {
  id: string;
  userId: string; // links to UserProfile
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  phone?: string;
  address?: string;
  suburb?: string;
  state?: AustralianState;
  postcode?: string;
  relationship: string; // e.g. 'ex-partner', 'spouse', 'parent'
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Child {
  id: string;
  userId: string; // links to UserProfile
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  age?: number; // computed
  livesWithUser: boolean;
  custodyArrangement?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Legislation ----

export type LegislationJurisdiction = AustralianState | 'Federal';

export interface Legislation {
  id: string;
  jurisdiction: LegislationJurisdiction;
  title: string;
  shortTitle: string;
  category: 'dv_protection' | 'family_law' | 'criminal' | 'child_protection';
  description: string;
  url: string; // link to official legislation
  fullTextUrl?: string; // direct download URL for XML/PDF
  lastAmended?: string;
  versionDate?: string; // date of current version in source
  contentHash?: string; // SHA-256 hash of content for change detection
  keyProvisions: string; // JSON array of key sections
  lastChecked: string;
  attribution?: string; // e.g. "© Australian Government, CC BY 4.0"
  createdAt: string;
  updatedAt: string;
}

export interface LegislationUpdate {
  id: string;
  legislationId: string;
  title: string;
  summary: string;
  effectiveDate?: string;
  sourceUrl: string;
  publishedAt: string;
  isRead: boolean;
  createdAt: string;
}

// ---- Updates Log (tracks polling results) ----

export interface LegislationUpdateLog {
  id: string;
  legislationId: string;
  changeType: 'version_change' | 'hash_mismatch' | 'new_amendment' | 'rss_update' | 'no_change';
  previousHash?: string;
  newHash?: string;
  previousVersionDate?: string;
  newVersionDate?: string;
  sourceUrl: string;
  timestamp: string;
}

export interface CourtFeedItem {
  id: string;
  court: string;
  jurisdiction: LegislationJurisdiction;
  title: string;
  summary: string;
  url: string;
  category: 'practice_direction' | 'media_release' | 'judgment' | 'notice' | 'legislative_update';
  publishedAt: string;
  isRead: boolean;
  createdAt: string;
}
