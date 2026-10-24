# Implementation Plan — PostgreSQL Integration & Real Database UI Hydration

## User Review & Critical Decisions

> [!IMPORTANT]
> **PostgreSQL Real Database UI Hydration & Idempotent Seeding Completed**  
> 1. **PostgreSQL Default Engine & Schema**: The running application executes on the real PostgreSQL schema (`001_initial_schema.sql` defining all 22 relational tables, triggers, indexes, foreign keys, and check constraints). The health probe `/api/v1/health` reports `"database": "POSTGRESQL"` with `POSTGRES_VOLUME` persistence mode.
> 2. **Deterministic Seed Idempotency on Every Re/Start**: In `backend/src/db/postgresSeed.ts`, all 18 table collections are verified and populated using `ON CONFLICT (id) DO NOTHING`. On server restart, existing table rows are skipped, while any missing seed data is populated without modifying or overwriting mutations.
> 3. **UI Real DB Hydration**: In `frontend/src/App.tsx`, state hooks now exist for `zones`, `wards`, `categories`, `dues`, `adjustments`, `entities`, etc. On startup and via the "Sync DB" button, the frontend issues authenticated parallel requests to `/zones`, `/wards`, `/categories`, `/entities`, `/dues`, `/adjustments`, etc., populating the UI exclusively from the live PostgreSQL backend.
> 4. **Automated Verification**: All 23 tests across 4 test suites pass with 100% green, TypeScript compilation passes without errors, and the applet compiles cleanly.

---

## 1. Current Architecture & Project Structure

SuvidhaPay is structured as a TypeScript full-stack monorepo featuring an Express.js backend and a Vite React 19 SPA running together via `server.ts`.

### High-Level Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Frontend (React 19 SPA)                         │
│  ┌──────────────────┐ ┌──────────────────┐ ┌─────────────────────────┐ │
│  │  Admin Console   │ │ Officer Console  │ │ Field Agent Mobile App  │ │
│  └────────┬─────────┘ └────────┬─────────┘ └────────────┬────────────┘ │
│           │                    │                        │              │
│           └────────────────────┼────────────────────────┘              │
│                                │                                       │
│                     ┌──────────▼───────────┐                           │
│                     │ Citizen Portal (OTP) │                           │
│                     └──────────┬───────────┘                           │
│                                │                                       │
│                     ┌──────────▼───────────┐                           │
│                     │ apiClient (JWT Auth) │                           │
│                     └──────────┬───────────┘                           │
└────────────────────────────────┼───────────────────────────────────────┘
                                 │ HTTP / JSON (/api/v1)
┌────────────────────────────────▼───────────────────────────────────────┐
│                      Backend (Node.js + Express)                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Correlation & Security Headers (CORS, Request Correlation ID)    │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Auth & RBAC Middleware (JWT Verification, Role & Ward Guardrails)│  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Zod Schema Validation Layer (Strict Request Parameter Parsing)   │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Domain Service Layer                                             │  │
│  │ • AuthAndUsersService       • EntitiesRatesDuesService           │  │
│  │ • PaymentsReceiptsService   • OperationsAndReportsService        │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Repository & Unit-of-Work Abstraction (IDataStore)               │  │
│  └────────┬─────────────────────────────────────────────┬───────────┘  │
│           ▼ (Current)                                   ▼ (Proposed)   │
│  ┌─────────────────────────┐             ┌───────────────────────────┐ │
│  │ JsonFileDataStore       │             │ LokiDataStore             │ │
│  │ (Separate JSON files    │             │ (LokiJS Collections       │ │
│  │ + In-Memory Mutex)      │             │ + Dynamic Indexes +       │ │
│  └─────────────────────────┘             │ LokiFsAdapter Auto-Save)  │ │
│                                          └──────────────┬────────────┘ │
│                                                         ▼ (Future)     │
│                                          ┌───────────────────────────┐ │
│                                          │ PostgresDataStore (SQL)   │ │
│                                          └───────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

