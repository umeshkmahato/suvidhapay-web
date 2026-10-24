# Architecture decisions

## ADR 001 — Retain the existing modular monolith
Keep React/Tailwind/Vite and Express/TypeScript/pg. Feature-folder imports should replace obsolete module paths. No framework rewrite or microservice split is justified.

## ADR 002 — PostgreSQL-only runtime
User requested removal of LokiJS. Remove its runtime adapter and use PostgreSQL without automatic pg-mem or JSON fallback. Database connection/migration errors must prevent HTTP startup, not create a replacement financial register. Keep pg-mem for explicitly isolated tests only. Existing JSON test store may support isolated workflow tests but is not a production storage option.

Legacy Loki files remain untouched. Moving existing financial records requires a separately reviewed, validated import with record counts and balances; never silently read an old store as a new production register.

## ADR 003 — Fail closed; demo is explicit
Demo accounts and simulated providers must not be enabled by production startup. Production requires separate non-placeholder signing secrets, durable PostgreSQL and a concrete allowed origin. Demo integrations are for explicit non-production mode/tests only. Missing external providers must return unavailable, not fabricated settlement or delivery.

## ADR 004 — Payment verification trust boundary
Manual UPI verification requires officer/admin authorization and jurisdiction before even an idempotent replay. Gateway payment confirmation may not be accepted from a citizen, browser success flag or an officer simulation in production. A live gateway implementation needs raw-body signature verification, provider amount/currency/order validation and persisted idempotent events; the current mock is not that integration.

## ADR 005 — Financial persistence release gate
The whole-collection IDataStore SQL implementation is not production-certified: incomplete write coverage and lossy mappings invalidate assumptions that JSON tests prove SQL workflows. A real PostgreSQL round-trip, rollback and cross-connection concurrency suite must precede financial release. Prefer incremental lossless schema migrations and targeted repositories; no destructive replacement of existing data.
