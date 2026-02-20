# Evidence Guardian API Documentation

## Overview

Evidence Guardian provides a forensic-grade evidence management platform. This document describes the internal API architecture and integration points for legal firm software.

**Version:** 1.0.0 (MVP)
**Authentication:** Bearer Token (JWT) for API endpoints
**Encryption:** AES-256 at rest, TLS 1.3 in transit

---

## Architecture

```
┌─────────────────────────────────────────┐
│          Mobile App (React Native)       │
│                                         │
│  ┌─────────┐  ┌─────────┐  ┌────────┐  │
│  │ Capture  │  │  Vault  │  │ Reports│  │
│  │ Engine   │  │  Screen │  │ Engine │  │
│  └────┬─────┘  └────┬────┘  └───┬────┘  │
│       │              │           │       │
│  ┌────┴──────────────┴───────────┴────┐  │
│  │        Local SQLite Database       │  │
│  │      (Encrypted, Audit-Logged)     │  │
│  └────────────────┬───────────────────┘  │
│                   │                      │
└───────────────────┼──────────────────────┘
                    │ Sync (Future)
┌───────────────────┼──────────────────────┐
│          Cloud Backend (Future)           │
│                   │                      │
│  ┌────────────────┴───────────────────┐  │
│  │          REST API Gateway          │  │
│  └────┬───────────┬──────────────┬────┘  │
│       │           │              │       │
│  ┌────┴────┐ ┌────┴────┐  ┌─────┴────┐  │
│  │  Auth   │ │Evidence │  │  Legal   │  │
│  │ Service │ │ Service │  │  Firm    │  │
│  │         │ │         │  │  Portal  │  │
│  └─────────┘ └─────────┘  └──────────┘  │
└──────────────────────────────────────────┘
```

---

## Core Data Models

### Evidence Item

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string (UUID)` | Unique identifier |
| `type` | `enum` | `photo`, `video`, `audio`, `document` |
| `status` | `enum` | `locked`, `pending`, `archived` |
| `file_path` | `string` | Local storage path |
| `sha256_hash` | `string` | SHA-256 cryptographic hash |
| `file_size` | `integer` | File size in bytes |
| `mime_type` | `string` | MIME type |
| `captured_at` | `ISO 8601` | UTC time from NTP server |
| `device_id` | `string (UUID)` | Unique device identifier |
| `latitude` | `float` | GPS latitude (WGS84) |
| `longitude` | `float` | GPS longitude (WGS84) |
| `altitude` | `float` | GPS altitude (meters) |
| `location_accuracy` | `float` | GPS accuracy (meters) |
| `title` | `string?` | User-provided title |
| `description` | `string?` | User-provided description |
| `tags` | `string[]` | Tag array |
| `court_order_id` | `string?` | Linked court order |
| `breach_clause` | `string?` | Linked breach clause |
| `transcription` | `string?` | AI-generated transcription |
| `parent_id` | `string?` | Original evidence ID (for versions) |
| `is_original` | `boolean` | Whether this is the master file |
| `version_number` | `integer` | Version counter |

### Court Order

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string (UUID)` | Unique identifier |
| `title` | `string` | Court order title |
| `file_path` | `string` | PDF storage path |
| `sha256_hash` | `string` | SHA-256 hash of the PDF |
| `clauses` | `Clause[]` | Array of defined clauses |
| `uploaded_at` | `ISO 8601` | Upload timestamp (NTP) |

### Court Order Clause

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string (UUID)` | Unique identifier |
| `court_order_id` | `string` | Parent court order |
| `clause_number` | `string` | Clause reference (e.g., "4") |
| `description` | `string` | Clause description |

### Breach Log

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string (UUID)` | Unique identifier |
| `evidence_id` | `string` | Linked evidence |
| `court_order_id` | `string` | Linked court order |
| `clause_id` | `string` | Linked clause |
| `description` | `string` | Breach description |
| `occurred_at` | `ISO 8601` | Time of occurrence (NTP) |