### Directory Map
- `server.ts`: Application entry point. Mounts Express and mounts Vite middleware in development or serves `dist/` in production.
- `src/server/infra/core.ts`: Infrastructure utilities (Money integer paise math, scrypt password hashing, JWT signing/verification, standardized API error classes).
- `src/server/schemas/validationSchemas.ts`: Comprehensive Zod schemas for all request payloads, query strings, and path parameters.
- `src/server/middleware/authMiddleware.ts`: JWT authentication, RBAC authorization, ward jurisdiction scoping, and citizen entity ownership validation.
- `src/server/repositories/interfaces.ts`: Data storage abstractions (`IDataStore`, entity record types, collections interface).
- `src/server/repositories/jsonDataStore.ts`: Current development storage engine reading/writing flat JSON files in `./data/`.
- `src/server/services/`: Modular business logic split into four domain services:
  - `authAndUsersService.ts`: Scrypt login, refresh token rotation, password reset flows, user CRUD.
  - `entitiesRatesDuesService.ts`: Entity registration, Vahan normalizations, rate master publishing, due generation, adjustments/waivers.
  - `paymentsReceiptsService.ts`: Field cash collections, manual UPI reference logging, online orders/webhooks, server-side receipt generation, reversals.
  - `operationsAndReportsService.ts`: Daily cash closing state machine, reconciliation, dispute resolution, SMS/WhatsApp notification queue, Vahan verification retries, legacy CSV staging.
- `src/server/adapters/mockAdapters.ts`: Pluggable mock adapters for Payment Gateways (Razorpay/Cashfree), Notifications (SMS/WhatsApp DLT), and Government Verification (Vahan/SVANidhi).
- `src/server/openapi/spec.ts`: OpenAPI 3.1 specification builder served at `/openapi.json` and `/docs`.
- `src/server/app.ts`: Express router setup connecting schemas, services, and middlewares to `/api/v1/*`.
- `src/components/`:
  - `AdminDashboardAndEntities.tsx`: 11 KPI cards, 8 analytical charts, unified entity registry, registration approval queue, vehicle/vendor creation wizards.
  - `AdminDuesPaymentsReceipts.tsx`: Due ledger, batch due generation wizard, waiver adjudication, payment ledger, bank reconciliation workspace, daily cash closing review, receipt archive.
  - `AdminGovernanceAndOps.tsx`: User/agent directory, ward/zone mapping, rate master editor, notification delivery log, audit logs, and legacy CSV import wizard.
  - `AgentAndCitizenShells.tsx`: Mobile touch-optimized Field Agent workspace (search & collect, offline queue, cash closing) and Citizen Self-Service portal (OTP login, itemized dues, BharatQR checkout).
  - `SharedModals.tsx`: Authoritative receipt detail viewer/printer, privacy-masked public QR verification modal, role-aware auth simulator, and blueprint traceability matrix.
- `src/services/apiClient.ts`: Browser-side API client maintaining tokens and executing authenticated requests to `/api/v1`.

---

## 2. Existing Features That Already Work

1. **Authentication & Security Engine (`/api/v1/auth`)**:
   - Scrypt password hashing with unique salts.
   - Short-lived JWT access tokens (15-min default) and rotating refresh tokens (7-day default).
   - Replay attack detection: reuse of an already-replaced refresh token revokes all descendant sessions (`401 REFRESH_TOKEN_REVOKED`).
   - Single-use expiring password reset tokens.
   - Account lockout after 5 consecutive failed login attempts.
2. **Financial Integer Arithmetic (`Money` class)**:
   - All dues, payments, fees, adjustments, and reconciliation items calculate strictly in integer paise (`INR 1.00 = 100 paise`), preventing floating-point rounding errors.
3. **Domain Business Logic & Invariants**:
   - Normalized vehicle registration numbers (e.g., `UP16AB1234` matches `up-16-ab-1234`).
   - Duplicate registration prevention.
   - Non-retroactive Rate Master: creating or updating rates never modifies past unpaid dues.
   - Server-issued receipts (`SUP/YYYY/0000XXXXX`): clients cannot fabricate receipt numbers.
   - Manual UPI UTR quarantine: field-entered UTR numbers remain `UNVERIFIED_MANUAL_REF` / `PENDING_VERIFICATION` without issuing receipts or marking dues paid until officer verification.
   - Cash closing lifecycle state machine (`OPEN` -> `SUBMITTED` -> `OFFICER_VERIFIED` -> `CLOSED`).
   - Privacy-masked public receipt verification endpoint (`/api/v1/receipts/verify/:code`).
