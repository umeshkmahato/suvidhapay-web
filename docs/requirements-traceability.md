# Requirements traceability

Statuses refer to complete workflows, not presence of screens. No end-to-end workflow is certified solely from source inspection. Requirement numbers map to the master prompt sections.

| Requirement | Status | Existing implementation / evidence | Remaining acceptance |
|---|---|---|---|
| 1 municipal platform | PARTIALLY_IMPLEMENTED | Four domain services and role UI | All critical workflows on durable SQL |
| 2 repository audit | PARTIALLY_IMPLEMENTED | implementation-audit.md; baseline commands executed | Full workflow/data audit and real DB evidence |
| 3 architecture | PARTIALLY_IMPLEMENTED | React/Tailwind, Express, pg modular monolith | Retain existing frameworks; queue/deployment verification |
| 4 domain/migrations | IMPLEMENTED_BUT_DEFECTIVE | 001 schema; 6 baseline pg-mem tests pass | Lossless financial DTO mappings, payment idempotency persistence, cross-connection financial verification |
| 5 auth/RBAC | IMPLEMENTED_BUT_DEFECTIVE | Scrypt, JWT, roles and ward middleware | Access-token invalidation, scope gaps, replay-family response and reset delivery |
| 6 registration/search | PARTIALLY_IMPLEMENTED | entitiesRatesDuesService, search tests | Real SQL persistence, configurable entity classes, approval E2E |
| 7 immutable dues | PARTIALLY_IMPLEMENTED | Rates, due snapshots, adjustment methods | Effective-rate ambiguity, concurrency and history preservation on SQL |
| 8 payments | IMPLEMENTED_BUT_DEFECTIVE | Cash/manual UPI, FIFO allocation, receipt service | SQL round-trip, durable idempotency, concurrent allocation/refund invariants |
| 9 gateway | BLOCKED_BY_EXTERNAL_DEPENDENCY | Mock adapter only | Authorized provider selection and sandbox credentials; signed raw-body events |
| 10 receipts | IMPLEMENTED_BUT_DEFECTIVE | Server numbering, public verification | Remove fabricated SQL read fields, persist complete snapshot, authorized PDF/recovery |
| 11 closing/reconciliation | PARTIALLY_IMPLEMENTED | Operations service and UI | Date/scoping rules, immutable transaction references, correction policy |
| 12 role experiences | PARTIALLY_IMPLEMENTED | Role shells and forms | Remove simulations and verify permissions/UI workflows |
| 13 reports/import | PARTIALLY_IMPLEMENTED | Report/export and staged import methods | Correct scoped totals, safe CSV, actual historical validation/preview E2E |
| 14 notifications/government | BLOCKED_BY_EXTERNAL_DEPENDENCY | Provider interfaces and mock adapters | Credentials, legal approval, transactional outbox/worker and delivery evidence |
| 15 API quality | PARTIALLY_IMPLEMENTED | /api/v1, Zod, envelopes, OpenAPI | Complete contracts, rate limits, safe errors, structured metrics |
| 16 frontend | IMPLEMENTED_BUT_DEFECTIVE | Baseline build fails on moved imports | Import repair, no fake data, all error/pagination/session states |
| 17 offline | REQUIRES_BUSINESS_DECISION | UI mentions offline/provisional flows | No certified offline settlement; approved policy and synchronization design |
| 18 security/privacy | IMPLEMENTED_BUT_DEFECTIVE | Scrypt, security headers and ward guards | Session/scope/security review; retention/legal approval; no certification claimed |
| 19 tests | PARTIALLY_IMPLEMENTED | Vitest/Supertest and pg-mem suites | Browser E2E and isolated real PostgreSQL upgrade/concurrency tests |
| 20 deployment | IMPLEMENTED_BUT_DEFECTIVE | Two Dockerfiles | Missing nginx/Compose/CI, backend start output and image verification |
| 21 observability/DR | MISSING | Basic health only | Metrics/alerts, encrypted backup, restoration drill; RPO/RTO not verified |
| 22 performance | MISSING | Some indexes and bounded API pagination | Remove whole-store reads/writes; load/query analysis |
| 23 execution | PARTIALLY_IMPLEMENTED | Audit and prioritized increments | Remaining stages not complete |
| 24 policy/blockers | REQUIRES_BUSINESS_DECISION | Overpayment defaults false | Refund/waiver/manual UPI/offline/cutoff/rounding approval |
| 25 definition of done | PARTIALLY_IMPLEMENTED | Baseline evidence recorded | Production release gates remain unmet |
| 26 deliverables | PARTIALLY_IMPLEMENTED | Four requested documents | Final verification and actual changed-file handoff |

## Verified subrequirements in the initial increment

| Subrequirement | Status | Evidence |
|---|---|---|
| Remove LokiJS runtime/dependencies | IMPLEMENTED_AND_VERIFIED | Runtime source removed; npm ls has no lokijs; pg-mem is dev-only; unsupported engine rejected |
| No automatic replacement DB on PostgreSQL failure | IMPLEMENTED_AND_VERIFIED | productionSafeguards database failure regression |
| Explicit demo seeding/provider gating | IMPLEMENTED_AND_VERIFIED | Config and adapter regression tests; production demo rejected |
| Auth persistence independent of financial writer | IMPLEMENTED_AND_VERIFIED | postgresAuthentication.test on isolated PostgreSQL 16; payment rows unchanged |
| Failed-login lock counters/audit and expiry | IMPLEMENTED_AND_VERIFIED | JSON regression plus real PostgreSQL lockout integration |
| Reset-token digest and non-demo delivery unavailable | IMPLEMENTED_AND_VERIFIED | Digest regression and PASSWORD_RESET_NOT_CONFIGURED; provider delivery still blocked |
| Verification jurisdiction before replay | IMPLEMENTED_AND_VERIFIED | Cross-ward already-verified payment denied in regression |
| Cross-actor cash idempotency replay denied | IMPLEMENTED_AND_VERIFIED | productionSafeguards regression; full durable financial idempotency remains defective |
| Frontend moved imports and build | IMPLEMENTED_AND_VERIFIED | npm run lint and npm run build pass; restored forms not browser-E2E verified |
| Docker image builds/non-root frontend HTTP | IMPLEMENTED_AND_VERIFIED | Both builds pass; uid 101 and HTTP 8080 probe; backend readiness against test PostgreSQL |
| Complete municipal platform/production launch | PARTIALLY_IMPLEMENTED | Remaining broader requirements above are not superseded by these narrow checks |

Execution results and change-specific verification are recorded in production-readiness.md. No production readiness claim follows from passing these checks.
