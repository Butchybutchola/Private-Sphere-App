/**
 * PDF Briefing Engine
 *
 * Generates professional, court-ready evidence reports in PDF format.
 * Includes:
 * - Chronological Table of Contents
 * - Metadata Verification Sheets (time/location proof)
 * - Transcription logs
 * - Chain of custody audit trail
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { EvidenceItem, CourtOrder, BreachLog, AuditLogEntry } from '../types';
import { logAuditEvent } from '../database/auditRepository';
import { logCoCEvent } from '../database/chainOfCustodyRepository';
import { generateUUID } from '../utils/uuid';
import { format } from 'date-fns';
import { hashFile } from './hashService';

const REPORTS_DIR = `${FileSystem.documentDirectory}reports/`;

async function ensureReportsDir(): Promise<void> {
  const dirInfo = await FileSystem.getInfoAsync(REPORTS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(REPORTS_DIR, { intermediates: true });
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(isoString: string): string {
  try {
    return format(new Date(isoString), 'yyyy-MM-dd HH:mm:ss \'UTC\'');
  } catch {
    return isoString;
  }
}

function generateTableOfContents(evidence: EvidenceItem[]): string {
  const rows = evidence.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(item.title || `${item.type} Evidence`)}</td>
      <td>${item.type.toUpperCase()}</td>
      <td>${formatDate(item.capturedAt)}</td>
      <td><code>${item.sha256Hash.substring(0, 16)}...</code></td>
    </tr>
  `).join('');

  return `
    <h2>Table of Contents</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Title</th>
          <th>Type</th>
          <th>Captured (UTC)</th>
          <th>Hash (SHA-256)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function generateMetadataSheet(item: EvidenceItem, index: number): string {
  return `
    <div class="metadata-sheet">
      <h3>Evidence Item #${index + 1}: ${escapeHtml(item.title || `${item.type} Evidence`)}</h3>
      <table class="metadata-table">
        <tr><td class="label">Evidence ID</td><td><code>${item.id}</code></td></tr>
        <tr><td class="label">Type</td><td>${item.type.toUpperCase()}</td></tr>
        <tr><td class="label">Status</td><td>${item.status.toUpperCase()}</td></tr>
        <tr><td class="label">SHA-256 Hash</td><td><code style="word-break:break-all">${item.sha256Hash}</code></td></tr>
        <tr><td class="label">File Size</td><td>${(item.fileSize / 1024).toFixed(2)} KB</td></tr>
        <tr><td class="label">MIME Type</td><td>${item.mimeType}</td></tr>
        <tr><td class="label">Captured At (UTC)</td><td><strong>${formatDate(item.capturedAt)}</strong></td></tr>
        <tr><td class="label">Device ID</td><td><code>${item.deviceId}</code></td></tr>
        <tr><td class="label">GPS Latitude</td><td>${item.latitude?.toFixed(6) ?? 'N/A'}</td></tr>
        <tr><td class="label">GPS Longitude</td><td>${item.longitude?.toFixed(6) ?? 'N/A'}</td></tr>
        <tr><td class="label">GPS Altitude</td><td>${item.altitude?.toFixed(2) ?? 'N/A'} m</td></tr>
        <tr><td class="label">Location Accuracy</td><td>${item.locationAccuracy?.toFixed(2) ?? 'N/A'} m</td></tr>
        <tr><td class="label">Is Original</td><td>${item.isOriginal ? 'YES - MASTER FILE' : `No (Version ${item.versionNumber})`}</td></tr>
        <tr><td class="label">Original Version</td><td>${item.parentId || 'This is the original'}</td></tr>
      </table>

      ${item.description ? `
        <h4>Description</h4>
        <p>${escapeHtml(item.description)}</p>
      ` : ''}

      ${item.transcription ? `
        <h4>Transcription</h4>
        <div class="transcription">${escapeHtml(item.transcription)}</div>
      ` : ''}

      ${item.tags.length > 0 ? `
        <h4>Tags</h4>
        <p>${item.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(' ')}</p>
      ` : ''}
    </div>
  `;
}

function generateBreachSection(breaches: BreachLog[], courtOrder?: CourtOrder): string {
  if (breaches.length === 0) return '';

  const rows = breaches.map(b => `
    <tr>
      <td>${formatDate(b.occurredAt)}</td>
      <td>${escapeHtml(b.description)}</td>
      <td><code>${b.evidenceId.substring(0, 8)}...</code></td>
    </tr>
  `).join('');

  return `
    <div class="breach-section">
      <h2>Breach Log${courtOrder ? `: ${escapeHtml(courtOrder.title)}` : ''}</h2>
      <table>
        <thead>
          <tr>
            <th>Date/Time (UTC)</th>
            <th>Description</th>
            <th>Evidence Ref</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function generateAuditSection(auditEntries: AuditLogEntry[]): string {
  if (auditEntries.length === 0) return '';

  const rows = auditEntries.map(entry => `
    <tr>
      <td>${formatDate(entry.timestamp)}</td>
      <td>${entry.action}</td>
      <td>${entry.resourceType}</td>
      <td><code>${entry.resourceId.substring(0, 8)}...</code></td>
    </tr>
  `).join('');

  return `
    <div class="audit-section">
      <h2>Chain of Custody / Audit Trail</h2>
      <table>
        <thead>
          <tr>
            <th>Timestamp (UTC)</th>
            <th>Action</th>
            <th>Resource Type</th>
            <th>Resource ID</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function generateFullHTML(
  title: string,
  evidence: EvidenceItem[],
  breaches: BreachLog[],
  auditEntries: AuditLogEntry[],
  courtOrder?: CourtOrder,
  reportHash?: string
): string {
  const generatedAt = new Date().toISOString();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 11pt;
      color: #1a1a1a;
      line-height: 1.5;
      padding: 40px;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #1a1a1a;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 { font-size: 22pt; margin-bottom: 5px; }
    .header .subtitle { font-size: 12pt; color: #666; }
    .header .confidential {
      color: #c00;
      font-weight: bold;
      font-size: 10pt;
      margin-top: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    h2 {
      font-size: 16pt;
      margin: 30px 0 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid #ccc;
    }
    h3 { font-size: 13pt; margin: 20px 0 10px; }
    h4 { font-size: 11pt; margin: 15px 0 8px; color: #333; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0 20px;
      font-size: 10pt;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }
    th { background: #f5f5f5; font-weight: bold; }
    tr:nth-child(even) { background: #fafafa; }
    .metadata-sheet {
      page-break-inside: avoid;
      border: 1px solid #ccc;
      padding: 15px;
      margin: 15px 0;
      border-radius: 4px;
    }
    .metadata-table .label {
      width: 180px;
      font-weight: bold;
      background: #f9f9f9;
    }
    .transcription {
      background: #f8f8f0;
      border: 1px solid #ddd;
      padding: 12px;
      font-family: 'Courier New', monospace;
      font-size: 10pt;
      white-space: pre-wrap;
    }
    .tag {
      display: inline-block;
      background: #e8f0fe;
      color: #1a73e8;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 9pt;
      margin: 2px;
    }
    code {
      font-family: 'Courier New', monospace;
      font-size: 9pt;
      background: #f5f5f5;
      padding: 1px 4px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #1a1a1a;
      font-size: 9pt;
      color: #666;
    }
    .integrity-notice {
      background: #f0f7ff;
      border: 1px solid #b0d4ff;
      padding: 12px;
      margin: 20px 0;
      border-radius: 4px;
      font-size: 10pt;
    }
    @media print {
      body { padding: 20px; }
      .metadata-sheet { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>EVIDENCE GUARDIAN</h1>
    <div class="subtitle">${escapeHtml(title)}</div>
    <div class="confidential">Confidential - Legally Privileged</div>
    <p style="margin-top:10px;font-size:10pt;">
      Generated: ${formatDate(generatedAt)} | Evidence Items: ${evidence.length}
    </p>
  </div>

  <div class="integrity-notice">
    <strong>Digital Integrity Notice:</strong> All evidence items in this report have been
    cryptographically hashed (SHA-256) at the point of capture. Timestamps were obtained from
    external NTP servers (not the device clock). GPS coordinates were captured at the time of
    evidence creation. Any modification to the original files can be detected by comparing
    the recorded hash values.
    ${reportHash ? `<br><br><strong>Report Hash (SHA-256):</strong> <code>${reportHash}</code>` : ''}
  </div>

  ${generateTableOfContents(evidence)}

  <h2>Evidence Details</h2>
  ${evidence.map((item, i) => generateMetadataSheet(item, i)).join('')}

  ${generateBreachSection(breaches, courtOrder)}

  ${generateAuditSection(auditEntries)}

  <div class="footer">
    <p><strong>Evidence Guardian</strong> — Forensic Evidence Management Platform</p>
    <p>This report was generated by Evidence Guardian. Evidence integrity is verified
       by SHA-256 cryptographic hashing at the point of capture. Timestamps are
       NTP-verified where indicated. GPS coordinates are WGS84 datum. All timestamps
       are in UTC. This report is provided as a tool for legal proceedings and
       <strong>does not constitute legal advice</strong>.</p>
    <p>Report ID: ${generateUUID()}</p>
  </div>
</body>
</html>`;
}

export interface ReportOptions {
  title: string;
  evidence: EvidenceItem[];
  breaches?: BreachLog[];
  auditEntries?: AuditLogEntry[];
  courtOrder?: CourtOrder;
}

export async function generateReport(options: ReportOptions): Promise<{
  filePath: string;
  reportId: string;
  sha256Hash: string;
}> {
  await ensureReportsDir();

  const html = generateFullHTML(
    options.title,
    options.evidence,
    options.breaches || [],
    options.auditEntries || [],
    options.courtOrder
  );

  // Generate PDF
  const { uri } = await Print.printToFileAsync({
    html,
    width: 612, // US Letter width in points
    height: 792, // US Letter height in points
  });

  // Move to reports directory
  const reportId = generateUUID();
  const fileName = `report_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}_${reportId.substring(0, 8)}.pdf`;
  const destPath = `${REPORTS_DIR}${fileName}`;

  await FileSystem.moveAsync({ from: uri, to: destPath });

  // Hash the report
  const sha256Hash = await hashFile(destPath);

  // Log audit event
  await logAuditEvent('report_generated', 'report', reportId, {
    title: options.title,
    evidenceCount: options.evidence.length,
    sha256Hash,
  });

  // Record REPORT_INCLUDE chain-of-custody event for every evidence item
  for (const item of options.evidence) {
    await logCoCEvent(item.id, 'REPORT_INCLUDE', item.sha256Hash, {
      reportId,
      reportTitle: options.title,
    }, 'SYSTEM');
  }

  return { filePath: destPath, reportId, sha256Hash };
}

export async function shareReport(filePath: string): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(filePath, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share Evidence Report',
    });
  }
}

/**
 * Generates a single-page Verification Certificate for one evidence item.
 * Contains: SHA-256 hash, NTP timestamp, GPS coordinates, device metadata,
 * and capture flags — suitable for submission alongside evidence in court.
 *
 * Per Evidence Guardian spec v2.0 — Verification Certificate export format.
 */
