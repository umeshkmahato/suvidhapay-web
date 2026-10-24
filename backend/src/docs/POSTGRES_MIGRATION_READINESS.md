# SuvidhaPay — PostgreSQL Migration Readiness Guide

> **Status:** Architecture Decoupled & PostgreSQL Ready  
> **Current Engine:** LokiJS In-Memory Document Store with `LokiFsAdapter` Persistence  
> **Target Engine:** PostgreSQL 16+ (via Cloud SQL / Supabase / Neon / Self-Hosted)  
> **Migration Pattern:** Swappable Repository & Unit-of-Work Pattern (`IDataStore`)

---

## 1. Architectural Isolation & Decoupling

The SuvidhaPay backend is strictly layered into four tiers:

```
[Express HTTP Controllers & Zod Middleware]
                   │
                   ▼
       [Domain Service Layer]
(AuthAndUsers, EntitiesRatesDues, PaymentsReceipts, OperationsAndReports)
                   │
                   ▼
  [Domain Repositories & IDataStore Unit-of-Work]
  (IUserRepository, IEntityRepository, IDueRepository, IPaymentRepository...)
       │                                     │
       ▼                                     ▼
[LokiDataStore (Current)]          [PostgresDataStore (Future)]
- In-memory document collections     - Connection Pool (pg.Pool)
- Dynamic hash/binary indexes        - Relational tables & Foreign Keys
- LokiFsAdapter periodic disk flush  - ACID Transactions (BEGIN...COMMIT)
- Strict $loki & meta stripping      - Row-level locking (FOR UPDATE)
```

### Key Guardrails Maintained:
1. **Zero LokiJS Leaks:** Neither `$loki` document pointers nor `meta` revision objects ever cross the repository boundary. All services, schemas, and API responses use domain entity types.
2. **Standardized Integer Paise Precision:** All money fields are strictly stored as integer paise (`INR 1.00 = 100 paise`). In PostgreSQL, these map directly to `BIGINT`, preventing floating-point drift.
3. **Unit-of-Work Boundary:** Multi-record state transitions (such as payment recording + receipt creation + FIFO due reduction + audit logging) execute through `IDataStore.withTransaction()`.

---

## 2. Entity-to-Table Relational Schema Mapping

When migrating to PostgreSQL, the 22 LokiJS collections translate directly into the following relational DDL schema:

### 2.1 Governance & Geographic Hierarchy

```sql
-- 1. zones
CREATE TABLE zones (
    id VARCHAR(32) PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    wards_count INT NOT NULL DEFAULT 0,
    total_entities INT NOT NULL DEFAULT 0,
    total_outstanding BIGINT NOT NULL DEFAULT 0, -- in paise
    status VARCHAR(16) NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. wards
CREATE TABLE wards (
    id VARCHAR(32) PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    zone_id VARCHAR(32) NOT NULL REFERENCES zones(id) ON DELETE RESTRICT,
    zone_name VARCHAR(128) NOT NULL,
    assigned_officer_id VARCHAR(32),
    assigned_officer_name VARCHAR(128),
    assigned_agents_count INT NOT NULL DEFAULT 0,
    registered_entities_count INT NOT NULL DEFAULT 0,
    outstanding_dues BIGINT NOT NULL DEFAULT 0, -- in paise
    today_collection BIGINT NOT NULL DEFAULT 0, -- in paise
    status VARCHAR(16) NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wards_zone_id ON wards(zone_id);
```

### 2.2 Users, Authentication & Sessions

