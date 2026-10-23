# SuvidhaPay — Municipal Collection Management System

> **Transparent Collections. Trusted Governance.**  
> A full-stack civic technology ERP and revenue collection platform designed for Indian Urban Local Bodies (ULBs), Nagar Nigams, Municipal Councils, and Cantonment Boards.

SuvidhaPay digitizes manual municipal operations: paper registers, vehicle stand parking fees, vendor tehbazari / vending zone fees, field cash collections, digital payments, officer reconciliations, public receipt verification, and statutory audit compliance.

---

## 📑 Table of Contents
1. [Overview & Civic Problem Statement](#-overview--civic-problem-statement)
2. [Civic Integrity Guardrails](#-civic-integrity-guardrails)
3. [Multi-Role User Experiences](#-multi-role-user-experiences)
4. [Technology Stack](#-technology-stack)
5. [Repository Structure](#-repository-structure)
6. [Quick Start & Developer Workflow](#-quick-start--developer-workflow)
7. [Default Seeded Demo Credentials](#-default-seeded-demo-credentials)
8. [Authoritative REST API Reference (`/api/v1`)](#-authoritative-rest-api-reference-apiv1)
9. [Configuration & Environment Variables](#-configuration--environment-variables)
10. [Automated Testing & Quality Assurance](#-automated-testing--quality-assurance)
11. [Production Deployment & Database Migration](#-production-deployment--database-migration)
12. [License](#-license)

---

## 🏛️ Overview & Civic Problem Statement

Urban Local Bodies (ULBs) across India manage daily collections across hundreds of dispersed parking stands, weekly haats, and street vending zones. Traditional paper-based collection suffers from:
- **Revenue Leakage**: Lost receipts, unrecorded cash, and delayed end-of-day bank deposits.
- **Fraudulent UPI Claims**: Unscrupulous payees showing fake payment screenshots or unverified UTR numbers to field staff.
- **Floating-Point Drift**: Small rounding discrepancies that lead to audit objections from the Comptroller and Auditor General (CAG) or State Local Fund Audit.
- **Citizen Mistrust**: Inability for citizens to verify whether cash paid to a field collector was legitimately remitted to the municipality.
- **Rigid Legacy Systems**: Past rate revisions mistakenly altering historical unpaid dues, leading to legal disputes.

**SuvidhaPay** solves these challenges through strict computational guardrails, role-based workflows, cryptographic auditability, and mobile-first field tooling.

---

## 🛡️ Civic Integrity Guardrails

SuvidhaPay is engineered around non-negotiable financial and civic standards:

| Guardrail | Implementation |
| :--- | :--- |
| **Integer Paise Arithmetic** | All monetary amounts are handled and stored strictly as integer paise (`INR 1.00 = 100 paise`) via the `Money` utility. Floating-point IEEE-754 numbers are never used for financial state. |
| **Server-Issued Receipts** | Receipt identifiers (e.g., `SUP/2026/000012345`) are generated solely by the backend upon verified payment. Clients cannot fabricate receipt numbers. |
| **Manual UPI UTR Quarantine** | Field-entered UPI UTRs are recorded as `UNVERIFIED_MANUAL_REF` / `PENDING_VERIFICATION`. They do **not** mark dues as `PAID` or issue final receipts until a Revenue Officer reconciles them against bank scrolls. |
| **Non-Retroactive Rate Master** | Publishing new rates or revising existing slabs applies strictly to future billing cycles. Historical unpaid dues maintain their original assessed amount. |
| **Idempotency Protection** | All mutation endpoints accept `Idempotency-Key` headers. In flaky field network conditions, re-sent requests return the existing transaction without double-charging. |
| **Overpayment Guard** | Overpayment is rejected by default to prevent unauthorized advance ledger balances, unless the advance payment policy is explicitly enabled in system settings. |
| **Privacy-Safe Public Verification** | Scanning a receipt QR or querying `GET /api/v1/receipts/verify/:code` validates authenticity while masking citizen mobile numbers, addresses, and full ledger history. |
| **Append-Only Audit Trail** | Every sensitive action (login, waiver, rate revision, manual UTR approval, deactivation) generates an immutable audit record with correlation IDs, timestamps, actor IDs, and IP addresses. |

---

## 👥 Multi-Role User Experiences

SuvidhaPay provides four specialized role consoles accessible via the top-bar role switcher or distinct credentials:

### 1. 🏢 Administrator ERP Console (`ADMIN`)
- **Operational Dashboard**: 11 drill-down KPI cards (Total Collections Today, Monthly Trajectory, Outstanding Dues, Active Collections, Pending Officer Verifications, Reconciliation Health) and 8 analytical trend charts.
- **Governance & Masters**:
  - **User Management**: Create, assign wards/zones, and safely deactivate staff (non-destructive; prevents orphaned records).
  - **Wards & Zones**: Ward-to-zone topological hierarchy and jurisdiction mapping.
  - **Entity Categories**: Commercial vehicle types, passenger vehicles, static stalls, mobile pushcarts, and weekly haat vendors.
  - **Rate Master**: Slabs with effective-from/to timestamps, grace periods, penalty percentages, and overlap conflict detection.
  - **Batch Due Generator**: Automated periodic billing calculation with duplicate-period prevention.
- **Financial Reconciliation Workspace**: 3-way matching between Gateway Settlement orders, Municipal Ledger entries, and Bank scroll items.
- **Legacy Register Import**: Staged CSV/Excel tabular upload with row-level validation, error reporting, and rollback-safe commit.

### 2. ⚖️ Revenue Officer Operations (`OFFICER`)
- **Jurisdiction Enforcement**: Officers only view and adjudicate entities, dues, and staff within their assigned Zones/Wards.
- **Entity Registration Queue**: Review pending field registrations with live integration checks against **Vahan** (vehicle registration) and **PM SVANidhi** (vendor identity).
- **Daily Cash Closing Verification**: Four-stage closing lifecycle (`OPEN` → `SUBMITTED` → `OFFICER_VERIFIED` → `CLOSED`) with variance auditing between physical cash count and ledger totals.
- **Manual UPI Verification Queue**: Cross-verify field-entered UTR references against municipal bank account credits before marking dues as paid.
- **Waivers & Adjustments**: Authorize interest waivers, corrections, or disputed fee adjustments with mandatory justification logging.

### 3. 📱 Field Agent Mobile App (`AGENT`)
- **Ergonomic Field Design**: Touch targets `>=44px`, high-contrast outdoor theme, bottom thumb-reach action sheet.
- **Rapid Search**: Search by normalized vehicle registration (`UP-16-AB-1234` matches `up16ab1234`), vendor ID, phone number, receipt number, or payment reference.
- **Sub-30-Second Collections**:
  - Accept **Cash** or record **Manual UPI UTR**.
  - Dynamic **FIFO multi-due allocation** preview showing exactly how the payment satisfies interest, penalties, and principal.
- **Offline Mode & Provisional Receipts**:
  - Offline payment queueing when field network drops.
  - Provisional receipt generation with tamper-evident offline identifiers and automatic sync reconciliation upon reconnection.
- **Shift Cash Closing**: End-of-day denomination counter, automatic variance calculation, and digital submission to the supervisor.

### 4. 🇮🇳 Citizen Self-Service Portal (`CITIZEN`)
- **Passwordless Mobile Login**: Secure Indian 10-digit mobile number authentication with rate-limited OTP simulation.
- **Ownership Isolation**: Citizens can only view and manage municipal entities (vehicles/stalls) registered to their verified phone number.
- **Itemized Due Ledger**: Transparent breakdown of base fees, municipal taxes, and late surcharges.
- **Online Checkout**: Dynamic BharatQR and UPI Intent simulation for instant settlement and real-time receipt generation.
- **Downloadable Receipts**: Print-ready, authoritative municipal receipts complete with QR verification code and watermark.

---

## 💻 Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript 5+, Tailwind CSS v4, Motion (Framer Motion), Lucide React |
| **Backend** | Node.js 22+, Express 4+, TypeScript (full-stack dev server with `tsx`) |
| **Validation** | Zod v4 schemas for every API route parameter, body, and query string |
| **Security** | Scrypt password hashing, short-lived JWTs, rotating refresh tokens, rate-limiting, CORS, Helmet security headers |
| **Data Storage (Dev)** | File-backed JSON repositories with atomic temporary-file writes (`fs.rename`) and in-process mutex locking |
| **Data Storage (Target)** | PostgreSQL 16+ with ACID transaction isolation (see migration plan) |
| **External Adapters** | Replaceable mock adapters for Payment Gateways (Razorpay/Cashfree), SMS/WhatsApp DLT notifications, and Gov APIs (Vahan/SVANidhi) |
| **Testing** | Vitest 5+, Supertest 7+ (automated end-to-end integration suite) |

---

## 📂 Repository Structure

```text
├── .env.example                          # Environment variable configuration template
├── README.md                             # System overview, architecture, and developer guide
├── package.json                          # Scripts, full-stack dependencies, and test tooling
├── server.ts                             # Full-stack Node.js server (Express API + Vite middleware)
├── vite.config.ts                        # Vite bundler configuration with Tailwind CSS v4
├── tsconfig.json                         # Strict TypeScript configuration
├── data/                                 # Persistent JSON development database (seeded automatically)
│   ├── users.json                        # Scrypt credentials, roles, and ward jurisdictions
│   ├── entities.json                     # Registered vehicles, vendor stalls, and owners
│   ├── dues.json                         # Due ledger records and adjustment histories
│   ├── payments.json                     # Payment transactions (Cash, UPI, Gateway)
│   ├── receipts.json                     # Server-issued authoritative receipts
│   ├── closings.json                     # Daily agent cash closing records
│   ├── reconciliation.json              # Bank reconciliation statements
│   └── audit_logs.json                   # Append-only immutable system audit trail
├── src/
│   ├── main.tsx                          # React entry point
│   ├── App.tsx                           # Master application container and live backend state sync
│   ├── index.css                         # Tailwind CSS v4 directives and typography
│   ├── types/
│   │   └── suvidha.ts                    # Universal domain types, enums, and interfaces
│   ├── components/
│   │   ├── AdminDashboardAndEntities.tsx # Admin KPI dashboard and entity registry views
│   │   ├── AdminDuesPaymentsReceipts.tsx # Dues engine, payment ledgers, and reconciliation
│   │   ├── AdminGovernanceAndOps.tsx     # Rate master, user management, and import wizard
│   │   ├── AgentAndCitizenShells.tsx     # Field Agent mobile app & Citizen self-service portal
│   │   └── SharedModals.tsx              # Receipt printer, public verification, and auth modals
│   ├── data/
│   │   └── mockSuvidhaData.ts            # Deterministic Indian municipal seed dataset
│   ├── services/
│   │   └── apiClient.ts                  # Frontend API client communicating with /api/v1
│   └── server/
│       ├── app.ts                        # Express REST API application and route wiring
│       ├── infra/
│       │   └── core.ts                   # Money utility (integer paise), JWT, scrypt, errors
│       ├── schemas/
│       │   └── validationSchemas.ts      # Zod validation schemas for all requests
│       ├── repositories/
│       │   ├── interfaces.ts             # DataStore repository abstractions
│       │   └── jsonDataStore.ts          # JSON file implementation with atomic file renaming
│       ├── adapters/
│       │   └── mockAdapters.ts           # Payment Gateway, Notification, and Vahan adapters
│       ├── middleware/
│       │   └── authMiddleware.ts         # JWT authentication, RBAC, and ward jurisdiction checks
│       ├── services/
│       │   ├── authAndUsersService.ts    # Authentication, password resets, user CRUD
│       │   ├── entitiesRatesDuesService.ts # Registration, Rate Master, and Dues engine
│       │   ├── paymentsReceiptsService.ts # Cash/UPI collection, receipts, and refund logic
│       │   └── operationsAndReportsService.ts # Closings, reconciliation, reports, imports
│       ├── openapi/
│       │   └── spec.ts                   # OpenAPI 3.1 schema specification
│       ├── scripts/
│       │   └── seedCli.ts                # Command-line seed and reset utility
│       ├── docs/
│       │   └── POSTGRES_MIGRATION_PLAN.md # Complete PostgreSQL 16+ production migration guide
│       └── __tests__/
│           └── suvidhaApi.test.ts        # Comprehensive Supertest + Vitest test suite
```

---

## ⚡ Quick Start & Developer Workflow

### Prerequisites
- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **npm**: `v10.x` or higher

### 1. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 2. Database Seeding
Initialize the development JSON database with realistic municipal test data:
```bash
npm run seed
```
*(This creates deterministic data files in `./data/` if they do not already exist).*

### 3. Start Development Server
Launch the combined Express API backend and Vite frontend on port 3000:
```bash
npm run dev
```
Open your browser at: **`http://localhost:3000`**

### 4. Available Scripts

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts full-stack Express server with Vite middleware on port 3000 |
| `npm test` | Runs the automated Vitest + Supertest integration test suite |
| `npm run seed` | Seeds initial development data non-destructively |
| `npm run reset` | Flushes and resets `./data/` back to initial clean state |
| `npm run lint` | Runs TypeScript type checking across the entire codebase (`tsc --noEmit`) |
| `npm run build` | Compiles frontend assets for production into `dist/` |
| `npm start` | Starts the production Node.js server |

---

## 🔑 Default Seeded Demo Credentials

For testing and demonstration, the following pre-configured accounts are seeded with scrypt-hashed credentials:

| Role | Name & Designation | Login Identifier | Password | Jurisdiction / Scope |
| :--- | :--- | :--- | :--- | :--- |
| **`ADMIN`** | Anupam Kulkarni, IAS (Commissioner) | `admin.kulkarni` | `Suvidha@Admin2026` | Universal Access (`ALL WARDS`) |
| **`OFFICER`** | Rajeshwari Verma (Revenue Officer) | `ro.rajeshwari` | `Suvidha@Officer2026` | Zone 2 (`W-12, W-14`) |
| **`OFFICER`** | Arvind Swaminathan (Asst. Revenue Officer) | `aro.arvind` | `Suvidha@Officer2026` | Zone 1 & 3 (`W-04, W-19`) |
| **`AGENT`** | Suresh Kumar Sharma (Tax Collector) | `AG-104` | `Suvidha@Agent2026` | Ward 12 (`W-12`) |
| **`AGENT`** | Manoj Kumar Tiwari (Tax Collector) | `AG-108` | `Suvidha@Agent2026` | Ward 14 (`W-14`) |
| **`AGENT (Disabled)`**| Pradeep Singh Rawat (Suspended) | `AG-112` | `Suvidha@Agent2026` | Ward 04 (`W-04`) *(Login Blocked)* |
| **`CITIZEN`** | Ramesh Chandra Yadav (Owner) | `9811452310` | `Suvidha@Citizen2026` | Entities `ENT-1001`, `ENT-1002` |

> 💡 **Tip:** You can also instantly switch between roles using the role dropdown in the top navigation bar of the application.

---

## 📡 Authoritative REST API Reference (`/api/v1`)

The backend exposes an authoritative REST API adhering strictly to HTTP semantics, standard JSON responses, and role-based authorization.

### Interactive OpenAPI Documentation
- **Swagger / OpenAPI JSON**: `GET /api/v1/openapi.json` or `GET /openapi.json`
- **Documentation UI**: `http://localhost:3000/docs`

### Primary Endpoint Groups

#### Authentication & Profile (`/api/v1/auth`)
- `POST /api/v1/auth/login` — Authenticate using username/mobile and password. Returns JWT access token and HTTP-only refresh token.
- `POST /api/v1/auth/refresh` — Rotate refresh token and issue new short-lived access token.
- `POST /api/v1/auth/logout` — Revoke active refresh token.
- `POST /api/v1/auth/forgot-password` — Request a single-use password reset token.
- `POST /api/v1/auth/reset-password` — Reset password using verified token.
- `POST /api/v1/auth/change-password` — Update account password with old password verification.
- `GET /api/v1/auth/me` — Retrieve active authenticated user claims and profile.

#### User Management & Jurisdictions (`/api/v1/users`, `/api/v1/wards`, `/api/v1/zones`)
- `GET /api/v1/users` — List municipal staff with optional role and status filters (`ADMIN`, `OFFICER`).
- `POST /api/v1/users` — Create new staff account (`ADMIN` only).
- `GET /api/v1/users/:id` — Get staff member details.
- `PUT /api/v1/users/:id` — Update profile, phone, or ward assignments.
- `PATCH /api/v1/users/:id/status` — Deactivate or reactivate user account (prevents hard deletion).
- `GET /api/v1/wards` — List all municipal wards with zone associations.
- `GET /api/v1/zones` — List municipal zones.

#### Municipal Entities & Registrations (`/api/v1/entities`)
- `GET /api/v1/entities` — Paginated list of registered vehicles and vendor stalls.
- `POST /api/v1/entities` — Register new entity (Citizen self-registration or Agent field registration).
- `GET /api/v1/entities/search?q=...` — Rapid fuzzy search by normalized vehicle plate, vendor code, or mobile.
- `GET /api/v1/entities/:id` — View entity registration details.
- `PUT /api/v1/entities/:id` — Edit entity metadata (subject to ownership/jurisdiction).
- `GET /api/v1/entities/:id/dues` — View full historical due ledger for an entity.
- `GET /api/v1/entities/:id/outstanding` — View pending dues balance and interest summary.
- `POST /api/v1/entities/:id/submit` — Submit draft registration for officer review.
- `POST /api/v1/entities/:id/approve` — Officer approval of entity registration.
- `POST /api/v1/entities/:id/reject` — Officer rejection of entity registration with reason.

#### Rate Master & Dues Engine (`/api/v1/rates`, `/api/v1/dues`)
- `GET /api/v1/rates` — List all active and historical rate master records.
- `POST /api/v1/rates` — Create and publish a new rate slab (`ADMIN` only). Ensures non-retroactivity.
- `GET /api/v1/rates/:id` — View rate slab details.
- `GET /api/v1/dues` — Paginated due ledger with filters for status, ward, and entity.
- `POST /api/v1/dues/batch-generate` — Execute batch due generation preview and commit for a billing period.
- `POST /api/v1/dues/:id/adjust` — Adjudicate due correction or amount adjustment.
- `POST /api/v1/dues/:id/waive` — Officer/Admin waiver of penalties or surcharges with audit reason.

#### Payments & Receipts (`/api/v1/payments`, `/api/v1/receipts`)
- `POST /api/v1/payments/cash` — Field agent cash collection with atomic FIFO due allocation and receipt creation.
- `POST /api/v1/payments/manual-upi` — Record field UPI reference (held in `UNVERIFIED_MANUAL_REF` state).
- `POST /api/v1/payments/orders` — Create online payment gateway order for citizen checkout.
- `POST /api/v1/payments/webhook` — Gateway callback for online payment completion.
- `POST /api/v1/payments/:id/verify` — Officer verification of manual UPI UTR against bank scroll.
- `POST /api/v1/payments/:id/refunds` — Initiate payment refund/dispute adjudication.
- `POST /api/v1/payments/:id/reverse` — Officer reversal of incorrectly entered payment.
- `GET /api/v1/receipts` — Query issued receipts.
- `GET /api/v1/receipts/:id` — Fetch complete receipt data with itemized dues breakdown.
- `GET /api/v1/receipts/:id/pdf` — Download authoritative municipal PDF receipt.
- `GET /api/v1/receipts/verify/:code` — **Public, privacy-masked verification endpoint**.

#### Collections & Day-End Cash Closing (`/api/v1/collections`)
- `GET /api/v1/collections/today` — Field agent live daily collection progress and cash tally.
- `GET /api/v1/collections/summary` — Municipal aggregate collection summary.
- `GET /api/v1/collections/closing` — List cash closing submissions.
- `POST /api/v1/collections/closing` — Agent creates end-of-day closing record.
- `POST /api/v1/collections/closing/:id/submit` — Submit closing to supervisory officer.
- `POST /api/v1/collections/closing/:id/verify` — Officer review, physical cash verification, and closing sign-off.

#### Reconciliation & Audit (`/api/v1/reconciliation`, `/api/v1/audit-logs`)
- `GET /api/v1/reconciliation` — Fetch financial reconciliation dashboard and discrepancies.
- `POST /api/v1/reconciliation/run` — Run automated 3-way matching job.
- `POST /api/v1/reconciliation/:id/resolve` — Mark reconciliation mismatch as resolved.
- `GET /api/v1/audit-logs` — Query append-only audit trail with filtering by actor, action, and date range.
- `GET /api/v1/reports/collections/daily` — Daily collections export and aggregated breakdown.
- `GET /api/v1/reports/outstanding` — Aging analysis of outstanding municipal dues.

---

## ⚙️ Configuration & Environment Variables

Configure application settings by copying `.env.example` to `.env`:

```bash
cp .env.example .env
```

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | Port for the Express server and Vite frontend |
| `NODE_ENV` | `development` | Runtime environment (`development`, `production`, `test`) |
| `SUVIDHAPAY_DATA_DIR` | `./data` | Directory where persistent JSON files are stored |
| `JWT_ACCESS_SECRET` | *dev secret* | Secret key for signing short-lived access tokens (override in production) |
| `JWT_REFRESH_SECRET` | *dev secret* | Secret key for signing rotating refresh tokens (override in production) |
| `JWT_ACCESS_EXPIRES_SEC` | `900` | Access token lifespan (15 minutes) |
| `JWT_REFRESH_EXPIRES_SEC`| `604800` | Refresh token lifespan (7 days) |
| `CORS_ORIGIN` | `*` | Allowed CORS origins for API requests |
| `ALLOW_ADVANCE_OVERPAYMENT`| `false` | Whether to allow payments exceeding outstanding dues balance |
| `GEMINI_API_KEY` | *(optional)* | Injected by AI Studio runtime for server-side generative capabilities |
| `APP_URL` | *(optional)* | Cloud Run service public URL |

---

## 🧪 Automated Testing & Quality Assurance

SuvidhaPay includes an automated test suite using **Vitest** and **Supertest** to test critical civic and financial invariants.

Run the test suite:
```bash
npm test
```

### Verified Test Invariants:
1. **Authentication & Token Lifecycle**: Scrypt verification, short-lived JWT issuance, refresh token rotation, replay revocation (`401 REFRESH_TOKEN_REVOKED`), and password reset token invalidation.
2. **RBAC & Jurisdiction Enforcements**: Rejection of cross-ward actions (`403 FORBIDDEN`), Citizen record isolation, and Officer jurisdiction scoping.
3. **Registration & Normalization**: Case-insensitive and hyphen-insensitive vehicle matching (`UP16AB1234` = `up-16-ab-1234`), Indian 10-digit mobile validation (`^[6-9]\d{9}$`), and duplicate registration guards.
4. **Non-Retroactive Rate Master Engine**: Verifying that a new rate slab does not modify existing unpaid dues from previous periods, batch due generation duplicate checks, and interest waiver audit trails.
5. **Cash Collections & FIFO Allocation**: Integer paise precision calculations, server-side receipt generation (`SUP/YYYY/0000XXXXX`), strict overpayment blocking, and idempotency protection on retries.
6. **Manual UPI UTR Quarantine**: Ensuring unverified UPI transactions remain pending without receipts until explicit Officer approval, and privacy masking of citizen PII on the public verification endpoint.
7. **End-of-Day Closing & Reconciliations**: Cash closing state machine (`OPEN` → `SUBMITTED` → `OFFICER_VERIFIED` → `CLOSED`), variance auditing, payment reversals, and staged legacy register batch commit.

### Running and Testing
# 1. Start the application in development mode (Express server + Vite on port 3000)
npm run dev

# 2. Run deterministic database seed (idempotent, skips duplicates if already seeded)
npm run seed

# 3. Reset database to fresh seed (development/testing only, blocked in production)
npm run reset

# 4. Run TypeScript typecheck / lint
npm run lint

# 5. Run full automated integration test suite
npm test

# 6. Build production frontend assets
npm run build

# 7. Start production server
npm start

---

## 🗃️ Production Deployment & Database Migration

### Moving from Development JSON Store to Production PostgreSQL
In development, SuvidhaPay uses an in-process, file-backed storage engine (`JsonFileDataStore`) that guarantees atomic updates using temporary-file swaps (`.tmp` → `.json`).

For multi-instance clustering, high concurrency, and statutory audit durability:
1. Review the production migration blueprint:
   [`src/server/docs/POSTGRES_MIGRATION_PLAN.md`](src/server/docs/POSTGRES_MIGRATION_PLAN.md)
2. The guide provides:
   - Complete PostgreSQL 16+ DDL with native UUID primary keys, check constraints, foreign keys, and indexes.
   - Exact integer paise column definitions (`BIGINT` paise).
   - SQL schema for audit logs, rate slabs, and payment transactions.
   - Clean implementation pattern for swapping `IDataStore` with a PostgreSQL connection pool (`pg` / `Drizzle ORM`).

### Building for Production
```bash
# 1. Typecheck the entire codebase
npm run lint

# 2. Build the optimized Vite client bundle
npm run build

# 3. Start the Node.js production server
npm start
```

---

## 📄 License

Licensed under the **Apache License, Version 2.0**. See [`LICENSE`](LICENSE) or the header declarations across source files for terms.