### Audit Log Entry

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string (UUID)` | Unique identifier |
| `user_id` | `string` | Acting user |
| `action` | `enum` | `created`, `viewed`, `downloaded`, `exported`, `tagged`, `transcribed`, `report_generated`, `deleted`, `archived` |
| `resource_type` | `enum` | `evidence`, `court_order`, `breach_log`, `report` |
| `resource_id` | `string` | Affected resource |
| `metadata` | `JSON?` | Additional context |
| `timestamp` | `ISO 8601` | Action timestamp |

---

## REST API Endpoints (Future Cloud Backend)

### Authentication

```
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/biometric-challenge
```

### Evidence

```
GET    /api/v1/evidence                    # List all evidence
GET    /api/v1/evidence/:id                # Get evidence detail
POST   /api/v1/evidence                    # Upload new evidence
GET    /api/v1/evidence/:id/verify         # Verify integrity
GET    /api/v1/evidence/:id/versions       # Get version history
GET    /api/v1/evidence/:id/audit          # Get audit trail
POST   /api/v1/evidence/:id/transcribe     # Request transcription
PATCH  /api/v1/evidence/:id/metadata       # Update metadata (title, tags, etc.)
GET    /api/v1/evidence/search?q=          # Search evidence
```

### Court Orders

```
GET    /api/v1/court-orders                # List all court orders
GET    /api/v1/court-orders/:id            # Get court order detail
POST   /api/v1/court-orders                # Upload court order (PDF)
POST   /api/v1/court-orders/:id/clauses    # Add clause
GET    /api/v1/court-orders/:id/breaches   # Get breach log
POST   /api/v1/court-orders/:id/breaches   # Log new breach
```

### Reports

```
POST   /api/v1/reports/generate            # Generate PDF report
GET    /api/v1/reports/:id                 # Get report
GET    /api/v1/reports/:id/download        # Download PDF
GET    /api/v1/reports                     # List all reports
```

### Audit

```
GET    /api/v1/audit                       # Get audit log (admin)
GET    /api/v1/audit?resource_type=evidence&resource_id=:id  # Filter
```

### Admin (Dashboard)

```
GET    /api/v1/admin/users                 # List users
GET    /api/v1/admin/users/:id             # User detail
PATCH  /api/v1/admin/users/:id             # Update user
GET    /api/v1/admin/subscriptions         # Subscription overview
GET    /api/v1/admin/stats                 # Dashboard statistics
```

### Legal Firm Portal

```
POST   /api/v1/firms/register              # Register legal firm
POST   /api/v1/firms/api-keys              # Generate API key
GET    /api/v1/firms/:id/evidence          # Access client evidence (with consent)
GET    /api/v1/firms/:id/reports           # Access client reports
```

---

## Forensic Capture Flow

```
1. User initiates capture (photo/video/audio)
   │
2. NTP time fetched from external server
   │  ├── worldtimeapi.org/api/timezone/Etc/UTC
   │  └── timeapi.io/api/Time/current/zone?timeZone=UTC
   │  └── Fallback: device clock (flagged in metadata)
   │
3. GPS coordinates captured (high accuracy)
   │
4. File saved with NO modifications (no filters, crops, compression)
   │
5. SHA-256 hash generated immediately
   │
6. File copied to immutable evidence storage
   │
7. Hash verified after copy (integrity check)
   │
8. Forensic metadata injected into database record:
   │  ├── sha256_hash
   │  ├── captured_at (UTC from NTP)
   │  ├── ntp_server_used
   │  ├── device_id
   │  ├── latitude, longitude, altitude
   │  ├── location_accuracy
   │  └── app_version
   │
9. Audit log entry created
   │
10. Evidence status set to "locked"
```

---

## Security Specifications

### Encryption
- **At Rest:** AES-256 encryption key stored in platform secure store (iOS Keychain / Android Keystore)
- **In Transit:** TLS 1.3 minimum
- **Key Management:** Device-local key generation, stored in Expo SecureStore

### Authentication
- **Biometric:** FaceID / Fingerprint via expo-local-authentication
- **Panic Lock:** Triple-tap gesture instantly locks app behind biometrics

### Privacy
- **No third-party analytics** (no Google Analytics, Firebase Analytics, etc.)
- **No content tracking** - user evidence is never sent to analytics services
- **Local-first architecture** - all data stored on-device in SQLite
- **Zero telemetry** on evidence content

### Audit Trail
Every access to evidence is logged:
- View, download, export, tag, transcribe, report generation
- Timestamps are immutable and NTP-sourced
- Audit log entries include: user ID, action, resource reference, timestamp

---

## Integration Guide for Legal Firms

### Setup

1. Register your firm via the admin dashboard or API
2. Receive API key and secret
3. Use Bearer token authentication for all requests

### Receiving Evidence

```http
GET /api/v1/firms/{firm_id}/evidence
Authorization: Bearer {api_token}
Content-Type: application/json

Response:
{
  "evidence": [
    {
      "id": "uuid",
      "type": "photo",
      "sha256_hash": "abc123...",
      "captured_at": "2024-01-15T14:30:00Z",
      "latitude": -33.8688,
      "longitude": 151.2093,
      "metadata_verification": {
        "ntp_verified": true,
        "gps_accuracy_meters": 4.2,
        "integrity_status": "valid"
      }
    }
  ]
}
```

### Downloading Reports

```http
GET /api/v1/firms/{firm_id}/reports/{report_id}/download
Authorization: Bearer {api_token}
Accept: application/pdf
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `INTEGRITY_VIOLATION` | File hash does not match stored hash |
| `NTP_UNAVAILABLE` | All NTP servers unreachable; device time used |
| `LOCATION_DENIED` | GPS permission not granted |
| `BIOMETRIC_FAILED` | Biometric authentication failed |
| `ENCRYPTION_ERROR` | Encryption/decryption failure |
| `STORAGE_FULL` | Device storage insufficient |

---

## Rate Limits (Future Backend)

| Endpoint | Limit |
|----------|-------|
| Evidence upload | 100/hour per user |
| Report generation | 20/hour per user |
| Transcription | 50/day per user |
| API (firm portal) | 1000/hour per key |

---

## Changelog

### v1.0.0 (MVP)
- Hardened capture engine (photo, video, audio)
- SHA-256 hashing at point of capture
- NTP time verification
- GPS metadata injection
- Immutable evidence storage
- Court order management with clause tagging
- Breach logging against court order clauses
- PDF report generation with metadata verification
- Biometric authentication
- Panic gesture (triple-tap lock)
- Black screen audio recording
- App icon disguise
- Full audit trail
- Admin dashboard scaffold