```sql
-- 3. users
CREATE TABLE users (
    id VARCHAR(32) PRIMARY KEY,
    full_name VARCHAR(128) NOT NULL,
    login_identifier VARCHAR(64) UNIQUE NOT NULL,
    mobile VARCHAR(16) NOT NULL,
    email VARCHAR(128),
    role VARCHAR(16) NOT NULL CHECK (role IN ('ADMIN', 'OFFICER', 'AGENT', 'CITIZEN')),
    assigned_ward VARCHAR(32),
    assigned_zone VARCHAR(128),
    status VARCHAR(16) NOT NULL CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DEACTIVATED')) DEFAULT 'ACTIVE',
    password_hash VARCHAR(256) NOT NULL,
    force_password_change BOOLEAN NOT NULL DEFAULT FALSE,
    linked_entity_ids TEXT[] DEFAULT '{}',
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_users_role_status ON users(role, status);
CREATE INDEX idx_users_mobile ON users(mobile);

-- 4. refresh_sessions
CREATE TABLE refresh_sessions (
    jti VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    login_identifier VARCHAR(64) NOT NULL,
    role VARCHAR(16) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    replaced_by_jti VARCHAR(64),
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT NOT NULL
);
CREATE INDEX idx_sessions_user_id ON refresh_sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON refresh_sessions(expires_at);

-- 5. password_reset_tokens
CREATE TABLE password_reset_tokens (
    token VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);
```

### 2.3 Catalog, Rates & Registered Entities

```sql
-- 6. entity_categories
CREATE TABLE entity_categories (
    id VARCHAR(32) PRIMARY KEY,
    code VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    entity_type VARCHAR(16) NOT NULL CHECK (entity_type IN ('VEHICLE', 'VENDOR')),
    specific_fields TEXT[] NOT NULL DEFAULT '{}',
    applicable_fee_types TEXT[] NOT NULL DEFAULT '{}',
    active_rate_id VARCHAR(32),
    active_rate_amount BIGINT NOT NULL DEFAULT 0, -- in paise
    entities_count INT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')) DEFAULT 'ACTIVE'
);

-- 7. rate_masters
CREATE TABLE rate_masters (
    id VARCHAR(32) PRIMARY KEY,
    category_id VARCHAR(32) NOT NULL REFERENCES entity_categories(id) ON DELETE RESTRICT,
    category_name VARCHAR(128) NOT NULL,
    fee_type VARCHAR(128) NOT NULL,
    vehicle_type VARCHAR(64),
    frequency VARCHAR(16) NOT NULL CHECK (frequency IN ('DAILY', 'MONTHLY', 'QUARTERLY', 'ANNUAL')),
    amount_paise BIGINT NOT NULL, -- Integer paise
    effective_from DATE NOT NULL,
    effective_to DATE,
    ward_scope VARCHAR(32) NOT NULL DEFAULT 'ALL',
    status VARCHAR(16) NOT NULL CHECK (status IN ('ACTIVE', 'EXPIRED', 'UPCOMING', 'DEPRECATED')),
    created_by VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rates_category_status ON rate_masters(category_id, status);

-- 8. municipal_entities
CREATE TABLE municipal_entities (
    id VARCHAR(32) PRIMARY KEY,
    registration_number VARCHAR(64) NOT NULL,
    normalized_identifier VARCHAR(64) UNIQUE NOT NULL, -- e.g. UP16AB1234
    entity_type VARCHAR(16) NOT NULL CHECK (entity_type IN ('VEHICLE', 'VENDOR')),
    name VARCHAR(128) NOT NULL,
    mobile VARCHAR(16) NOT NULL,
    address TEXT NOT NULL,
    category VARCHAR(128) NOT NULL,
    category_id VARCHAR(32) NOT NULL REFERENCES entity_categories(id),
    vehicle_type VARCHAR(64),
    ward_id VARCHAR(32) NOT NULL REFERENCES wards(id),
    ward_name VARCHAR(128) NOT NULL,
    zone_name VARCHAR(128) NOT NULL,
    registration_date DATE NOT NULL,
    previous_outstanding BIGINT NOT NULL DEFAULT 0, -- paise
    new_charges BIGINT NOT NULL DEFAULT 0,          -- paise
    adjustments_total BIGINT NOT NULL DEFAULT 0,    -- paise
    waivers_total BIGINT NOT NULL DEFAULT 0,        -- paise
    paid_allocated BIGINT NOT NULL DEFAULT 0,       -- paise
    outstanding_amount BIGINT NOT NULL DEFAULT 0,   -- paise
    registration_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    gov_verification_status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    gov_verification_ref VARCHAR(64),
    gov_last_checked TIMESTAMPTZ,
    officer_comments TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_entities_ward ON municipal_entities(ward_id);
CREATE INDEX idx_entities_mobile ON municipal_entities(mobile);
CREATE INDEX idx_entities_status ON municipal_entities(registration_status);
```