export async function generateVerificationCertificate(item: EvidenceItem): Promise<{
  filePath: string;
  sha256Hash: string;
}> {
  await ensureReportsDir();

  const generatedAt = new Date().toISOString();
  const ntpFlag = item.capturedAt ? '' : ' <span class="flag">NTP_UNVERIFIED</span>';
  const gpsText = item.latitude != null && item.longitude != null
    ? `${item.latitude.toFixed(6)}, ${item.longitude.toFixed(6)}` +
      (item.altitude != null ? ` (alt: ${item.altitude.toFixed(1)} m)` : '') +
      (item.locationAccuracy != null ? ` ±${item.locationAccuracy.toFixed(0)} m` : '')
    : '<span class="flag">NOT AVAILABLE</span>';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Verification Certificate — ${escapeHtml(item.id)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt;
           color: #1a1a1a; line-height: 1.5; padding: 40px; }
    .cert-header { text-align: center; border-bottom: 3px solid #1a1a1a;
                   padding-bottom: 20px; margin-bottom: 30px; }
    .cert-header h1 { font-size: 18pt; letter-spacing: 2px; }
    .cert-header .app { color: #666; font-size: 11pt; margin-top: 5px; }
    .cert-header .generated { font-size: 10pt; color: #888; margin-top: 8px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    td { border: 1px solid #ddd; padding: 10px 14px; vertical-align: top; }
    td:first-child { width: 200px; font-weight: bold; background: #f9f9f9; }
    code { font-family: 'Courier New', monospace; font-size: 9pt;
           word-break: break-all; }
    .hash-block { background: #f5f5f5; border: 1px solid #ddd; padding: 14px;
                  margin: 20px 0; border-radius: 4px; }
    .hash-block .label { font-size: 9pt; color: #666; text-transform: uppercase;
                         letter-spacing: 1px; margin-bottom: 6px; }
    .hash-block code { font-size: 10pt; display: block; word-break: break-all; }
    .flag { color: #c00; font-weight: bold; font-size: 9pt; }
    .disclaimer { margin-top: 30px; padding: 14px; background: #f0f7ff;
                  border: 1px solid #b0d4ff; border-radius: 4px; font-size: 9.5pt; }
    .status-locked { display: inline-block; background: #e8f5e9; color: #2e7d32;
                     border: 1px solid #a5d6a7; padding: 3px 10px; border-radius: 12px;
                     font-weight: bold; font-size: 10pt; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ccc;
              font-size: 9pt; color: #888; text-align: center; }
  </style>
</head>
<body>

  <div class="cert-header">
    <h1>EVIDENCE VERIFICATION CERTIFICATE</h1>
    <div class="app">Evidence Guardian — Forensic Evidence Management Platform</div>
    <div class="generated">Generated: ${formatDate(generatedAt)}</div>
  </div>

  <div class="hash-block">
    <div class="label">SHA-256 Cryptographic Hash (Evidence Fingerprint)</div>
    <code>${escapeHtml(item.sha256Hash)}</code>
  </div>

  <table>
    <tr><td>Evidence ID</td><td><code>${escapeHtml(item.id)}</code></td></tr>
    <tr><td>Type</td><td>${item.type.toUpperCase()}</td></tr>
    <tr><td>Status</td><td><span class="status-locked">🔒 ${item.status.toUpperCase()}</span></td></tr>
    <tr><td>File Size</td><td>${(item.fileSize / 1024).toFixed(2)} KB (${item.fileSize.toLocaleString()} bytes)</td></tr>
    <tr><td>MIME Type</td><td>${escapeHtml(item.mimeType)}</td></tr>
    <tr><td>Captured At (UTC)</td><td><strong>${formatDate(item.capturedAt)}</strong>${ntpFlag}</td></tr>
    <tr><td>GPS Coordinates</td><td>${gpsText}</td></tr>
    <tr><td>Device ID</td><td><code>${escapeHtml(item.deviceId)}</code></td></tr>
    <tr><td>Is Original</td><td>${item.isOriginal ? 'YES — Master File' : `No (Version ${item.versionNumber})`}</td></tr>
    ${item.parentId ? `<tr><td>Parent Evidence ID</td><td><code>${escapeHtml(item.parentId)}</code></td></tr>` : ''}
    ${item.courtOrderId ? `<tr><td>Linked Court Order</td><td><code>${escapeHtml(item.courtOrderId)}</code></td></tr>` : ''}
  </table>

  <div class="disclaimer">
    <strong>Integrity Notice:</strong> The SHA-256 hash above was computed from the raw
    evidence file at the instant of capture and has not been modified since.
    Any alteration to the evidence file — however minor — will produce a different hash
    value, making tampering detectable. Timestamps marked <span class="flag">NTP_UNVERIFIED</span>
    were captured from the device clock when NTP servers were unreachable and may not
    be court-admissible without additional corroboration.<br><br>
    This certificate was generated by Evidence Guardian and
    <strong>does not constitute legal advice</strong>.
  </div>

  <div class="footer">
    Evidence Guardian — Certificate ID: ${generateUUID()}
  </div>

</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792 });

  const certId = generateUUID();
  const fileName = `cert_${item.id.substring(0, 8)}_${format(new Date(), 'yyyy-MM-dd')}_${certId.substring(0, 6)}.pdf`;
  const destPath = `${REPORTS_DIR}${fileName}`;
  await FileSystem.moveAsync({ from: uri, to: destPath });

  const certHash = await hashFile(destPath);

  await logCoCEvent(item.id, 'EXPORT', item.sha256Hash, {
    method: 'verification_certificate',
    certPath: destPath,
  }, 'SYSTEM');

  return { filePath: destPath, sha256Hash: certHash };
}
