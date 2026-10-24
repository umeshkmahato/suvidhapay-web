## 1. Current Architecture & Project Structure

SuvidhaPay is structured as a TypeScript full-stack monorepo with independent frontend and backend services, each running in its own runtime and communicating through the REST API.

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
│  └─────────────────────────────────────────────────────┬───────────-┘  │
│                                                        ▼               |
│                                          ┌───────────────────────────┐ │
│                                          │ PostgreSQL        (SQL)   │ │
│                                          └───────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```
