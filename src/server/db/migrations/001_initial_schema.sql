-- ============================================================================
-- SuvidhaPay Municipal Collection Management System — PostgreSQL Migration 001
-- Initial Relational Schema with Full Constraints, Foreign Keys & Indexes
-- ============================================================================

-- Table 1: Zones (Municipal Administrative Zones)
CREATE TABLE IF NOT EXISTS zones (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  ward_count INT NOT NULL DEFAULT 0,
  active_entities_count INT NOT NULL DEFAULT 0,
  total_collection_inr NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 2: Wards (Administrative Wards under Zones)
CREATE TABLE IF NOT EXISTS wards (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  zone_id VARCHAR(64) NOT NULL REFERENCES zones(id) ON UPDATE CASCADE,
  zone_name VARCHAR(255) NOT NULL,
  officer_in_charge VARCHAR(255) NOT NULL,
  agent_assigned VARCHAR(255) NOT NULL,
  registered_entities_count INT NOT NULL DEFAULT 0,
  active_vendors_count INT NOT NULL DEFAULT 0,
  total_collection_inr NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  monthly_target_inr NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wards_zone_id ON wards(zone_id);

-- Table 3: Entity Categories (Vehicle & Vendor Classification)
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(64) PRIMARY KEY,
  code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(32) NOT NULL,
  base_rate_monthly_inr NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  penalty_rate_monthly_inr NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  billing_cycle VARCHAR(32) NOT NULL DEFAULT 'MONTHLY',
  entities_count INT NOT NULL DEFAULT 0,
  active_status BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);

-- Table 4: System Users (Admin, Revenue Officer, Tax Agent, Citizen)
CREATE TABLE IF NOT EXISTS system_users (
  id VARCHAR(64) PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  login_identifier VARCHAR(128) NOT NULL UNIQUE,
  mobile VARCHAR(15) NOT NULL UNIQUE,
  email VARCHAR(255),
  role VARCHAR(32) NOT NULL CHECK (role IN ('ADMIN', 'OFFICER', 'AGENT', 'CITIZEN')),
  assigned_ward VARCHAR(128) NOT NULL DEFAULT 'ALL WARDS',
  assigned_zone VARCHAR(128) NOT NULL DEFAULT 'ALL ZONES',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED', 'LOCKED')),
  created_date VARCHAR(64) NOT NULL,
  last_login TIMESTAMPTZ,
  password_hash VARCHAR(255) NOT NULL,
  force_password_change BOOLEAN NOT NULL DEFAULT FALSE,
  linked_entity_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_users_role ON system_users(role);
CREATE INDEX IF NOT EXISTS idx_users_login_id ON system_users(login_identifier);
CREATE INDEX IF NOT EXISTS idx_users_mobile ON system_users(mobile);

-- Table 5: Refresh Token Sessions (Cryptographic JWT Rotation)
CREATE TABLE IF NOT EXISTS refresh_sessions (
  jti VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
  login_identifier VARCHAR(128) NOT NULL,
  role VARCHAR(32) NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by_jti VARCHAR(128),
  ip_address VARCHAR(64) NOT NULL,
  user_agent TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON refresh_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON refresh_sessions(expires_at);

-- Table 6: Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_reset_user_id ON password_reset_tokens(user_id);

-- Table 7: Rate Master (Versioned Municipal Tariff Schedules)
CREATE TABLE IF NOT EXISTS rate_masters (
  id VARCHAR(64) PRIMARY KEY,
  category_id VARCHAR(64) NOT NULL REFERENCES categories(id) ON UPDATE CASCADE,
  category_name VARCHAR(255) NOT NULL,
  entity_type VARCHAR(32) NOT NULL,
  rate_amount_inr NUMERIC(12,2) NOT NULL,
  billing_frequency VARCHAR(32) NOT NULL DEFAULT 'MONTHLY',
  penalty_grace_days INT NOT NULL DEFAULT 15,
  penalty_percentage_monthly NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  effective_from DATE NOT NULL,
  effective_to DATE,
  ward_scope VARCHAR(128) NOT NULL DEFAULT 'ALL',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'SUPERSEDED', 'UPCOMING')),
  created_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rates_category_id ON rate_masters(category_id);
CREATE INDEX IF NOT EXISTS idx_rates_status ON rate_masters(status);

-- Table 8: Municipal Entities (Registered Vehicles & Street Vendors)
CREATE TABLE IF NOT EXISTS municipal_entities (
  id VARCHAR(64) PRIMARY KEY,
  registration_number VARCHAR(64) NOT NULL UNIQUE,
  normalized_identifier VARCHAR(64) NOT NULL UNIQUE,
  entity_type VARCHAR(32) NOT NULL CHECK (entity_type IN ('VEHICLE', 'VENDOR')),
  name VARCHAR(255) NOT NULL,
  mobile VARCHAR(15) NOT NULL,
  address TEXT NOT NULL,
  category VARCHAR(255) NOT NULL,
  category_id VARCHAR(64) NOT NULL REFERENCES categories(id) ON UPDATE CASCADE,
  vehicle_type VARCHAR(128),
  stall_location VARCHAR(255),
  ward_id VARCHAR(64) NOT NULL REFERENCES wards(id) ON UPDATE CASCADE,
  ward_name VARCHAR(255) NOT NULL,
  zone_name VARCHAR(255) NOT NULL,
  registration_date DATE NOT NULL,
  previous_outstanding NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  new_charges NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  adjustments_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  waivers_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  paid_allocated NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  outstanding_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  registration_status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED' CHECK (registration_status IN ('ACTIVE', 'PENDING', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED')),
  gov_verification_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (gov_verification_status IN ('NOT_REQUESTED', 'PENDING', 'VERIFIED', 'FAILED', 'NOT_FOUND', 'SERVICE_UNAVAILABLE', 'MANUAL_REVIEW', 'MISMATCH')),
  gov_verification_ref VARCHAR(128),
  gov_last_checked TIMESTAMPTZ,
  officer_comments TEXT,
  rejection_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_entities_ward_id ON municipal_entities(ward_id);
CREATE INDEX IF NOT EXISTS idx_entities_category_id ON municipal_entities(category_id);
CREATE INDEX IF NOT EXISTS idx_entities_status ON municipal_entities(registration_status);
CREATE INDEX IF NOT EXISTS idx_entities_mobile ON municipal_entities(mobile);
CREATE INDEX IF NOT EXISTS idx_entities_norm_id ON municipal_entities(normalized_identifier);

-- Table 9: Due Records (Entity Monthly Dues & Ledger Breakdown)
CREATE TABLE IF NOT EXISTS due_records (
  id VARCHAR(64) PRIMARY KEY,
  entity_id VARCHAR(64) NOT NULL REFERENCES municipal_entities(id) ON DELETE CASCADE,
  entity_name VARCHAR(255) NOT NULL,
  registration_number VARCHAR(64) NOT NULL,
  ward_id VARCHAR(64) NOT NULL REFERENCES wards(id),
  ward_name VARCHAR(255) NOT NULL,
  category_id VARCHAR(64) NOT NULL REFERENCES categories(id),
  category_name VARCHAR(255) NOT NULL,
  period_label VARCHAR(64) NOT NULL,
  due_date DATE NOT NULL,
  base_amount_inr NUMERIC(12,2) NOT NULL,
  penalty_amount_inr NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  adjustment_amount_inr NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  waiver_amount_inr NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  paid_amount_inr NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  balance_inr NUMERIC(12,2) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIAL', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED', 'CANCELLED', 'DISPUTED')),
  rate_id VARCHAR(64) NOT NULL REFERENCES rate_masters(id),
  rate_snapshot_inr NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dues_entity_id ON due_records(entity_id);