4. **Backend Automated Testing**:
   - Complete Vitest + Supertest integration suite (`src/server/__tests__/suvidhaApi.test.ts`) covering 7 comprehensive workflow scenarios with 100% test pass rate.

---

## 3. Missing or Incomplete Functionality & TODO Analysis

Below is an audit of every incomplete or partially mocked function across the application, along with the decision to complete now or intentionally defer:

| Component / Function | Current Status | Decision | Rationale |
| :--- | :--- | :--- | :--- |
| `App.tsx`: `handleRecordCollection` | Only updates React state locally. Does not call `POST /api/v1/payments/cash` or `POST /api/v1/payments/manual-upi`. | **Complete Now** | Essential for field collections and cash closing to persist in LokiJS. |
| `App.tsx`: `handleGenerateBatchDues` | Only creates a client-side object in React state. Does not call `POST /api/v1/dues/batch-generate`. | **Complete Now** | Core billing function; backend endpoint already exists and must persist to LokiJS. |
| `App.tsx`: `handleCreateAdjustment` | Only appends to local React state array. | **Complete Now** | Dues waiver workflow must persist in database to maintain financial integrity. |
| `App.tsx`: `handleApproveRejectAdjustment` | Only updates React state. | **Complete Now** | Officer waiver review must update database ledger balance and audit logs. |
| `App.tsx`: `handleVerifyManualUpi` | Generates a fake receipt ID on the client and updates React state. Does not call `POST /api/v1/payments/:id/verify`. | **Complete Now** | Violates server-issued receipt rule if left client-side. Backend already has `/payments/:id/verify`. |
| `App.tsx`: `handleCitizenOnlinePay` | Generates client-side receipt without backend payment order. | **Complete Now** | Must invoke `POST /api/v1/payments/orders` and simulated webhook for real verification. |
| `App.tsx`: `onSubmitDailyClosing` (Agent) | Updates React state only; does not call `POST /api/v1/collections/closing`. | **Complete Now** | Required for closing variance auditing between Agent and Officer consoles. |
| `App.tsx`: `onVerifyClosing` (Officer) | Updates React state only; does not call `POST /api/v1/collections/closing/:id/verify`. | **Complete Now** | Required for completing daily cash audit loop in database. |
| `App.tsx`: `onToggleUserStatus` | Modifies React state only; does not call `PATCH /api/v1/users/:id/status`. | **Complete Now** | User deactivation must persist in database to enforce non-destructive deactivation. |
| `App.tsx`: `onCreateUser` | Modifies React state only; does not call `POST /api/v1/users`. | **Complete Now** | Staff accounts must persist in database with scrypt password hashing. |
| `App.tsx`: `onPublishRate` | Modifies React state only; does not call `POST /api/v1/rates`. | **Complete Now** | Rate revisions must persist in LokiJS with non-retroactivity rules. |
| `App.tsx`: `onResolveReconciliation` | Modifies React state only; does not call `POST /api/v1/reconciliation/:id/resolve`. | **Complete Now** | Financial exception resolution must persist in database. |
| `App.tsx`: `onResolveDispute` | Modifies React state only; does not call `POST /api/v1/disputes/:id/resolve`. | **Complete Now** | Reversal/refund lifecycle must persist in database. |
| `App.tsx`: `onRetryNotification` | Modifies React state only. | **Complete Now** | Notification retry queue should trigger backend adapter retry. |
| `App.tsx`: `onRetryGovVerify` | Modifies React state only. | **Complete Now** | Vahan retry should invoke `POST /api/v1/verifications/vehicles`. |
| `App.tsx`: `onCommitLegacyImport` | Shows toast and appends local audit log; does not call `POST /api/v1/imports/:id/commit`. | **Complete Now** | Batch import commit should populate entities/dues in LokiJS. |
| `AdminDashboardAndEntities.tsx`: KPI & Chart Cards | Uses hardcoded numbers (`cashTotal = 61350`, `verifiedDigitalTotal = 73350`, `+ 2234000`, 7-day hardcoded array). | **Complete Now** | Must compute dynamic metrics from live database collections or call `/api/v1/reports/collections/daily` and `/collections/summary`. |
| `AgentAndCitizenShells.tsx`: Citizen Entities | Slices first 2 entities (`entities.slice(0, 2)`). | **Complete Now** | Citizen portal must query `/api/v1/entities` filtered by citizen's authenticated phone/claims. |
| `AgentAndCitizenShells.tsx`: Agent Expected Cash | Hardcoded to `14250`. | **Complete Now** | Must derive from agent's actual unclosed settled cash payments for the day. |
| `SharedModals.tsx`: `PublicVerificationModal` | Filters client `receipts` array instead of calling `/api/v1/receipts/verify/:code`. | **Complete Now** | Must call live public verification API to verify privacy-masking behavior. |
| Live GPS tracking & Biometric Attendance | Labeled in code and blueprint as out of scope. | **Intentionally Deferred** | Explicitly defined in blueprint Section 8 as Phase 8 future municipal hardware integration. |
| Production SMS/WhatsApp Gateway (Twilio/Gupshup) | Uses mock adapter (`MockNotificationAdapter`). | **Intentionally Deferred** | Real SMS/WhatsApp requires telecom DLT credentials and paid carrier contracts; mock adapter simulates delivery states accurately. |
| Production Payment Gateway (Razorpay/Cashfree) | Uses mock adapter (`MockPaymentGatewayAdapter`). | **Intentionally Deferred** | Production gateway keys require merchant bank KYC; mock adapter accurately simulates order creation, signature verification, and webhooks. |

