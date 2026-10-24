# Production readiness

Assessment: NOT READY. Baseline audit exposes durability, authorization, persistence and build defects. No deployment or compliance certification is claimed.

## Verification ledger

Baseline: both npm ci --ignore-scripts passed with zero reported audit vulnerabilities. Backend lint/build failed on missing LokiJS; 6 pg-mem migration tests passed and 3 suites failed imports. Frontend lint/build failed on moved component imports. No real database, browser E2E, Docker image, restore or load test has been verified.

## Local commands

From backend: npm ci --ignore-scripts; npm run lint; npm run build; npm test; npm run dev.
From frontend: npm ci --ignore-scripts; npm run lint; npm run build; npm run dev.
Frontend Vite proxies /api to backend port 3000. Do not run seed/reset against existing records. Tests must use temporary directories or isolated databases only. Root wrapper scripts described by the old README do not exist.

## Release gates

- [ ] Lossless PostgreSQL read/write round trips for every domain, especially receipts, sessions and idempotency.
- [ ] Real PostgreSQL migration clean install and non-destructive upgrade, backup before upgrade.
- [ ] Cross-connection financial concurrency/idempotency, ledger and reconciliation invariants.
- [ ] Backend role/ward/ownership matrix and browser end-to-end suite.
- [ ] Production UI has no seeded balances, simulated confirmations or dead controls.
- [ ] Authorized payment/notification/government providers configured and sandbox verified.
- [ ] Reproducible images, ingress TLS, restricted CORS and database network, secret injection.
- [ ] Dependency/security review, privacy and municipal legal/policy signoff.
- [ ] Structured logs, metrics, queue/settlement/variance alerts with approved retention.
- [ ] Business acceptance and UAT; measured latency/concurrency targets.

## Operations and recovery (not exercised)

Use managed PostgreSQL encrypted backups with continuous WAL archiving if targeting provisional 15-minute RPO. Restrict backup/restore roles, encrypt transport/storage, monitor archive lag and failed backups. Restore into an isolated database, apply migration history, reconcile due/allocation/payment/receipt totals and test authenticated access before routing traffic. Measure restore duration against provisional 1–4 hour RTO; neither target is verified.

On financial incident: stop affected mutations, preserve audit/provider events, identify correlation IDs and reconcile trusted bank/provider records. Never repair by deleting successful payments or editing historical amounts. Roll back application images only when schema compatibility is confirmed; prefer forward corrective migrations. Restore-over-production, infrastructure deletion and live payment operations require explicit authorization.

## External and business blockers

Authorized PostgreSQL environment and deployment infrastructure; merchant onboarding/provider choice and sandbox credentials; SMS/WhatsApp DLT and OTP configuration; government legal access; DNS/TLS and operational ownership; approved refund, waiver, advance, manual UPI confirmation, offline, cutoff/timezone, penalty and retention policies. Safe default is no advance payments and no fabricated external confirmation.

## Change verification

### VERIFIED in this increment

- LokiJS runtime implementation removed; npm ls lokijs pg-mem shows only pg-mem, now dev-only. Remaining engine-name reference in executable source is a regression test asserting rejection.
- Backend lint/typecheck passes. npm run build passes but is only a typecheck under existing noEmit configuration; npm start now invokes installed tsx instead of a nonexistent dist file.
- Backend suite with dedicated SUVIDHAPAY_TEST_DATABASE_URL: 36/36 tests across 6 suites passed, including 12 new safeguard tests and one new real PostgreSQL authentication integration test.
- Real PostgreSQL 16 in a newly created isolated Docker container: clean migration 001 applied, repeat migration applied zero files. No existing database was migrated or reset.
- Real PostgreSQL login initially reproduced a NOT NULL ward_id failure caused by rewriting payment rows. Authentication now persists only user authentication fields, refresh sessions, hashed reset-token records and audit entries. Login, refresh rotation, logout and lockout pass against the real database; underlying payment rows remained byte-for-byte equivalent as JSON.
- Unit-of-work reads now use the same transaction connection. A PostgreSQL table lock serializes collection-based writes; this is a correctness bridge, not a performance claim.
- Production/demo configuration rejection, unavailable external providers, verification jurisdiction checks, cross-actor cash idempotency denial, failed-login persistence, CORS, malformed JSON and masked unexpected errors are regression-tested.
- Frontend typecheck and Vite production build pass. Build warns about a roughly 922 kB JS chunk before gzip; performance targets are not verified.
- Moved component imports repaired; user account and rate forms restored. Staff initial passwords are entered by an authorized user rather than hardcoded. Master state starts empty instead of seeded data; failed required sync cannot advertise a healthy live database.
- Two Dockerfiles use lockfile installation. Backend image built and readiness returned READY against the isolated PostgreSQL container. Compose configuration validates with placeholder test credentials.