### 2.4 Dues, Adjustments, Payments & Receipts

```sql
-- 9. dues
CREATE TABLE dues (
    id VARCHAR(32) PRIMARY KEY,
    entity_id VARCHAR(32) NOT NULL REFERENCES municipal_entities(id) ON DELETE RESTRICT,
    rate_id VARCHAR(32) NOT NULL REFERENCES rate_masters(id) ON DELETE RESTRICT,
    fee_type VARCHAR(128) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    base_amount BIGINT NOT NULL,       -- paise
    penalties BIGINT NOT NULL DEFAULT 0,
    adjustments BIGINT NOT NULL DEFAULT 0,
    paid_amount BIGINT NOT NULL DEFAULT 0,
    balance_amount BIGINT NOT NULL,    -- paise
    status VARCHAR(16) NOT NULL CHECK (status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'WAIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_dues_entity_status ON dues(entity_id, status);

-- 10. due_adjustments (Waivers)
CREATE TABLE due_adjustments (
    id VARCHAR(32) PRIMARY KEY,
    due_id VARCHAR(32) NOT NULL REFERENCES dues(id) ON DELETE RESTRICT,
    entity_id VARCHAR(32) NOT NULL REFERENCES municipal_entities(id) ON DELETE RESTRICT,
    adjustment_type VARCHAR(16) NOT NULL CHECK (adjustment_type IN ('WAIVER', 'CORRECTION', 'DISCOUNT')),
    amount_paise BIGINT NOT NULL,
    justification TEXT NOT NULL,
    approval_status VARCHAR(16) NOT NULL CHECK (approval_status IN ('SUBMITTED', 'APPROVED', 'REJECTED')),
    requested_by VARCHAR(64) NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decided_by VARCHAR(64),
    decided_at TIMESTAMPTZ,
    decision_reason TEXT
);
CREATE INDEX idx_adjustments_due ON due_adjustments(due_id);

-- 11. payments
CREATE TABLE payments (
    id VARCHAR(32) PRIMARY KEY,
    entity_id VARCHAR(32) NOT NULL REFERENCES municipal_entities(id) ON DELETE RESTRICT,
    amount_paise BIGINT NOT NULL,
    method VARCHAR(16) NOT NULL CHECK (method IN ('CASH', 'MANUAL_UPI', 'ONLINE_GATEWAY')),
    settlement_status VARCHAR(32) NOT NULL CHECK (settlement_status IN ('SETTLED', 'UNVERIFIED_MANUAL_REF', 'REVERSED', 'FAILED')),
    collected_by VARCHAR(64) NOT NULL,
    ward_name VARCHAR(128) NOT NULL,
    gateway_reference VARCHAR(128),
    receipt_id VARCHAR(32),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_entity ON payments(entity_id);
CREATE INDEX idx_payments_method_status ON payments(method, settlement_status);

-- 12. receipts
CREATE TABLE receipts (
    id VARCHAR(32) PRIMARY KEY,
    receipt_number VARCHAR(64) UNIQUE NOT NULL, -- SUP/YYYY/0000XXXXX
    payment_id VARCHAR(32) NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
    entity_id VARCHAR(32) NOT NULL REFERENCES municipal_entities(id) ON DELETE RESTRICT,
    entity_name VARCHAR(128) NOT NULL,
    registration_number VARCHAR(64) NOT NULL,
    amount_paise BIGINT NOT NULL,
    payment_method VARCHAR(16) NOT NULL,
    collected_by VARCHAR(64) NOT NULL,
    ward_name VARCHAR(128) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verification_code VARCHAR(64) UNIQUE NOT NULL,
    allocated_dues JSONB NOT NULL DEFAULT '[]',
    qr_payload TEXT NOT NULL
);
CREATE INDEX idx_receipts_verification ON receipts(verification_code);
CREATE INDEX idx_receipts_entity ON receipts(entity_id);
```

