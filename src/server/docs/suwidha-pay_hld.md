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