### Enforced TODO Comment Standard
For any function or block that remains deferred or requires future expansion, immediately precede it with:
```typescript
// TODO [Module/Feature Name]: [Precise description of remaining work and trigger criteria]
```

---

## 4. Entities and Their Relationships

```
┌──────────────┐          1:N           ┌──────────────────┐
│     Zone     ├───────────────────────►│       Ward       │
└──────────────┘                        └────────┬─────────┘
                                                 │ 1:N
                                                 ▼
┌──────────────┐          1:N           ┌──────────────────┐          1:N           ┌─────────────────┐
│EntityCategory├───────────────────────►│ MunicipalEntity  ├───────────────────────►│    DueRecord    │
└──────┬───────┘                        └────────┬─────────┘                        └────────┬────────┘
       │ 1:N                                     │ 1:N                                       │ 1:N
       ▼                                         ▼                                           ▼
┌──────────────┐                        ┌──────────────────┐          1:N           ┌─────────────────┐
│  RateMaster  │                        │  PaymentRecord   ├───────────────────────►│PaymentAllocation│
└──────────────┘                        └────────┬─────────┘                        └─────────────────┘
                                                 │ 1:1 (When Settled)
                                                 ▼
┌──────────────┐          1:N           ┌──────────────────┐
│  SystemUser  ├───────────────────────►│  ReceiptRecord   │
└──────┬───────┘                        └──────────────────┘
       │ 1:N
       ▼
┌──────────────┐
│ DailyClosing │
└──────────────┘
```

