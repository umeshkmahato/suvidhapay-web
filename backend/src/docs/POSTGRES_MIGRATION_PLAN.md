# SuvidhaPay — PostgreSQL Migration & Production Readiness Guide (Section 15)

## 1. Current Development Storage vs. PostgreSQL Target
- **Current Stage**: File-backed JSON repositories (`src/server/repositories/jsonDataStore.ts`) implementing `IDataStore` (`src/server/repositories/interfaces.ts`).
- **JSON Persistence Limitations**:
  1. Serialized via an in-process mutex (`withTransaction`) and atomic temp-file rename (`.tmp` -> `.json`).
  2. Suitable **only** for single-process development and automated API testing.
  3. Does **not** provide multi-instance locking, read-committed snapshot isolation, or WAL-backed ACID durability.
- **Target Stage**: PostgreSQL 16+ relational database using `BEGIN ... COMMIT / ROLLBACK` transactions inside a `PostgresDataStore` implementing the exact same `IDataStore` / repository interfaces.

## 2. Proposed PostgreSQL Relational Schema & Constraints

```sql
-- 1. Zones & Wards
CREATE TABLE zones (
  id VARCHAR(32) PRIMARY KEY,
  code VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(128) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE wards (
  id VARCHAR(32) PRIMARY KEY,
  code VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(128) NOT NULL,
  zone_id VARCHAR(32) NOT NULL REFERENCES zones(id),
  assigned_officer_id VARCHAR(32),
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE'
);

-- 2. Users & Refresh Sessions
CREATE TABLE users (
  id VARCHAR(32) PRIMARY KEY,
  full_name VARCHAR(128) NOT NULL,
  login_identifier VARCHAR(64) UNIQUE NOT NULL,
  mobile VARCHAR(15) NOT NULL,
  email VARCHAR(128) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(16) NOT NULL CHECK (role IN ('ADMIN','OFFICER','AGENT','CITIZEN')),
  assigned_ward VARCHAR(128) NOT NULL,
  assigned_zone VARCHAR(128) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

CREATE TABLE refresh_sessions (
  jti UUID PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL REFERENCES users(id),
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by_jti UUID,
  ip_address VARCHAR(64),
  user_agent TEXT
);
CREATE INDEX idx_refresh_sessions_user ON refresh_sessions(user_id);

-- 3. Categories & Rate Masters (Amounts stored in integer paise)
CREATE TABLE entity_categories (
  id VARCHAR(32) PRIMARY KEY,
  code VARCHAR(32) UNIQUE NOT NULL,
  name VARCHAR(128) NOT NULL,
  entity_type VARCHAR(16) NOT NULL CHECK (entity_type IN ('VEHICLE','VENDOR')),
  specific_fields JSONB NOT NULL DEFAULT '[]',
  applicable_fee_types JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE rate_masters (
  id VARCHAR(32) PRIMARY KEY,
  category_id VARCHAR(32) NOT NULL REFERENCES entity_categories(id),
  fee_type VARCHAR(128) NOT NULL,
  vehicle_type VARCHAR(64),
  frequency VARCHAR(16) NOT NULL,
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  effective_from DATE NOT NULL,
  effective_to DATE,
  ward_scope VARCHAR(32) NOT NULL DEFAULT 'ALL',
  status VARCHAR(16) NOT NULL,
  created_by VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category_id, ward_scope, effective_from)
);

-- 4. Unified Municipal Entities
CREATE TABLE municipal_entities (
  id VARCHAR(32) PRIMARY KEY,
  registration_number VARCHAR(64) NOT NULL,
  normalized_identifier VARCHAR(64) UNIQUE NOT NULL,
  entity_type VARCHAR(16) NOT NULL CHECK (entity_type IN ('VEHICLE','VENDOR')),
  name VARCHAR(128) NOT NULL,
  mobile VARCHAR(15) NOT NULL,
  address TEXT NOT NULL,
  category_id VARCHAR(32) NOT NULL REFERENCES entity_categories(id),
  ward_id VARCHAR(32) NOT NULL REFERENCES wards(id),
  registration_status VARCHAR(24) NOT NULL,
  gov_verification_status VARCHAR(24) NOT NULL,
  gov_verification_ref VARCHAR(64),
  officer_comments TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_entities_mobile ON municipal_entities(mobile);
CREATE INDEX idx_entities_ward ON municipal_entities(ward_id);

-- 5. Dues & Adjustments (Immutable Historical Rate Preservation)
CREATE TABLE due_records (
  id VARCHAR(32) PRIMARY KEY,
  entity_id VARCHAR(32) NOT NULL REFERENCES municipal_entities(id),
  rate_id VARCHAR(32) NOT NULL REFERENCES rate_masters(id),
  fee_type VARCHAR(128) NOT NULL,
  period_start VARCHAR(16) NOT NULL,
  period_end VARCHAR(16) NOT NULL,
  original_amount_paise BIGINT NOT NULL,
  adjustments_amount_paise BIGINT NOT NULL DEFAULT 0,
  waivers_amount_paise BIGINT NOT NULL DEFAULT 0,
  paid_amount_paise BIGINT NOT NULL DEFAULT 0,
  outstanding_amount_paise BIGINT NOT NULL,
  status VARCHAR(24) NOT NULL,
  generation_date DATE NOT NULL,
  UNIQUE (entity_id, period_start, period_end)
);

-- 6. Payments, Atomic Allocations & Official Receipts
CREATE TABLE payment_records (
  id VARCHAR(32) PRIMARY KEY,
  order_id VARCHAR(64) UNIQUE,
  entity_id VARCHAR(32) NOT NULL REFERENCES municipal_entities(id),
  amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
  method VARCHAR(24) NOT NULL,
  reference_number VARCHAR(64) UNIQUE NOT NULL,
  processing_status VARCHAR(32) NOT NULL,
  settlement_status VARCHAR(32) NOT NULL,
  collected_by VARCHAR(64) NOT NULL,
  verified_by VARCHAR(64),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id VARCHAR(32) NOT NULL REFERENCES payment_records(id),
  due_id VARCHAR(32) NOT NULL REFERENCES due_records(id),
  allocated_amount_paise BIGINT NOT NULL CHECK (allocated_amount_paise > 0),
  remaining_due_balance_paise BIGINT NOT NULL
);

CREATE TABLE receipt_records (
  id VARCHAR(32) PRIMARY KEY,
  receipt_number VARCHAR(32) UNIQUE NOT NULL,
  payment_id VARCHAR(32) UNIQUE NOT NULL REFERENCES payment_records(id),
  entity_id VARCHAR(32) NOT NULL REFERENCES municipal_entities(id),
  previous_outstanding_paise BIGINT NOT NULL,
  current_payment_paise BIGINT NOT NULL,
  allocated_amount_paise BIGINT NOT NULL,
  remaining_outstanding_paise BIGINT NOT NULL,
  verification_code VARCHAR(32) UNIQUE NOT NULL,
  status VARCHAR(32) NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Read-Only Audit Logs
CREATE TABLE audit_logs (
  id VARCHAR(32) PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_name VARCHAR(128) NOT NULL,
  actor_role VARCHAR(32) NOT NULL,
  action VARCHAR(64) NOT NULL,
  module VARCHAR(64) NOT NULL,
  entity_type VARCHAR(32) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  previous_value_summary TEXT NOT NULL,
  new_value_summary TEXT NOT NULL,
  ip_address VARCHAR(64) NOT NULL,
  correlation_id VARCHAR(64) NOT NULL
);
```

## 3. Backup & Restore Instructions for Development JSON Files (Section 4 & 16)
- **Location**: Controlled by `SUVIDHAPAY_DATA_DIR` (defaults to `./data`).
- **Backup**: Copy all `*.json` files in `./data/` while the server is stopped (or between requests).
- **Seed (Non-Destructive)**: `npm run seed` initializes `./data/*.json` only if missing.
- **Reset (Destructive)**: `npm run reset` overwrites `./data/*.json` with the deterministic seed dataset.