### 2.5 Operational Closings, Reconciliations & Audit

```sql
-- 13. daily_closings
CREATE TABLE daily_closings (
    id VARCHAR(32) PRIMARY KEY,
    agent_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    agent_name VARCHAR(128) NOT NULL,
    ward_code VARCHAR(32) NOT NULL,
    date DATE NOT NULL,
    system_cash_paise BIGINT NOT NULL,
    physical_cash_paise BIGINT NOT NULL,
    variance_paise BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('OPEN', 'SUBMITTED', 'OFFICER_VERIFIED', 'CLOSED')),
    agent_notes TEXT,
    officer_notes TEXT,
    verified_by VARCHAR(64),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (agent_id, date)
);

-- 14. reconciliations
CREATE TABLE reconciliations (
    id VARCHAR(32) PRIMARY KEY,
    gateway_order_id VARCHAR(128) UNIQUE NOT NULL,
    payment_id VARCHAR(32) REFERENCES payments(id),
    gateway VARCHAR(32) NOT NULL,
    amount_paise BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('MATCHED', 'AUTO_RECONCILED', 'PENDING_INVESTIGATION', 'DISPUTE_RAISED')),
    gateway_timestamp TIMESTAMPTZ NOT NULL,
    reconciled_at TIMESTAMPTZ,
    notes TEXT
);

-- 15. refund_disputes
CREATE TABLE refund_disputes (
    id VARCHAR(32) PRIMARY KEY,
    payment_id VARCHAR(32) NOT NULL REFERENCES payments(id),
    receipt_id VARCHAR(32) NOT NULL REFERENCES receipts(id),
    amount_paise BIGINT NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('PENDING_REVIEW', 'RESOLVED_REFUNDED', 'REJECTED')),
    raised_by VARCHAR(64) NOT NULL,
    raised_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolution_notes TEXT,
    resolved_by VARCHAR(64),
    resolved_at TIMESTAMPTZ
);

-- 16. audit_logs
CREATE TABLE audit_logs (
    id VARCHAR(32) PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_name VARCHAR(128) NOT NULL,
    actor_role VARCHAR(32) NOT NULL,
    action VARCHAR(64) NOT NULL,
    module VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    previous_value_summary TEXT,
    new_value_summary TEXT,
    ip_address VARCHAR(45) NOT NULL,
    correlation_id VARCHAR(64) NOT NULL
);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_correlation ON audit_logs(correlation_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_id);

-- 17. notifications & templates
CREATE TABLE notification_templates (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    channel VARCHAR(16) NOT NULL CHECK (channel IN ('SMS', 'WHATSAPP', 'IN_APP')),
    event_type VARCHAR(64) NOT NULL,
    body_template TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE notification_logs (
    id VARCHAR(32) PRIMARY KEY,
    correlation_id VARCHAR(64) NOT NULL,
    channel VARCHAR(16) NOT NULL CHECK (channel IN ('SMS', 'WHATSAPP', 'IN_APP')),
    recipient_mobile VARCHAR(16) NOT NULL,
    message_body TEXT NOT NULL,
    status VARCHAR(32) NOT NULL CHECK (status IN ('QUEUED', 'SENT', 'DELIVERED', 'FAILED_RETRYING', 'FAILED_PERMANENT')),
    dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    failure_reason TEXT
);
CREATE INDEX idx_notifications_recipient ON notification_logs(recipient_mobile);

-- 18. gov_verifications
CREATE TABLE gov_verifications (
    id VARCHAR(32) PRIMARY KEY,
    entity_id VARCHAR(32) NOT NULL REFERENCES municipal_entities(id) ON DELETE CASCADE,
    registration_number VARCHAR(64) NOT NULL,
    provider VARCHAR(32) NOT NULL CHECK (provider IN ('VAHAN_MOCK', 'SVANIDHI_MOCK', 'NIC_VAHAN_LIVE')),
    status VARCHAR(32) NOT NULL,
    reference_number VARCHAR(64) NOT NULL,
    owner_name_matched BOOLEAN NOT NULL,
    vehicle_class VARCHAR(64),
    requested_by VARCHAR(64) NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
);

-- 19. import_batches
CREATE TABLE import_batches (
    id VARCHAR(32) PRIMARY KEY,
    file_name VARCHAR(128) NOT NULL,
    import_type VARCHAR(32) NOT NULL CHECK (import_type IN ('VEHICLES', 'VENDORS', 'LEGACY_DUES')),
    status VARCHAR(32) NOT NULL CHECK (status IN ('STAGED', 'COMMITTED', 'REJECTED')),
    total_rows INT NOT NULL DEFAULT 0,
    valid_rows_count INT NOT NULL DEFAULT 0,
    error_rows_count INT NOT NULL DEFAULT 0,
    valid_staging_records JSONB NOT NULL DEFAULT '[]',
    row_errors JSONB NOT NULL DEFAULT '[]',
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    committed_at TIMESTAMPTZ
);

-- 20. idempotency_keys
CREATE TABLE idempotency_keys (
    key VARCHAR(128) PRIMARY KEY,
    endpoint VARCHAR(128) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    status_code INT NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_idempotency_created ON idempotency_keys(created_at);

-- 21. system_settings
CREATE TABLE system_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Single-row configuration table
    municipality_name VARCHAR(128) NOT NULL,
    municipality_code VARCHAR(32) NOT NULL,
    tagline VARCHAR(256) NOT NULL,
    receipt_prefix VARCHAR(32) NOT NULL,
    financial_year VARCHAR(16) NOT NULL,
    next_receipt_sequence INT NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    allow_advance_overpayment BOOLEAN NOT NULL DEFAULT FALSE,
    require_officer_approval_for_registrations BOOLEAN NOT NULL DEFAULT TRUE,
    require_admin_approval_for_waivers BOOLEAN NOT NULL DEFAULT TRUE,
    payment_gateway_provider VARCHAR(32) NOT NULL DEFAULT 'RAZORPAY_MOCK',
    payment_gateway_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    sms_provider_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    whatsapp_provider_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    gov_verification_provider_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(64) NOT NULL
);
```