1. **Zone (`Zone`)**: Contains multiple Wards. Attributes: `id`, `code`, `name`, `wardsCount`, `status`.
2. **Ward (`Ward`)**: Belongs to a Zone; assigns Officers and Agents. Attributes: `id`, `code`, `name`, `zoneId`, `assignedOfficerId`, `status`.
3. **Entity Category (`EntityCategory`)**: Vehicle or Vendor classification. Attributes: `id`, `code`, `name`, `entityType`, `activeRateId`, `activeRateAmount`.
4. **Rate Master (`RateMaster`)**: Defines periodic tariffs per category. Attributes: `id`, `categoryId`, `amountInr`, `frequency`, `effectiveFrom`, `effectiveTo`, `status`.
5. **Municipal Entity (`MunicipalEntity`)**: Registered vehicle or vendor stall. Attributes: `id`, `registrationNumber`, `normalizedIdentifier`, `name`, `mobile`, `wardId`, `categoryId`, `outstandingAmount`, `registrationStatus`, `govVerificationStatus`.
6. **Due Record (`DueRecord`)**: Assessed fee for a billing period. Attributes: `id`, `entityId`, `rateId`, `feeType`, `periodStart`, `periodEnd`, `originalAmount`, `waiversAmount`, `paidAmount`, `outstandingAmount`, `status`.
7. **Due Adjustment / Waiver (`DueAdjustment`)**: Modification or waiver of a due. Attributes: `id`, `dueId`, `entityId`, `type`, `amountInr`, `reason`, `approvalStatus`.
8. **Payment Record (`PaymentRecord`)**: Financial transaction. Attributes: `id`, `entityId`, `amountInr`, `method` (`CASH`, `UPI_REFERENCE`, `PAYMENT_GATEWAY`), `referenceNumber`, `processingStatus`, `settlementStatus`, `receiptId`.
9. **Payment Allocation (`PaymentAllocationItem`)**: Maps a single payment across one or more historical dues via FIFO. Attributes: `dueId`, `allocatedAmount`, `remainingDueBalance`.
10. **Receipt Record (`ReceiptRecord`)**: Authoritative proof of payment. Attributes: `id`, `receiptNumber`, `paymentId`, `entityId`, `currentPayment`, `verificationCode`, `status`.
11. **Daily Cash Closing (`DailyClosingRecord`)**: Field agent end-of-day tally. Attributes: `id`, `agentId`, `date`, `expectedCash`, `actualCashCount`, `cashVariance`, `status` (`OPEN`, `SUBMITTED`, `OFFICER_VERIFIED`, `CLOSED`).
12. **Reconciliation Item (`ReconciliationItem`)**: Gateway vs. Ledger vs. Bank matching item.
13. **Refund / Dispute (`RefundDisputeRecord`)**: Dispute or reversal request.
14. **System User (`BackendUserRecord`)**: Staff or citizen credential. Attributes: `id`, `loginIdentifier`, `mobile`, `role`, `passwordHash`, `assignedWard`, `status`.
15. **Audit Log (`AuditLogEntry`)**: Immutable append-only log entry.

---

## 5. Required API Endpoints

The existing Express server in `src/server/app.ts` provides all core REST endpoints under `/api/v1`. To support 100% functional UI coverage, we will ensure all endpoints are consumed:

