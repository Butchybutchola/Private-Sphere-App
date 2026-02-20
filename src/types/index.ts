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