CREATE INDEX IF NOT EXISTS idx_dues_ward_id ON due_records(ward_id);
CREATE INDEX IF NOT EXISTS idx_dues_status ON due_records(status);
CREATE INDEX IF NOT EXISTS idx_dues_due_date ON due_records(due_date);

-- Table 10: Due Adjustments & Waivers (Auditable Ledger Changes)
CREATE TABLE IF NOT EXISTS due_adjustments (
  id VARCHAR(64) PRIMARY KEY,
  due_id VARCHAR(64) NOT NULL REFERENCES due_records(id) ON DELETE CASCADE,
  entity_id VARCHAR(64) NOT NULL REFERENCES municipal_entities(id) ON DELETE CASCADE,
  entity_name VARCHAR(255) NOT NULL,
  type VARCHAR(32) NOT NULL CHECK (type IN ('ADJUSTMENT', 'WAIVER')),
  amount_inr NUMERIC(12,2) NOT NULL,
  before_balance NUMERIC(12,2) NOT NULL,
  after_balance NUMERIC(12,2) NOT NULL,
  reason_code TEXT NOT NULL,
  description TEXT NOT NULL,
  approved_by VARCHAR(128) NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  correlation_id VARCHAR(128) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_adjustments_due_id ON due_adjustments(due_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_entity_id ON due_adjustments(entity_id);

-- Table 11: Payment Records (Cash Collections, UPI Logs, Online Gateway Txns)
CREATE TABLE IF NOT EXISTS payment_records (
  id VARCHAR(64) PRIMARY KEY,
  entity_id VARCHAR(64) NOT NULL REFERENCES municipal_entities(id),
  registration_number VARCHAR(64) NOT NULL,
  entity_name VARCHAR(255) NOT NULL,
  amount_inr NUMERIC(12,2) NOT NULL,
  payment_method VARCHAR(64) NOT NULL CHECK (payment_method IN ('CASH', 'UPI_MANUAL', 'GATEWAY_ONLINE', 'UPI_REFERENCE', 'PAYMENT_GATEWAY', 'BANK_TRANSFER', 'OTHER')),
  settlement_status VARCHAR(64) NOT NULL CHECK (settlement_status IN ('SUCCESS', 'PENDING', 'FAILED', 'REVERSED', 'FLAGGED', 'SETTLED', 'PENDING_SETTLEMENT', 'UNVERIFIED_MANUAL_REF', 'PROVISIONAL_OFFLINE')),
  receipt_id VARCHAR(64),
  transaction_ref VARCHAR(128),
  upi_utr VARCHAR(64),
  gateway_order_id VARCHAR(128),
  gateway_payment_id VARCHAR(128),
  collected_by VARCHAR(128) NOT NULL,
  collector_role VARCHAR(32) NOT NULL,
  ward_id VARCHAR(64) NOT NULL REFERENCES wards(id),
  ward_name VARCHAR(255) NOT NULL,
  payment_date TIMESTAMPTZ NOT NULL,
  notes TEXT,
  allocated_dues JSONB NOT NULL DEFAULT '[]'::jsonb,
  refund_amount_inr NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  reversed_at TIMESTAMPTZ,
  reversal_reason TEXT,
  reversal_actor VARCHAR(128)
);
CREATE INDEX IF NOT EXISTS idx_payments_entity_id ON payment_records(entity_id);
CREATE INDEX IF NOT EXISTS idx_payments_settlement_status ON payment_records(settlement_status);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payment_records(payment_method);
CREATE INDEX IF NOT EXISTS idx_payments_collected_by ON payment_records(collected_by);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payment_records(payment_date);

-- Table 12: Municipal Receipts (Official Signed Receipts with Verification)
CREATE TABLE IF NOT EXISTS receipt_records (
  id VARCHAR(64) PRIMARY KEY,
  receipt_number VARCHAR(64) NOT NULL UNIQUE,
  payment_id VARCHAR(64) NOT NULL REFERENCES payment_records(id) ON DELETE CASCADE,
  entity_id VARCHAR(64) NOT NULL REFERENCES municipal_entities(id),
  registration_number VARCHAR(64) NOT NULL,
  owner_name VARCHAR(255) NOT NULL,
  amount_inr NUMERIC(12,2) NOT NULL,
  payment_method VARCHAR(32) NOT NULL,
  payment_date TIMESTAMPTZ NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_by VARCHAR(128) NOT NULL,
  ward_name VARCHAR(255) NOT NULL,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  sha256_hash VARCHAR(128) NOT NULL,
  verification_code VARCHAR(64) NOT NULL UNIQUE,
  masked_summary JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_receipts_payment_id ON receipt_records(payment_id);
CREATE INDEX IF NOT EXISTS idx_receipts_entity_id ON receipt_records(entity_id);
CREATE INDEX IF NOT EXISTS idx_receipts_verify_code ON receipt_records(verification_code);

-- Table 13: Daily Cash Closings (Agent Register Reconciliation & Treasury Chest Deposit)
CREATE TABLE IF NOT EXISTS daily_closings (
  id VARCHAR(64) PRIMARY KEY,
  closing_date DATE NOT NULL,
  agent_id VARCHAR(64) NOT NULL,
  agent_name VARCHAR(255) NOT NULL,
  ward_id VARCHAR(64) NOT NULL REFERENCES wards(id),
  ward_name VARCHAR(255) NOT NULL,
  expected_cash NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  actual_cash_count NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  cash_variance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  upi_total_logged NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_receipts_issued INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('OPEN', 'DRAFT', 'SUBMITTED', 'VERIFIED', 'RETURNED', 'CLOSED')),
  discrepancy_note TEXT,
  submitted_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  verified_by_officer_id VARCHAR(64),
  verified_by_officer_name VARCHAR(255),
  officer_comments TEXT,
  treasury_chest_deposit_ref VARCHAR(128)
);
CREATE INDEX IF NOT EXISTS idx_closings_agent_id ON daily_closings(agent_id);
CREATE INDEX IF NOT EXISTS idx_closings_closing_date ON daily_closings(closing_date);
CREATE INDEX IF NOT EXISTS idx_closings_status ON daily_closings(status);

-- Table 14: Reconciliation Items (Gateway Settlement vs Internal Ledger Match)
CREATE TABLE IF NOT EXISTS reconciliation_items (
  id VARCHAR(64) PRIMARY KEY,
  date DATE NOT NULL,
  gateway_provider VARCHAR(64) NOT NULL,
  internal_payment_id VARCHAR(64),
  gateway_payment_id VARCHAR(128),
  utr_or_txn_id VARCHAR(128),
  ledger_amount_inr NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  gateway_settled_amount_inr NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  discrepancy_inr NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(32) NOT NULL DEFAULT 'MATCHED' CHECK (status IN ('MATCHED', 'MISMATCH_AMOUNT', 'MISSING_IN_LEDGER', 'MISSING_IN_GATEWAY', 'RESOLVED', 'MISSING_PAYMENT', 'MISSING_SETTLEMENT', 'AMOUNT_MISMATCH', 'DUPLICATE', 'UNDER_REVIEW')),
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(128)
);
CREATE INDEX IF NOT EXISTS idx_reconciliation_date ON reconciliation_items(date);
CREATE INDEX IF NOT EXISTS idx_reconciliation_status ON reconciliation_items(status);

-- Table 15: Refund & Reversal Disputes
CREATE TABLE IF NOT EXISTS refund_disputes (
  id VARCHAR(64) PRIMARY KEY,
  record_type VARCHAR(32) NOT NULL CHECK (record_type IN ('REFUND', 'REVERSAL', 'DISPUTE')),
  payment_id VARCHAR(64) REFERENCES payment_records(id) ON DELETE SET NULL,
  receipt_number VARCHAR(64),
  entity_id VARCHAR(64) NOT NULL REFERENCES municipal_entities(id),
  entity_name VARCHAR(255) NOT NULL,
  amount_inr NUMERIC(12,2) NOT NULL,
  reason_code VARCHAR(64) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESOLVED')),
  filed_by VARCHAR(128) NOT NULL,
  filed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  adjudicated_by VARCHAR(128),
  adjudicated_at TIMESTAMPTZ,
  resolution_notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_disputes_payment_id ON refund_disputes(payment_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON refund_disputes(status);

-- Table 16: Notification Logs (Dispatched SMS, WhatsApp & In-App Alerts)
CREATE TABLE IF NOT EXISTS notification_logs (
  id VARCHAR(64) PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  recipient_name VARCHAR(255) NOT NULL,
  recipient_mobile VARCHAR(15) NOT NULL,
  channel VARCHAR(32) NOT NULL,
  eventType VARCHAR(64) NOT NULL,
  template_id VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'DELIVERED',
  retry_count INT NOT NULL DEFAULT 0,
  failure_reason TEXT,
  correlation_id VARCHAR(128) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notification_logs(recipient_mobile);
CREATE INDEX IF NOT EXISTS idx_notif_status ON notification_logs(status);

-- Table 17: Notification Templates
CREATE TABLE IF NOT EXISTS notification_templates (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  channel VARCHAR(32) NOT NULL,
  eventType VARCHAR(64) NOT NULL,
  body_template TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 18: Government Verification Records (VAHAN 4.0 / PM-SVANidhi)
CREATE TABLE IF NOT EXISTS gov_verifications (
  id VARCHAR(64) PRIMARY KEY,
  entity_id VARCHAR(64) NOT NULL REFERENCES municipal_entities(id) ON DELETE CASCADE,
  registration_number VARCHAR(64) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL CHECK (status IN ('NOT_REQUESTED', 'PENDING', 'VERIFIED', 'FAILED', 'NOT_FOUND', 'SERVICE_UNAVAILABLE', 'MANUAL_REVIEW', 'MISMATCH')),
  reference_number VARCHAR(128) NOT NULL,
  owner_name_matched BOOLEAN NOT NULL DEFAULT FALSE,
  vehicle_class VARCHAR(128),
  requested_by VARCHAR(128) NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_verifications_entity_id ON gov_verifications(entity_id);
CREATE INDEX IF NOT EXISTS idx_verifications_reg_no ON gov_verifications(registration_number);

-- Table 19: Cryptographic Audit Trail (Append-Only Log)
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_name VARCHAR(128) NOT NULL,
  actor_role VARCHAR(32) NOT NULL,
  action VARCHAR(128) NOT NULL,
  module VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  previous_value_summary TEXT NOT NULL DEFAULT 'None',
  new_value_summary TEXT NOT NULL DEFAULT 'None',
  ip_address VARCHAR(64) NOT NULL,
  correlation_id VARCHAR(128) NOT NULL,
  sha256_signature VARCHAR(128)
);
CREATE INDEX IF NOT EXISTS idx_audit_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_entity_id ON audit_logs(entity_id);

-- Table 20: Staged Legacy Data Import Batches
CREATE TABLE IF NOT EXISTS import_batches (
  id VARCHAR(64) PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  import_type VARCHAR(64) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'STAGED' CHECK (status IN ('STAGED', 'COMMITTED', 'REJECTED')),
  total_rows INT NOT NULL DEFAULT 0,
  valid_rows_count INT NOT NULL DEFAULT 0,
  error_rows_count INT NOT NULL DEFAULT 0,
  valid_staging_records JSONB NOT NULL DEFAULT '[]'::jsonb,
  row_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  committed_at TIMESTAMPTZ
);

-- Table 21: Idempotency Key Vault
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key VARCHAR(128) PRIMARY KEY,
  endpoint VARCHAR(255) NOT NULL,
  actor_id VARCHAR(64) NOT NULL,
  status_code INT NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table 22: Municipal System Settings (Singleton Configuration)
CREATE TABLE IF NOT EXISTS system_settings (
  id VARCHAR(32) PRIMARY KEY DEFAULT 'SYSTEM_CONFIG',
  municipality_name VARCHAR(255) NOT NULL,
  municipality_code VARCHAR(32) NOT NULL,
  tagline VARCHAR(255) NOT NULL,
  receipt_prefix VARCHAR(32) NOT NULL,
  financial_year VARCHAR(32) NOT NULL,
  next_receipt_sequence INT NOT NULL DEFAULT 43,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  currency VARCHAR(16) NOT NULL DEFAULT 'INR',
  allow_advance_overpayment BOOLEAN NOT NULL DEFAULT FALSE,
  require_officer_approval_for_registrations BOOLEAN NOT NULL DEFAULT TRUE,
  require_admin_approval_for_waivers BOOLEAN NOT NULL DEFAULT TRUE,
  payment_gateway_provider VARCHAR(64) NOT NULL DEFAULT 'RAZORPAY_MOCK',
  payment_gateway_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  sms_provider_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  whatsapp_provider_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  gov_verification_provider_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by VARCHAR(128) NOT NULL DEFAULT 'SYSTEM_INIT'
);