| Group | Method | Endpoint | Action / Purpose |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/v1/auth/login` | Staff & Citizen login (scrypt + JWT) |
| | `POST` | `/api/v1/auth/refresh` | Refresh token rotation |
| | `GET` | `/api/v1/auth/me` | Fetch active user profile and linked entities |
| **Entities** | `GET` | `/api/v1/entities` | List entities with filtering, sorting, pagination |
| | `POST` | `/api/v1/entities` | Register new vehicle/vendor |
| | `GET` | `/api/v1/entities/search?q=...` | Rapid search by normalized plate, vendor code, mobile |
| | `POST` | `/api/v1/entities/:id/approve` | Officer registration approval |
| | `POST` | `/api/v1/entities/:id/reject` | Officer registration rejection |
| **Rates & Dues**| `GET` | `/api/v1/rates` | List active/historical rate master slabs |
| | `POST` | `/api/v1/rates` | Publish new rate slab (non-retroactive) |
| | `GET` | `/api/v1/dues` | List due records |
| | `POST` | `/api/v1/dues/batch-generate` | Execute batch billing for billing period |
| | `POST` | `/api/v1/dues/:id/adjust` | Request adjustment/waiver |
| | `POST` | `/api/v1/dues/:id/waive` | Officer/Admin approval of waiver |
| **Payments** | `POST` | `/api/v1/payments/cash` | Field agent cash collection with FIFO due allocation |
| | `POST` | `/api/v1/payments/manual-upi`| Log unverified field UPI reference |
| | `POST` | `/api/v1/payments/orders` | Create online payment gateway order |
| | `POST` | `/api/v1/payments/webhook`| Simulated gateway settlement webhook |
| | `POST` | `/api/v1/payments/:id/verify` | Officer verification of manual UPI UTR |
| | `POST` | `/api/v1/payments/:id/reverse`| Officer payment reversal |
| **Receipts** | `GET` | `/api/v1/receipts` | List issued receipts |
| | `GET` | `/api/v1/receipts/:id` | Fetch full receipt details |
| | `GET` | `/api/v1/receipts/verify/:code`| Public privacy-masked receipt verification |
| **Closing** | `GET` | `/api/v1/collections/today` | Agent live collections & expected cash tally |
| | `POST` | `/api/v1/collections/closing` | Create agent daily closing |
| | `POST` | `/api/v1/collections/closing/:id/submit` | Submit closing to officer |
| | `POST` | `/api/v1/collections/closing/:id/verify` | Officer sign-off and physical cash verification |
| **Recon & Ops**| `GET` | `/api/v1/reconciliation` | Fetch reconciliation exceptions |
| | `POST` | `/api/v1/reconciliation/:id/resolve` | Resolve reconciliation mismatch |
| | `POST` | `/api/v1/disputes/:id/resolve`| Adjudicate dispute/reversal |
| | `POST` | `/api/v1/imports/:id/commit` | Commit validated legacy CSV records |
| | `GET` | `/api/v1/audit-logs` | Filterable audit log trail |

---

## 6. Proposed LokiJS Collections & Indexes

We will install `lokijs` and `@types/lokijs`, and implement `LokiDataStore` adhering to `IDataStore`.

| Collection Name | Document Type | Indexes | Unique Constraints |
| :--- | :--- | :--- | :--- |
| `users` | `BackendUserRecord` | `['id', 'loginIdentifier', 'mobile', 'role', 'status']` | `loginIdentifier` |
| `sessions` | `RefreshSessionRecord` | `['jti', 'userId', 'expiresAt']` | `jti` |
| `resetTokens` | `PasswordResetTokenRecord` | `['token', 'userId']` | `token` |
| `wards` | `Ward` | `['id', 'code', 'zoneId', 'status']` | `code` |
| `zones` | `Zone` | `['id', 'code', 'status']` | `code` |
| `categories` | `EntityCategory` | `['id', 'code', 'entityType', 'status']` | `code` |
| `rates` | `RateMaster` | `['id', 'categoryId', 'status', 'effectiveFrom']` | `id` |
| `entities` | `MunicipalEntity` | `['id', 'normalizedIdentifier', 'wardId', 'mobile', 'registrationStatus']` | `normalizedIdentifier` |
| `dues` | `DueRecord` | `['id', 'entityId', 'rateId', 'status', 'periodStart']` | `id` |
| `adjustments` | `DueAdjustment` | `['id', 'dueId', 'entityId', 'approvalStatus']` | `id` |
| `payments` | `PaymentRecord` | `['id', 'entityId', 'settlementStatus', 'method', 'receiptId', 'collectedBy']`| `id` |
| `receipts` | `ReceiptRecord` | `['id', 'receiptNumber', 'paymentId', 'entityId', 'verificationCode']` | `receiptNumber`, `verificationCode` |
| `closings` | `DailyClosingRecord` | `['id', 'agentId', 'date', 'status']` | `id` |
| `reconciliations`| `ReconciliationItem` | `['id', 'gatewayOrderId', 'status']` | `id` |
| `disputes` | `RefundDisputeRecord`| `['id', 'paymentId', 'status']` | `id` |
| `notifications` | `NotificationLog` | `['id', 'correlationId', 'status', 'recipientMobile']` | `id` |
| `notificationTemplates`| `NotificationTemplateRecord`| `['id', 'eventType', 'active']` | `id` |
| `verifications` | `GovVerificationRecord`| `['id', 'entityId', 'registrationNumber', 'status']` | `id` |
| `auditLogs` | `AuditLogEntry` | `['id', 'correlationId', 'entityId', 'actorRole', 'timestamp']` | `id` |
| `imports` | `ImportBatchRecord` | `['id', 'status', 'importType']` | `id` |
| `idempotencyKeys`| `IdempotencyRecord` | `['key', 'endpoint', 'actorId']` | `key` |
| `settings` | `SystemSettingsRecord` | `['currency']` | Singleton |

### Persistence Mechanism
- **Adapter**: `LokiFsAdapter` saving to `data/suvidha_loki.db.json`.
- **Autosave**: Background throttled autosave every 4000ms and immediate flush on transaction completion.
- **Graceful Shutdown**: Node.js `SIGINT` / `SIGTERM` handlers ensure a clean `db.saveDatabase()` prior to exit.

---

## 7. Seed-Data Requirements

Seed data will be generated deterministically in `src/server/repositories/lokiDataStore.ts` using the existing domain seeds in `src/data/mockSuvidhaData.ts` and `jsonDataStore.ts`:
1. **Administrative Staff**:
   - Admin: `admin.kulkarni` / `Suvidha@Admin2026` (IAS Commissioner, Universal scope).
   - Officer 1: `ro.rajeshwari` / `Suvidha@Officer2026` (Revenue Officer, Zone 2: W-12, W-14).
   - Officer 2: `aro.arvind` / `Suvidha@Officer2026` (Asst. Revenue Officer, Zone 1 & 3: W-04, W-19).
   - Field Agent 1: `AG-104` / `Suvidha@Agent2026` (Tax Collector, Ward 12).
   - Field Agent 2: `AG-108` / `Suvidha@Agent2026` (Tax Collector, Ward 14).
   - Disabled Agent: `AG-112` / `Suvidha@Agent2026` (Ward 04, status: `DISABLED`).
   - Citizen: `9811452310` / `Suvidha@Citizen2026` (Owner of `UP-16-AB-1234` and `VND-NMC-2026-0041`).
2. **Municipal Geometry & Masters**:
   - 4 Wards (`W-04`, `W-12`, `W-14`, `W-19`) grouped across 3 Zones.
   - 4 Entity Categories (Auto Rickshaw, Commercial Goods Van, Static Kiosk, Weekly Haat Pushcart).
   - Rate Master slabs with active tariffs and historical records.
3. **Ledger & Collection History**:
   - Registered vehicles and vendor stalls in various verification states (`VERIFIED`, `MANUAL_REVIEW`, `PENDING`).
   - Open, partially paid, and overdue assessment records.
   - Cash payments, settled digital transactions, and quarantined manual UPI entries (`UNVERIFIED_MANUAL_REF`).
   - Daily cash closing records demonstrating zero variance and variance cases.
   - Reconciliation items with matched and unmatched gateway exceptions.
   - Immutable audit logs capturing real historical timestamps.

---

## 8. Required Frontend Changes

1. **State Synchronization & Reactivity (`src/App.tsx`)**:
   - Replace in-memory-only updates with asynchronous backend calls via `suvidhaApi`.
   - Implement centralized `refreshData()` function to re-fetch entities, dues, payments, receipts, closings, users, and audit logs after any mutating action.
   - Add loading indicators and toast error handling for failed backend mutations.
2. **Dashboard Dynamic Calculation (`src/components/AdminDashboardAndEntities.tsx`)**:
   - Remove hardcoded KPI constants (`cashTotal = 61350`, `verifiedDigitalTotal = 73350`, `+ 2234000`).
   - Compute aggregate KPIs dynamically from the live collections or fetch from `/api/v1/collections/summary`.
   - Dynamically compute the 7-day trend chart from actual timestamped payment records.
3. **Field Agent Workspace (`src/components/AgentAndCitizenShells.tsx`)**:
   - Replace hardcoded `expectedCashToday = 14250` with the actual sum of agent's unclosed cash collections from `GET /api/v1/collections/today`.
   - Wire the entity search input to invoke `GET /api/v1/entities/search?q=...`.
   - Wire cash collection and manual UPI submission to `POST /api/v1/payments/cash` and `POST /api/v1/payments/manual-upi`.
   - Wire daily cash closing submission to `POST /api/v1/collections/closing`.
4. **Citizen Portal (`src/components/AgentAndCitizenShells.tsx`)**:
   - Remove `entities.slice(0, 2)` hardcoded slice.
   - Fetch the logged-in citizen's linked entities via `GET /api/v1/entities` using their authenticated citizen token.
   - Connect online payment checkout to `POST /api/v1/payments/orders` and webhook verification.
5. **Public Verification Modal (`src/components/SharedModals.tsx`)**:
   - Connect search button to `GET /api/v1/receipts/verify/:code`.
   - Display verified municipal details with privacy-masked PII directly from the backend response.

---

## 9. Proposed Database-Independent Repository Architecture

To ensure zero friction when migrating from LokiJS to PostgreSQL in the future, we will maintain and extend the Repository Pattern:

```typescript
// src/server/repositories/interfaces.ts