---

## 3. Concurrency & Transactional Migration Differences

| Aspect | LokiJS (Current Phase) | PostgreSQL (Future Phase) |
| :--- | :--- | :--- |
| **Execution Model** | Single Node.js thread; synchronous memory lookups | Asynchronous client pooling (`pg.Pool`, Drizzle, Prisma) |
| **Transaction Boundary** | In-process queue promise serialization (`withTransaction`) | ACID database transactions (`BEGIN ... COMMIT / ROLLBACK`) |
| **Isolation Level** | Serialized in-process unit-of-work | `READ COMMITTED` or `REPEATABLE READ` |
| **Row Locking** | Not required (single process queue locks collection) | `SELECT ... FOR UPDATE` required for dues balance allocation and receipt sequence numbering |
| **Sequence Generation** | In-memory counter (`settings.nextReceiptSequence++`) | Native PostgreSQL sequence (`CREATE SEQUENCE receipt_seq`) or atomic `UPDATE system_settings SET next_receipt_sequence = next_receipt_sequence + 1 RETURNING ...` |
| **Persistence Guarantee** | Autosaved to file via `LokiFsAdapter` every 4000ms + flush on write | Write-Ahead Log (WAL) with `fsync` synchronous commit |

---

## 4. Swappable Implementation Blueprint

When transitioning to PostgreSQL:
1. Implement `PostgresDataStore` adhering to `IDataStore`.
2. Map `withTransaction(opName, fn)` to:
   ```typescript
   const client = await pool.connect();
   try {
     await client.query('BEGIN');
     const result = await fn(transactionalCollectionsProxy);
     await client.query('COMMIT');
     return result;
   } catch (err) {
     await client.query('ROLLBACK');
     throw err;
   } finally {
     client.release();
   }
   ```
3. No domain service (`AuthAndUsersService`, `PaymentsReceiptsService`, etc.) or controller requires modification.
