The SuvidhaPay — Municipal Collection Management System interactive prototype and master architectural specification has been designed and implemented across all 21 blueprint sections (Parts A–U, Sections 1–64).
Key Capabilities & Role Experiences
Role-Specific Application Shells (Top Bar Switcher)
Administrator ERP Console (ADMIN): Operational dashboard with 11 drill-down KPI cards, 8 analytical revenue/dues/agent breakdown charts, unified entity registry, rate master, batch due generator, atomic payment allocation viewer, settlement reconciliation workspace, legacy CSV staging import, and read-only audit logs.
Revenue Officer Operations Console (OFFICER): Supervisory queue for vehicle/vendor registration approvals, agent daily cash closing verification (OPEN → SUBMITTED → OFFICER_VERIFIED → CLOSED), manual UPI UTR verification, due waiver approvals, and dispute adjudication.
Field Agent Mobile Application (AGENT): Touch-optimized (≥44px hitboxes) mobile-first interface featuring normalized vehicle/vendor fast search (UP16AB1234 = up-16-ab-1234), under-30-second collection workflow for Cash and Manual UPI UTRs, offline connectivity mode with provisional receipt queueing, and daily physical cash closing.
Citizen Self-Service Portal (CITIZEN): OTP-verified portal enforcing strict record ownership, detailed due breakdowns, UPI Intent / Dynamic QR online payment simulation (awaiting backend webhook verification before marking dues as paid), and printable PDF/QR receipts.
Strict Financial & Civic Governance Invariants
Verified vs. Unverified Payments: Browser redirects never mark an online payment as PAID without server webhook confirmation; manually entered field UPI UTRs are recorded as UNVERIFIED_MANUAL_REF (PENDING_VERIFICATION) until Officer bank reconciliation.
Immutable Historical Dues & Atomic Allocations: Publishing a new Rate Master (RT-2027-01) never recalculates historical unpaid dues (RT-2025-01). Multi-due payments (₹500 → ₹200 + ₹200 + ₹100) are allocated atomically with zero ordinary delete actions on financial records.
Server-Generated Receipts & Public Verification: Authoritative receipt numbering (SUP/2026/000012345) with a privacy-safe Public Receipt Verification modal that confirms validity while masking personal mobile numbers, addresses, and full ledger histories.
Master Deliverables & Traceability Matrix: Click Traceability Matrix in the top navigation bar to inspect the Requirements Traceability Matrix, Sitemap, Design Tokens, Phase 0–8 Roadmap, and jump directly to any live screen.