### NOT VERIFIED / remaining code work

- SQL financial writes still have incompatible aliases, incomplete snapshots and missing domain persistence. Cash/payment/refund/receipt/closing workflows are NOT certified on PostgreSQL. JSON workflow tests do not establish SQL financial correctness.
- Payment idempotency persistence and request fingerprint validation; complete ward/ownership matrix; access-token revocation; complete refresh replay-family response; transactional notification outbox.
- Some other UI components still have hardcoded historical metrics, simulated controls and incomplete reporting/pagination. Restored user/rate forms are typechecked, not browser-E2E verified.
- Full Compose application startup and browser workflows have not been run. Both images built successfully. Frontend Nginx initially failed to write its PID as non-root; changing ownership of /run fixed startup. HTTP on port 8080 passed and the process user is uid 101 (nginx). Node 24 frontend builder removes the QR dependency's Node >=24 engine warning. Backend readiness passed against the isolated test DB. Only newly created test containers were stopped/removed afterward; build images remain local.
- No new schema migration was added. Existing schema has only clean/repeat verification, not an existing-production-data upgrade exercise.
- No complete compiled-JavaScript backend build, production dependency minimization, CI pipeline, load test, restore drill or live deployment has been verified.

### BLOCKED external workflows

Payment-provider confirmation/webhooks, secure password reset delivery, citizen OTP, government verification and real message delivery require authorized provider implementation/configuration. They now fail unavailable outside explicit non-production demo mode rather than manufacturing successful external results. Production launch additionally requires security/privacy/business approval and deployment-specific operations validation.

### Local environment and startup

Export environment variables into the backend process, or create an untracked backend/.env using the root .env.example as a reference. Required database configuration is DATABASE_URL or PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD. DATABASE_ENGINE must be POSTGRES. Set PORT if not 3000. Production requires distinct JWT_ACCESS_SECRET and JWT_REFRESH_SECRET (random, at least 32 characters) and one concrete CORS_ORIGIN. SUVIDHAPAY_DEMO_MODE defaults false outside tests and is forbidden in production. Do not enable demo on an existing municipal register.

For local Compose, set POSTGRES_PASSWORD, JWT_ACCESS_SECRET and JWT_REFRESH_SECRET through the local environment or an untracked root .env, then run docker compose up --build. Frontend is loopback-only localhost:8080. Backend/database are not host-published. Use docker compose down to stop while preserving the volume; do not remove the volume. This Compose configuration explicitly uses development mode and is not a production deployment recipe.

For the opt-in real authentication integration test, set SUVIDHAPAY_TEST_DATABASE_URL to a dedicated disposable database whose name ends in _test, then run npm test in backend. It seeds demo fixtures and changes test authentication records; never point it at municipal data. Without this variable that test is skipped.

### Compatibility and data preservation

Existing data/ and backend/data/ records have not been changed. Legacy Loki records are not automatically migrated. Previously issued plaintext password reset tokens no longer match the SHA-256 token digest lookup and must be reissued through an approved channel. Demo seed/reset CLI cannot operate in production or fall back to another store. No git add, commit, push, live payment or deployment was executed.
