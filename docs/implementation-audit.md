# Implementation audit

## Baseline — 2026-10-25

This checkout has no .git directory. Existing changes cannot be distinguished from committed files. No staging, commits, reset, deployment, or live payment operations are authorized. Existing data files must be preserved.

Architecture: independent React 19 / Vite / Tailwind frontend and Express / TypeScript backend; four domain services behind IDataStore; pg SQL repositories and versioned SQL migrations. Preserve these conventions rather than replacing the UI framework. Tests use Vitest, Supertest and pg-mem (not a real PostgreSQL server).

Inspected manifests, lockfiles, configuration, routes, auth/ward middleware, services, SQL migration and migrator, stores, adapters, frontend entry/state/API client, tests and Dockerfiles. No CI workflow, root manifest, Compose file or frontend nginx.conf exists despite README claims. Data directories contain legacy JSON stores; they have not been modified or treated as verified financial records.

## Executed baseline

- npm ci --ignore-scripts: succeeded in both packages; installation audit reported zero vulnerabilities.
- Backend npm run lint and npm run build: failed, missing lokijs dependency and Collection type.
- Backend npm test: 6 migration tests passed; 3 suites failed to import missing lokijs.
- Frontend npm run lint: failed on four missing legacy component modules and consequent type errors.
- Frontend npm run build: failed resolving the missing component modules.
- Backend build script currently only typechecks (noEmit); start expects a nonexistent dist/server.js.

## Critical findings

1. PostgreSQL failure silently creates pg-mem and advertises durable PostgreSQL health. Startup also seeds demo accounts unconditionally.
2. User explicitly requested removal of LokiJS and its dependencies; do not add it. Keep legacy data untouched; no automatic conversion or deletion.
3. Payment verification admits citizens and trusts simulateOutcome; gateway mock has a fixed signature bypass. External adapters always simulate delivery or successful government verification.
4. SQL unit of work reads through the pool outside its transaction; whole-state upserts can lose concurrent updates. Sessions, reset tokens and idempotency records are read but not synchronized by the SQL writer. Financial DTO mapping fabricates receipt details and drops statuses. This needs a separately verified persistence redesign before production.
5. Failed login changes occur inside a transaction which then throws, rolling back failed-attempt counters. Access tokens are not linked to revocable sessions. Password reset delivery and refresh replay handling need end-to-end review.
6. Some officer/list routes omit jurisdiction enforcement. Today collection summary lacks date filtering. Closing transaction snapshots and correction policy remain incomplete.
7. Frontend imports point to pre-refactor paths; initial state contains demonstration records, and dashboard cards contain hardcoded amounts. Several simulated controls remain.
8. No browser E2E suite, real PostgreSQL upgrade/concurrency tests, load evidence, restore exercise or deployment verification exists.

## Execution priorities

A: remove LokiJS runtime and fallback, repair relocated imports, restore executable checks.
B: fail closed on unsafe production configuration and unconfigured integrations; prevent citizen/client confirmation of gateway payments.
C–E: persistence round-trip/transaction repairs, jurisdiction audit, immutable ledger and daily closing tests before extending workflows.
F: authorized provider integration requires provider selection, merchant onboarding, credentials and approved manual verification policy.
G: reproducible build/deployment and operational verification; never equate passing unit tests with launch approval.

This is an initial audit, not exhaustive workflow certification. See traceability and production-readiness for unverified scope.

## Implemented increment and affected files

- `backend/src/repositories/lokiDataStore.ts` deleted; `db/database.ts`, `scripts/seedCli.ts`, `infra/core.ts`, `repositories/interfaces.ts` updated: remove Loki runtime/fallback and corrupt-store replacement; fail closed with PostgreSQL-only startup; preserve data files.
- `backend/package.json`, `package-lock.json`: pg-mem moved to exact dev-only dependency; start uses installed tsx. No Loki package was present to uninstall.
- `backend/src/db/postgresDataStore.ts`: no implicit auto-seed; bounded connection configuration; transaction reads use their own client; serialized unit of work; dedicated authentication writer persists sessions/reset digests/audit without touching financial rows; error logs omit SQL row details.
- `backend/src/services/authAndUsersService.ts`: commit failed-attempt counters before returning authentication error; temporary lock expiration; hashed reset tokens; no public reset-token generation outside demo until delivery exists.
- `backend/src/services/paymentsReceiptsService.ts`: authorization before verification replay; gateway confirmations unavailable outside demo; cross-actor cash idempotency response blocked; changed outstanding amount requires reconciliation instead of silent under-allocation.
- `backend/src/adapters/mockAdapters.ts`, `app.ts`, `server.ts`: explicit demo-only simulated providers, unavailable real integrations, configured CORS, safe internal errors, correlation sanitization and request-draining shutdown.
- Existing API/search/repository tests now use isolated JSON fixtures. New `productionSafeguards.test.ts` covers 12 regression scenarios; `postgresAuthentication.test.ts` adds opt-in isolated real PostgreSQL auth verification. JSON fixture reset uses the existing canonical seed generator.
- `frontend/src/App.tsx`: feature-folder imports, empty initial state, no false healthy sync, explicit staff password input. `features/users/UserDirectory.tsx` and new `features/governance/CategoriesAndRatesView.tsx` restore missing functional views. `features/dashboard/OperationalDashboard.tsx` derives loaded-record cards rather than hardcoded amounts; receipt/payment re-export paths repaired.
- Backend/frontend Dockerfiles: lockfile installs; frontend Node 24 builder for the QR dependency engine requirement, non-root Nginx on 8080. New `frontend/nginx.conf` and root `docker-compose.yml` restore missing local routing/orchestration assets. `.env.example` uses placeholders and explicit demo opt-in. Frontend lockfile generated after container build exposed its absence.
- README and four requested docs distinguish historical claims from actual verification and remaining work.

## Data preservation

No existing JSON/Loki file or existing database was modified. Only a newly created isolated PostgreSQL test container received schema/seed/test changes. No new schema migration was required for this increment. Real schema upgrade paths, legacy imports and financial consistency are still release gates. Old plaintext reset tokens require reissue because the lookup now expects hashes.