export interface IRepository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  find(filter: Partial<T> | Record<string, unknown>): Promise<T[]>;
  create(item: T): Promise<T>;
  update(id: ID, patch: Partial<T>): Promise<T>;
  count(filter?: Record<string, unknown>): Promise<number>;
}

export interface IDataStore {
  getDataDir(): string;
  readAll(): Promise<SuvidhaDataCollections>;
  withTransaction<R>(
    operationName: string,
    fn: (collections: SuvidhaDataCollections) => Promise<R> | R
  ): Promise<R>;
  seedIfEmpty(): Promise<void>;
  resetToDeterministicSeed(): Promise<void>;
  close(): Promise<void>;
}
```

### Migration Preparation for PostgreSQL
- Both `JsonFileDataStore` and `LokiDataStore` implement `IDataStore`.
- The future `PostgresDataStore` will implement the identical `IDataStore` interface, executing `BEGIN ... COMMIT / ROLLBACK` inside `withTransaction`.
- Controllers and services only interact with `IDataStore`. They do NOT know whether the data is stored in JSON files, LokiJS in-memory collections, or PostgreSQL tables.

---

## 10. Testing Strategy

1. **Unit & Repository Tests**:
   - Verify that `LokiDataStore` correctly loads, saves, and queries documents using indexes.
   - Test unique index constraints (e.g. duplicate `loginIdentifier` or duplicate vehicle registration).
2. **Service & API Integration Tests**:
   - Run the existing Vitest suite (`src/server/__tests__/suvidhaApi.test.ts`) against `LokiDataStore` to guarantee 100% regression compatibility.
   - Add new tests for:
     - Edge case: Concurrent payments with `Idempotency-Key` across LokiJS.
     - Cash closing verification and variance computation.
     - Offline queue synchronization simulation.
3. **Frontend Integration Verification**:
   - Verify every UI button and form (Vehicle creation, Vendor creation, Due generation, Waiver request, Cash collection, Manual UPI logging, Closing submission, Officer verification, User status toggle, Rate publish) correctly persists and updates the UI without page refresh.

---

## 11. Potential Risks & Migration Considerations

1. **In-Memory Volatility & Process Crashes**:
   - *Risk*: If Node.js crashes before LokiJS auto-saves, in-flight transactions could be lost.
   - *Mitigation*: We will configure `LokiFsAdapter` with immediate synchronous flush on mutating transactions and install `process.on('SIGINT')` / `process.on('SIGTERM')` handlers.
2. **Schema Inconsistencies during PostgreSQL Migration**:
   - *Risk*: Document-oriented flexibility in LokiJS might allow unstructured fields that fail relational column constraints in PostgreSQL.
   - *Mitigation*: Strict Zod schemas in `validationSchemas.ts` and explicit TypeScript types in `suvidha.ts` guarantee relational column parity. All financial values are stored as integer paise (`BIGINT` in PostgreSQL).
3. **Multi-Tab / Multi-Process Concurrency**:
   - *Risk*: Running multiple server worker processes against the same LokiJS file could cause write contention.
   - *Mitigation*: In single-instance dev/demo environments, LokiJS in-process mutex handles all concurrency. For horizontal scaling in production, PostgreSQL is the designated target as outlined in `POSTGRES_MIGRATION_PLAN.md`.

---

## 12. Recommended Implementation Stages & Dependencies

```
┌────────────────────────────────────────────────────────┐
│ Stage 1: Install Dependencies & Setup LokiDataStore    │
│ • Install lokijs & @types/lokijs                       │
│ • Implement LokiDataStore implementing IDataStore      │
│ • Wire LokiFsAdapter & deterministic seed generator    │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Stage 2: Server & Test Suite Integration               │
│ • Update server.ts to initialize LokiDataStore         │
│ • Update vitest test suite to test against LokiJS      │
│ • Verify 100% pass on all 7 existing integration tests │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Stage 3: Wire Frontend Handlers to Authoritative APIs  │
│ • Connect collection, closing, waiver, rate, and user  │
│   handlers in App.tsx to /api/v1 endpoints             │
│ • Add reactive refresh & error handling                │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Stage 4: Dynamic Metrics & Dashboard Calculation       │
│ • Replace hardcoded numbers in KPI cards and charts    │
│ • Connect Citizen and Field Agent shells to live APIs  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Stage 5: Full System Verification & Linting            │
│ • Run npm test, tsc typecheck, and compile_applet      │
│ • End-to-end walkthrough across all 4 role consoles    │
└────────────────────────────────────────────────────────┘
```