The SuvidhaPay — Municipal Collection Management System backend (/api/v1) has been fully architected, implemented, integrated with the frontend, and verified with automated tests.
1. Modules Completed (100% Coverage Across Modules A–Q)
Authentication & RBAC (Section 5): Scrypt password hashing, short-lived JWT access tokens, refresh-token rotation with replay revocation (401 REFRESH_TOKEN_REVOKED), single-use expiring password reset tokens, account lockout after 5 failed attempts, and role + ward jurisdiction + citizen record-ownership enforcement.
Module A — Users, Roles, Wards & Zones: Full CRUD with safe account deactivation (DISABLED / LOCKED revoking active sessions instead of destructive deletion), ward-to-zone hierarchy, and login session history.
Module B — Categories & Unified Entity Registration: Configurable vehicle/vendor categories, normalized vehicle registration search & duplicate blocking (UP-16-AB-1234 = up 16 ab 1234), 10-digit Indian mobile validation, and DRAFT → SUBMITTED → ACTIVE / REJECTED workflow with ward jurisdiction checks.
Module C & D — Rate Master & Due Engine: Non-retroactive rate publication (historical dues retain their original rate and amount), overlap conflict detection, rate-based batch due generation with duplicate-period guards, and auditable due adjustments & waivers.
Module E & F — Payments, Allocations & Financial Integrity: Integer paise arithmetic (Money utility), FIFO and explicit multi-due allocation, Idempotency-Key replay safety, overpayment blocking, and non-destructive payment refunds & reversals that restore due balances.
Module G — Official Receipts & Public Verification: Authoritative server-generated receipt numbering (SUP/2026/000012347), PDF payload generation, and privacy-safe public verification (GET /api/v1/receipts/verify/:code) that masks personal mobile numbers, addresses, and full ledger histories.
Module H & I — Field Collections & Daily Cash Closing: Fast multi-field search, today's collection summaries, and OPEN → SUBMITTED → OFFICER_VERIFIED → CLOSED cash closing workflow (immutable by agents once submitted).
Module J, K & L — Reconciliation, Disputes & Reports: 6-state gateway vs. ledger reconciliation workspace, dispute adjudication, mathematically reconciled collection/outstanding reports, and CSV export.
Module M, N, O, P & Q — Notifications, Vahan Verification, Audit Logs, Staged Import & Settings: Replaceable adapter interfaces and mock providers for Razorpay/Cashfree, SMS/WhatsApp, and Vahan/SVANidhi verification; staged CSV/JSON import with row-level duplicate/mobile validation before commit; read-only cryptographic audit logs; and OpenAPI 3.1 documentation (/openapi.json and /docs).
2. REST API Endpoint Inventory (/api/v1)
Authentication: POST /auth/login, POST /auth/refresh, POST /auth/logout, POST /auth/forgot-password, POST /auth/reset-password, POST /auth/change-password, GET /auth/me
Users & Jurisdictions: GET /users, POST /users, GET /users/:id, PATCH /users/:id, PATCH /users/:id/status, GET /wards, POST /wards, GET /zones, POST /zones
Categories, Entities & Registrations: GET /categories, POST /categories, GET /entities, POST /entities, GET /entities/search, GET /entities/:id, PATCH /entities/:id, GET /entities/:id/dues, GET /entities/:id/outstanding, GET /entities/:id/payments, POST /entities/:id/submit, POST /entities/:id/approve, POST /entities/:id/reject
Rates & Dues: GET /rates, POST /rates, GET /rates/:id, PATCH /rates/:id, GET /dues, POST /dues, POST /dues/:id/adjust, POST /dues/:id/waive
Payments & Receipts: POST /payments/cash, POST /payments/manual-upi, POST /payments/orders, GET /payments, GET /payments/:id, GET /payments/:id/status, POST /payments/:id/verify, POST /payments/:id/refunds, POST /payments/:id/reverse, GET /receipts, GET /receipts/:id, GET /receipts/:id/pdf, GET /receipts/verify/:code
Field Collections & Daily Closing: GET /collections/today, GET /collections/summary, GET /collections/closing, POST /collections/closing, GET /collections/closing/:id, POST /collections/closing/:id/submit, POST /collections/closing/:id/verify
Reconciliation, Disputes & Reports: GET /reconciliation, POST /reconciliation/run, GET /reconciliation/:id, POST /reconciliation/:id/resolve, GET /disputes, POST /disputes, POST /disputes/:id/resolve, GET /reports/collections/daily, GET /reports/collections/monthly, GET /reports/collections/agents, GET /reports/collections/categories, GET /reports/collections/wards, GET /reports/outstanding, GET /reports/export
Notifications, Vahan, Audit, Import & System: GET /notifications, POST /notifications, GET /notifications/:id, POST /notifications/:id/retry, GET /notification-templates, POST /notification-templates, POST /verifications/vehicles, GET /verifications/:id, POST /verifications/:id/retry, POST /imports, POST /imports/:id/commit, GET /audit-logs, GET /settings, PATCH /settings, GET /health, GET /health/live, GET /health/ready, GET /openapi.json, GET /docs
3. Development Demo Credentials (Seeded & Scrypt-Hashed)
Administrator (ADMIN — All Wards): loginIdentifier: admin.kulkarni | password: Suvidha@Admin2026
Revenue Officer Zone 2 (OFFICER — Wards W-12, W-14): loginIdentifier: ro.rajeshwari | password: Suvidha@Officer2026
Revenue Officer Zone 1 & 3 (OFFICER — Wards W-04, W-19): loginIdentifier: aro.arvind | password: Suvidha@Officer2026
Field Agent (AGENT — Ward W-12): loginIdentifier: AG-104 | password: Suvidha@Agent2026
Disabled Agent (DISABLED — Ward W-04): loginIdentifier: AG-112 | password: Suvidha@Agent2026
Citizen (CITIZEN — Linked ENT-1001, ENT-1002): loginIdentifier: 9811452310 | password: Suvidha@Citizen2026
4. Commands, Verification & Known Limitations
Commands:
npm run dev — Starts full-stack Express + Vite server on port 3000
npm run seed — Non-destructively initializes ./data/*.json if missing
npm run reset — Resets ./data/*.json to the deterministic seed state
npm test — Runs the Vitest + Supertest integration suite (7/7 passed)
npm run lint & npm run build — Runs TypeScript check (0 errors) and production build
JSON Persistence & Mock Integration Limitations:
File-backed JSON persistence (JsonFileDataStore) serializes writes within a single Node.js process using an in-memory mutex and atomic temp-file renames. It does not provide multi-instance concurrency or ACID durability; see src/server/docs/POSTGRES_MIGRATION_PLAN.md for the complete PostgreSQL DDL and unit-of-work migration path.
External payment gateways, SMS/WhatsApp providers, and Vahan/SVANidhi lookups run via replaceable mock adapters (src/server/adapters/mockAdapters.ts).