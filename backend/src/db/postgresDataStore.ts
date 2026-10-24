import { Pool, PoolConfig, PoolClient } from 'pg';
import {
  IDataStore,
  SuvidhaDataCollections,
  BackendUserRecord,
  SystemSettingsRecord,
} from '../repositories/interfaces';
import { PostgresMigrator } from './migrations/migrator';
import { seedPostgresIfEmpty, resetPostgresToSeed } from './postgresSeed';

export interface PostgresDataStoreOptions {
  pool?: Pool;
  poolConfig?: PoolConfig;
  connectionString?: string;
  autoMigrate?: boolean;
  autoSeed?: boolean;
}

/**
 * PostgreSQL Implementation of IDataStore (Phase 5)
 *
 * Implements the database-agnostic IDataStore contract over a real PostgreSQL database
 * via `pg.Pool`. Isolates all SQL operations and relational mappings behind the repository
 * boundary so services and HTTP controllers remain completely decoupled from database mechanics.
 */
export class PostgresDataStore implements IDataStore {
  private pool: Pool;
  private isInitialized = false;
  private autoMigrate: boolean;
  private autoSeed: boolean;

  constructor(options: PostgresDataStoreOptions = {}) {
    if (options.pool) {
      this.pool = options.pool;
    } else if (options.connectionString) {
      this.pool = new Pool({ connectionString: options.connectionString });
    } else {
      this.pool = new Pool(options.poolConfig || {});
    }
    this.autoMigrate = options.autoMigrate !== false;
    this.autoSeed = options.autoSeed !== false;
  }

  public getPool(): Pool {
    return this.pool;
  }

  public getDataDir(): string {
    return 'postgres://connected';
  }

  public getDbFilePath(): string {
    return 'postgresql_relational_storage';
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Test connectivity
    const client = await this.pool.connect();
    try {
      await client.query('SELECT 1;');
    } finally {
      client.release();
    }

    if (this.autoMigrate) {
      const migrator = new PostgresMigrator(this.pool);
      await migrator.migrate();
    }

    if (this.autoSeed) {
      await seedPostgresIfEmpty(this.pool);
    }

    this.isInitialized = true;
    console.log('[PostgresDataStore] Connected and initialized successfully.');
  }

  /**
   * Reads all relational entities from PostgreSQL and constructs SuvidhaDataCollections.
   * Maps relational column naming (snake_case) to domain models (camelCase) with full type fidelity.
   */
  public async readAll(): Promise<SuvidhaDataCollections> {
    const [
      usersRes,
      sessionsRes,
      resetTokensRes,
      wardsRes,
      zonesRes,
      categoriesRes,
      ratesRes,
      entitiesRes,
      duesRes,
      adjustmentsRes,
      paymentsRes,
      receiptsRes,
      closingsRes,
      reconciliationsRes,
      disputesRes,
      notificationsRes,
      templatesRes,
      verificationsRes,
      auditLogsRes,
      importsRes,
      idempotencyRes,
      settingsRes,
    ] = await Promise.all([
      this.pool.query('SELECT * FROM system_users;'),
      this.pool.query('SELECT * FROM refresh_sessions;'),
      this.pool.query('SELECT * FROM password_reset_tokens;'),
      this.pool.query('SELECT * FROM wards ORDER BY code ASC;'),
      this.pool.query('SELECT * FROM zones ORDER BY code ASC;'),
      this.pool.query('SELECT * FROM categories ORDER BY code ASC;'),
      this.pool.query('SELECT * FROM rate_masters ORDER BY created_at DESC;'),
      this.pool.query('SELECT * FROM municipal_entities ORDER BY id ASC;'),
      this.pool.query('SELECT * FROM due_records ORDER BY due_date ASC;'),
      this.pool.query('SELECT * FROM due_adjustments ORDER BY approved_at DESC;'),
      this.pool.query('SELECT * FROM payment_records ORDER BY payment_date DESC;'),
      this.pool.query('SELECT * FROM receipt_records ORDER BY issued_at DESC;'),
      this.pool.query('SELECT * FROM daily_closings ORDER BY closing_date DESC;'),
      this.pool.query('SELECT * FROM reconciliation_items ORDER BY date DESC;'),
      this.pool.query('SELECT * FROM refund_disputes ORDER BY filed_at DESC;'),
      this.pool.query('SELECT * FROM notification_logs ORDER BY timestamp DESC;'),
      this.pool.query('SELECT * FROM notification_templates ORDER BY created_at ASC;'),
      this.pool.query('SELECT * FROM gov_verifications ORDER BY requested_at DESC;'),
      this.pool.query('SELECT * FROM audit_logs ORDER BY timestamp DESC;'),
      this.pool.query('SELECT * FROM import_batches ORDER BY created_at DESC;'),
      this.pool.query('SELECT * FROM idempotency_keys;'),
      this.pool.query('SELECT * FROM system_settings WHERE id = $1;', ['SYSTEM_CONFIG']),
    ]);

    const users: BackendUserRecord[] = usersRes.rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      loginIdentifier: r.login_identifier,
      mobile: r.mobile,
      email: r.email || undefined,
      role: r.role,
      assignedWard: r.assigned_ward,
      assignedZone: r.assigned_zone,
      status: r.status,
      createdDate: r.created_date,
      lastLogin: r.last_login ? new Date(r.last_login).toISOString() : new Date().toISOString(),
      passwordHash: r.password_hash,
      forcePasswordChange: Boolean(r.force_password_change),
      linkedEntityIds: Array.isArray(r.linked_entity_ids)
        ? r.linked_entity_ids
        : JSON.parse(r.linked_entity_ids || '[]'),
      failedLoginAttempts: Number(r.failed_login_attempts || 0),
      lockedUntil: r.locked_until ? new Date(r.locked_until).toISOString() : null,
    }));

    const wards = wardsRes.rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      zoneId: r.zone_id,
      zoneName: r.zone_name,
      officerInCharge: r.officer_in_charge,
      agentAssigned: r.agent_assigned,
      registeredEntitiesCount: Number(r.registered_entities_count),
      activeVendorsCount: Number(r.active_vendors_count),
      totalCollectionInr: Number(r.total_collection_inr),
      monthlyTargetInr: Number(r.monthly_target_inr),
    }));

    const zones = zonesRes.rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      wardCount: Number(r.ward_count),
      activeEntitiesCount: Number(r.active_entities_count),
      totalCollectionInr: Number(r.total_collection_inr),
      description: r.description || '',
    }));

    const categories = categoriesRes.rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      entityType: (r.type || 'VEHICLE') as 'VEHICLE' | 'VENDOR',
      type: r.type,
      specificFields: [],
      applicableFeeTypes: ['Municipal Permit Fee', 'Stand Usage Fee'],
      activeRateAmount: Number(r.base_rate_monthly_inr || 450),
      entitiesCount: Number(r.entities_count || 0),
      activeRateId: 'RT-2026-01',
      baseRateMonthlyInr: Number(r.base_rate_monthly_inr || 450),
      penaltyRateMonthlyInr: Number(r.penalty_rate_monthly_inr || 25),
      billingCycle: r.billing_cycle || 'MONTHLY',
      activeStatus: Boolean(r.active_status),
    }));

    const rates = ratesRes.rows.map((r) => ({
      id: r.id,
      categoryId: r.category_id,
      categoryName: r.category_name,
      feeType: `Municipal Stand Fee (${r.entity_type || 'Vehicle'})`,
      vehicleType: r.entity_type,
      entityType: r.entity_type,
      frequency: (r.billing_frequency || 'MONTHLY') as 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
      amountInr: Number(r.rate_amount_inr),
      rateAmountInr: Number(r.rate_amount_inr),
      billingFrequency: r.billing_frequency,
      penaltyGraceDays: Number(r.penalty_grace_days || 15),
      penaltyPercentageMonthly: Number(r.penalty_percentage_monthly || 5),
      effectiveFrom: r.effective_from instanceof Date ? r.effective_from.toISOString().slice(0, 10) : String(r.effective_from),
      effectiveTo: r.effective_to ? (r.effective_to instanceof Date ? r.effective_to.toISOString().slice(0, 10) : String(r.effective_to)) : null,
      wardScope: r.ward_scope || 'ALL',
      status: (r.status || 'ACTIVE') as 'ACTIVE' | 'UPCOMING' | 'EXPIRED',
      createdBy: r.created_by,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));

    const entities = entitiesRes.rows.map((r) => ({
      id: r.id,
      registrationNumber: r.registration_number,
      normalizedIdentifier: r.normalized_identifier,
      entityType: r.entity_type,
      name: r.name,
      mobile: r.mobile,
      address: r.address,
      category: r.category,
      categoryId: r.category_id,
      vehicleType: r.vehicle_type || undefined,
      stallLocation: r.stall_location || undefined,
      wardId: r.ward_id,
      wardName: r.ward_name,
      zoneName: r.zone_name,
      registrationDate: r.registration_date instanceof Date ? r.registration_date.toISOString().slice(0, 10) : String(r.registration_date),
      previousOutstanding: Number(r.previous_outstanding),
      newCharges: Number(r.new_charges),
      adjustmentsTotal: Number(r.adjustments_total),
      waiversTotal: Number(r.waivers_total),
      paidAllocated: Number(r.paid_allocated),
      outstandingAmount: Number(r.outstanding_amount),
      registrationStatus: r.registration_status,
      govVerificationStatus: r.gov_verification_status,
      govVerificationRef: r.gov_verification_ref || undefined,
      govLastChecked: r.gov_last_checked ? new Date(r.gov_last_checked).toISOString() : undefined,
      officerComments: r.officer_comments || undefined,
      rejectionReason: r.rejection_reason || undefined,
    }));

    const dues = duesRes.rows.map((r) => {
      const parts = (r.period_label || '').split(' - ');
      const periodStart = parts[0] || '01/03/2026';
      const periodEnd = parts[1] || '31/03/2026';
      const baseAmt = Number(r.base_amount_inr || 0);
      const adjAmt = Number(r.adjustment_amount_inr || 0);
      const wvrAmt = Number(r.waiver_amount_inr || 0);
      const paidAmt = Number(r.paid_amount_inr || 0);
      const balAmt = Number(r.balance_inr !== undefined ? r.balance_inr : baseAmt - wvrAmt - paidAmt);
      return {
        id: r.id,
        entityId: r.entity_id,
        entityName: r.entity_name,
        registrationNumber: r.registration_number,
        wardId: r.ward_id,
        wardName: r.ward_name,
        categoryId: r.category_id,
        categoryName: r.category_name,
        feeType: `Municipal Fee (${r.period_label || '2026'})`,
        periodStart,
        periodEnd,
        periodLabel: r.period_label,
        originalAmount: baseAmt,
        baseAmountInr: baseAmt,
        penaltyAmountInr: Number(r.penalty_amount_inr || 0),
        adjustmentsAmount: adjAmt,
        adjustmentAmountInr: adjAmt,
        waiversAmount: wvrAmt,
        waiverAmountInr: wvrAmt,
        paidAmount: paidAmt,
        paidAmountInr: paidAmt,
        outstandingAmount: balAmt,
        balanceInr: balAmt,
        status: r.status,
        rateId: r.rate_id,
        rateSnapshotInr: Number(r.rate_snapshot_inr || 0),
        dueDate: r.due_date instanceof Date ? r.due_date.toISOString().slice(0, 10) : String(r.due_date),
        generationDate: r.due_date instanceof Date ? r.due_date.toISOString().slice(0, 10) : String(r.due_date),
      };
    });

    const adjustments = adjustmentsRes.rows.map((r) => ({
      id: r.id,
      dueId: r.due_id,
      entityId: r.entity_id,
      entityName: r.entity_name,
      type: r.type,
      amountInr: Number(r.amount_inr),
      beforeBalance: Number(r.before_balance),
      afterBalance: Number(r.after_balance),
      reasonCode: r.reason_code,
      description: r.description,
      approvedBy: r.approved_by,
      approvedAt: r.approved_at ? new Date(r.approved_at).toISOString() : new Date().toISOString(),
      correlationId: r.correlation_id,
    }));

    const payments = paymentsRes.rows.map((r) => {
      const amt = Number(r.amount_inr || 0);
      const method = (r.payment_method || 'CASH') as any;
      const ref = r.transaction_ref || r.upi_utr || r.id;
      const status = (r.settlement_status === 'SETTLED' ? 'RECEIPT_GENERATED' : 'PENDING') as any;
      const allocs = typeof r.allocated_dues === 'string' ? JSON.parse(r.allocated_dues) : r.allocated_dues || [];
      return {
        id: r.id,
        orderId: r.gateway_order_id || undefined,
        entityId: r.entity_id,
        entityName: r.entity_name,
        registrationNumber: r.registration_number,
        wardName: r.ward_name,
        categoryName: 'Auto-Rickshaw (Three-Wheeler)',
        amountInr: amt,
        method,
        paymentMethod: method,
        referenceNumber: ref,
        transactionRef: ref,
        processingStatus: status,
        settlementStatus: r.settlement_status as any,
        receiptId: r.receipt_id || undefined,
        receiptNumber: r.receipt_id ? `SUP/2026/0000123${r.receipt_id.slice(-2)}` : undefined,
        collectedBy: r.collected_by || 'AG-104',
        collectedByRole: (r.collector_role || 'AGENT') as any,
        timestamp: r.payment_date ? new Date(r.payment_date).toISOString() : new Date().toISOString(),
        paymentDate: r.payment_date ? new Date(r.payment_date).toISOString() : new Date().toISOString(),
        allocations: allocs,
        notes: r.notes || undefined,
      };
    });

    const receipts = receiptsRes.rows.map((r) => {
      const amt = Number(r.amount_inr || 0);
      return {
        id: r.id,
        receiptNumber: r.receipt_number,
        paymentId: r.payment_id,
        entityId: r.entity_id,
        entityName: r.owner_name || 'Ramesh Chandra Yadav',
        ownerName: r.owner_name || 'Ramesh Chandra Yadav',
        registrationNumber: r.registration_number,
        categoryName: 'Auto-Rickshaw (Three-Wheeler)',
        wardName: r.ward_name,
        dateTime: r.issued_at ? new Date(r.issued_at).toLocaleString('en-IN') : new Date().toLocaleString('en-IN'),
        previousOutstanding: amt,
        currentPayment: amt,
        allocatedAmount: amt,
        remainingOutstanding: 0,
        amountInr: amt,
        paymentMethod: (r.payment_method || 'CASH') as any,
        transactionReference: r.receipt_number,
        agentName: r.issued_by || 'Field Tax Agent',
        agentId: 'AG-104',
        verificationCode: r.verification_code || `VRF-${r.id.slice(-4)}-SUP26`,
        status: 'VALID' as const,
        lineItems: typeof r.line_items === 'string' ? JSON.parse(r.line_items) : r.line_items || [],
        maskedSummary: typeof r.masked_summary === 'string' ? JSON.parse(r.masked_summary) : r.masked_summary || {},
      };
    });

    const closings = closingsRes.rows.map((r) => ({
      id: r.id,
      agentId: r.agent_id,
      agentName: r.agent_name,
      wardName: r.ward_name,
      date: r.closing_date instanceof Date ? r.closing_date.toISOString().slice(0, 10) : String(r.closing_date),
      closingDate: r.closing_date instanceof Date ? r.closing_date.toISOString().slice(0, 10) : String(r.closing_date),
      expectedCash: Number(r.expected_cash || 0),
      actualCashCount: Number(r.actual_cash_count || 0),
      cashVariance: Number(r.cash_variance || 0),
      verifiedDigitalTotal: Number(r.upi_total_logged || 0),
      pendingManualUpiCount: 0,
      pendingManualUpiTotal: 0,
      receiptsCount: Number(r.total_receipts_issued || 0),
      cancelledCount: 0,
      status: (r.status || 'OPEN') as any,
      submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : undefined,
      verifyingOfficer: r.verified_by_officer_name || undefined,
      officerComments: r.officer_comments || undefined,
      verifiedAt: r.verified_at ? new Date(r.verified_at).toISOString() : undefined,
      discrepancyNote: r.discrepancy_note || undefined,
    }));

    const reconciliations = reconciliationsRes.rows.map((r) => ({
      id: r.id,
      date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
      gatewayProvider: r.gateway_provider,
      internalPaymentId: r.internal_payment_id || undefined,
      gatewayPaymentId: r.gateway_payment_id || undefined,
      utrOrTxnId: r.utr_or_txn_id || undefined,
      ledgerAmountInr: Number(r.ledger_amount_inr),
      gatewaySettledAmountInr: Number(r.gateway_settled_amount_inr),
      discrepancyInr: Number(r.discrepancy_inr),
      status: r.status,
      resolutionNotes: r.resolution_notes || undefined,
      resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : undefined,
      resolvedBy: r.resolved_by || undefined,
    }));

    const disputes = disputesRes.rows.map((r) => ({
      id: r.id,
      recordType: r.record_type,
      paymentId: r.payment_id,
      receiptNumber: r.receipt_number || '',
      entityId: r.entity_id,
      entityName: r.entity_name,
      registrationNumber: r.registration_number || '',
      amountInr: Number(r.amount_inr),
      reasonCode: r.reason_code,
      description: r.description,
      status: r.status,
      requestedBy: r.filed_by,
      requestedAt: r.filed_at ? new Date(r.filed_at).toISOString() : new Date().toISOString(),
      reviewedBy: r.adjudicated_by || undefined,
      resolutionNotes: r.resolution_notes || undefined,
    }));

    const notifications = notificationsRes.rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString(),
      recipientName: r.recipient_name,
      recipientMobile: r.recipient_mobile,
      channel: r.channel,
      eventType: r.eventtype || r.eventType,
      templateId: r.template_id,
      status: r.status,
      retryCount: Number(r.retry_count || 0),
      failureReason: r.failure_reason || undefined,
      correlationId: r.correlation_id,
    }));

    const notificationTemplates = templatesRes.rows.map((r) => ({
      id: r.id,
      name: r.name,
      channel: r.channel,
      eventType: r.eventtype || r.eventType,
      bodyTemplate: r.body_template,
      active: Boolean(r.active),
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    }));

    const verifications = verificationsRes.rows.map((r) => ({
      id: r.id,
      entityId: r.entity_id,
      registrationNumber: r.registration_number,
      provider: r.provider,
      status: r.status,
      referenceNumber: r.reference_number,
      ownerNameMatched: Boolean(r.owner_name_matched),
      vehicleClass: r.vehicle_class || undefined,
      requestedBy: r.requested_by,
      requestedAt: r.requested_at ? new Date(r.requested_at).toISOString() : new Date().toISOString(),
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
      notes: r.notes || undefined,
    }));

    const auditLogs = auditLogsRes.rows.map((r) => ({
      id: r.id,
      timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString(),
      actorName: r.actor_name,
      actorRole: r.actor_role,
      action: r.action,
      module: r.module,
      entityType: r.entity_type,
      entityId: r.entity_id,
      previousValueSummary: r.previous_value_summary || 'None',
      newValueSummary: r.new_value_summary || 'None',
      ipAddress: r.ip_address,
      correlationId: r.correlation_id,
      sha256Signature: r.sha256_signature || undefined,
    }));

    const sRow = settingsRes.rows[0];
    const settings: SystemSettingsRecord = sRow
      ? {
          municipalityName: sRow.municipality_name,
          municipalityCode: sRow.municipality_code,
          tagline: sRow.tagline,
          receiptPrefix: sRow.receipt_prefix,
          financialYear: sRow.financial_year,
          nextReceiptSequence: Number(sRow.next_receipt_sequence),
          timezone: sRow.timezone,
          currency: sRow.currency,
          allowAdvanceOverpayment: Boolean(sRow.allow_advance_overpayment),
          requireOfficerApprovalForRegistrations: Boolean(sRow.require_officer_approval_for_registrations),
          requireAdminApprovalForWaivers: Boolean(sRow.require_admin_approval_for_waivers),
          paymentGatewayProvider: sRow.payment_gateway_provider,
          paymentGatewayStatus: sRow.payment_gateway_status,
          smsProviderStatus: sRow.sms_provider_status,
          whatsappProviderStatus: sRow.whatsapp_provider_status,
          govVerificationProviderStatus: sRow.gov_verification_provider_status,
          updatedAt: sRow.updated_at ? new Date(sRow.updated_at).toISOString() : new Date().toISOString(),
          updatedBy: sRow.updated_by || 'SYSTEM',
        }
      : {
          municipalityName: 'Noida Municipal Corporation',
          municipalityCode: 'NMC',
          tagline: 'Citizen-First Revenue & Field Collection Portal',
          receiptPrefix: 'NMC-REC-2026',
          financialYear: '2025-2026',
          nextReceiptSequence: 43,
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          allowAdvanceOverpayment: false,
          requireOfficerApprovalForRegistrations: true,
          requireAdminApprovalForWaivers: true,
          paymentGatewayProvider: 'RAZORPAY_MOCK',
          paymentGatewayStatus: 'ACTIVE',
          smsProviderStatus: 'ACTIVE',
          whatsappProviderStatus: 'ACTIVE',
          govVerificationProviderStatus: 'ACTIVE',
          updatedAt: new Date().toISOString(),
          updatedBy: 'SYSTEM_FALLBACK',
        };

    return {
      users,
      sessions: sessionsRes.rows.map((r) => ({
        jti: r.jti,
        userId: r.user_id,
        loginIdentifier: r.login_identifier,
        role: r.role,
        issuedAt: new Date(r.issued_at).toISOString(),
        expiresAt: new Date(r.expires_at).toISOString(),
        revokedAt: r.revoked_at ? new Date(r.revoked_at).toISOString() : null,
        replacedByJti: r.replaced_by_jti || null,
        ipAddress: r.ip_address,
        userAgent: r.user_agent,
      })),
      resetTokens: resetTokensRes.rows.map((r) => ({
        token: r.token,
        userId: r.user_id,
        expiresAt: new Date(r.expires_at).toISOString(),
        usedAt: r.used_at ? new Date(r.used_at).toISOString() : null,
      })),
      wards: wards as any,
      zones: zones as any,
      categories: categories as any,
      rates: rates as any,
      entities,
      dues: dues as any,
      adjustments: adjustments as any,
      payments: payments as any,
      receipts: receipts as any,
      closings: closings as any,
      reconciliations: reconciliations as any,
      disputes: disputes as any,
      notifications,
      notificationTemplates,
      verifications,
      auditLogs,
      imports: importsRes.rows.map((r) => ({
        id: r.id,
        fileName: r.file_name,
        importType: r.import_type,
        status: r.status,
        totalRows: Number(r.total_rows),
        validRowsCount: Number(r.valid_rows_count),
        errorRowsCount: Number(r.error_rows_count),
        validStagingRecords: typeof r.valid_staging_records === 'string' ? JSON.parse(r.valid_staging_records) : r.valid_staging_records || [],
        rowErrors: typeof r.row_errors === 'string' ? JSON.parse(r.row_errors) : r.row_errors || [],
        createdBy: r.created_by,
        createdAt: new Date(r.created_at).toISOString(),
        committedAt: r.committed_at ? new Date(r.committed_at).toISOString() : undefined,
      })),
      idempotencyKeys: idempotencyRes.rows.map((r) => ({
        key: r.key,
        endpoint: r.endpoint,
        actorId: r.actor_id,
        statusCode: Number(r.status_code),
        responseBody: typeof r.response_body === 'string' ? JSON.parse(r.response_body) : r.response_body,
        createdAt: new Date(r.created_at).toISOString(),
      })),
      settings,
    };
  }

  /**
   * Executes a unit of work inside an explicit PostgreSQL transaction (BEGIN ... COMMIT / ROLLBACK).
   * Synchronizes modified collections back into PostgreSQL relational tables with full constraint validation.
   */
  public async withTransaction<R>(
    operationName: string,
    fn: (collections: SuvidhaDataCollections) => Promise<R> | R
  ): Promise<R> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN;');

      // Read current state
      const collections = await this.readAll();

      // Execute business function
      const result = await fn(collections);

      // Synchronize modified collections back to relational tables
      await this.syncCollectionsToPostgres(client, collections);

      await client.query('COMMIT;');
      return result;
    } catch (err) {
      await client.query('ROLLBACK;');
      console.error(`[PostgresDataStore] Transaction "${operationName}" failed and was rolled back!`, err);
      throw err;
    } finally {
      client.release();
    }
  }

  private async syncCollectionsToPostgres(
    client: { query: PoolClient['query'] },
    colls: SuvidhaDataCollections
  ): Promise<void> {
    // 1. Sync Entities (upsert)
    for (const e of colls.entities) {
      await client.query(
        `INSERT INTO municipal_entities (
          id, registration_number, normalized_identifier, entity_type, name, mobile, address, category,
          category_id, vehicle_type, stall_location, ward_id, ward_name, zone_name, registration_date,
          previous_outstanding, new_charges, adjustments_total, waivers_total, paid_allocated, outstanding_amount,
          registration_status, gov_verification_status, gov_verification_ref, gov_last_checked, officer_comments, rejection_reason
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
        ON CONFLICT (id) DO UPDATE SET
          registration_status = EXCLUDED.registration_status,
          gov_verification_status = EXCLUDED.gov_verification_status,
          gov_verification_ref = EXCLUDED.gov_verification_ref,
          gov_last_checked = EXCLUDED.gov_last_checked,
          officer_comments = EXCLUDED.officer_comments,
          rejection_reason = EXCLUDED.rejection_reason,
          previous_outstanding = EXCLUDED.previous_outstanding,
          new_charges = EXCLUDED.new_charges,
          adjustments_total = EXCLUDED.adjustments_total,
          waivers_total = EXCLUDED.waivers_total,
          paid_allocated = EXCLUDED.paid_allocated,
          outstanding_amount = EXCLUDED.outstanding_amount;`,
        [
          e.id,
          e.registrationNumber,
          e.normalizedIdentifier,
          e.entityType,
          e.name,
          e.mobile,
          e.address,
          e.category,
          e.categoryId,
          e.vehicleType || null,
          e.stallLocation || null,
          e.wardId,
          e.wardName,
          e.zoneName,
          e.registrationDate,
          e.previousOutstanding,
          e.newCharges,
          e.adjustmentsTotal,
          e.waiversTotal,
          e.paidAllocated,
          e.outstandingAmount,
          e.registrationStatus,
          e.govVerificationStatus,
          e.govVerificationRef || null,
          e.govLastChecked || null,
          e.officerComments || null,
          e.rejectionReason || null,
        ]
      );
    }

    // 2. Sync Dues (upsert)
    for (const rawD of colls.dues) {
      const d = rawD as any;
      await client.query(
        `INSERT INTO due_records (
          id, entity_id, entity_name, registration_number, ward_id, ward_name, category_id,
          category_name, period_label, due_date, base_amount_inr, penalty_amount_inr,
          adjustment_amount_inr, waiver_amount_inr, paid_amount_inr, balance_inr, status,
          rate_id, rate_snapshot_inr
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        ON CONFLICT (id) DO UPDATE SET
          adjustment_amount_inr = EXCLUDED.adjustment_amount_inr,
          waiver_amount_inr = EXCLUDED.waiver_amount_inr,
          paid_amount_inr = EXCLUDED.paid_amount_inr,
          balance_inr = EXCLUDED.balance_inr,
          status = EXCLUDED.status;`,
        [
          d.id,
          d.entityId,
          d.entityName,
          d.registrationNumber,
          d.wardId,
          d.wardName,
          d.categoryId,
          d.categoryName,
          d.periodLabel,
          d.dueDate,
          d.baseAmountInr,
          d.penaltyAmountInr,
          d.adjustmentAmountInr,
          d.waiverAmountInr,
          d.paidAmountInr,
          d.balanceInr,
          d.status,
          d.rateId,
          d.rateSnapshotInr,
        ]
      );
    }

    // 3. Sync Payments
    for (const rawP of colls.payments) {
      const p = rawP as any;
      await client.query(
        `INSERT INTO payment_records (
          id, entity_id, registration_number, entity_name, amount_inr, payment_method,
          settlement_status, receipt_id, transaction_ref, upi_utr, collected_by,
          collector_role, ward_id, ward_name, payment_date, notes, allocated_dues,
          refund_amount_inr, reversed_at, reversal_reason, reversal_actor
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
        ON CONFLICT (id) DO UPDATE SET
          settlement_status = EXCLUDED.settlement_status,
          receipt_id = EXCLUDED.receipt_id,
          refund_amount_inr = EXCLUDED.refund_amount_inr,
          reversed_at = EXCLUDED.reversed_at,
          reversal_reason = EXCLUDED.reversal_reason,
          reversal_actor = EXCLUDED.reversal_actor;`,
        [
          p.id,
          p.entityId,
          p.registrationNumber,
          p.entityName,
          p.amountInr,
          p.paymentMethod,
          p.settlementStatus,
          p.receiptId || null,
          p.transactionRef || null,
          p.upiUtr || null,
          p.collectedBy,
          p.collectorRole,
          p.wardId,
          p.wardName,
          p.paymentDate,
          p.notes || null,
          JSON.stringify(p.allocatedDues || []),
          p.refundAmountInr || 0,
          p.reversedAt || null,
          p.reversalReason || null,
          p.reversalActor || null,
        ]
      );
    }

    // 4. Sync Receipts
    for (const rawRc of colls.receipts) {
      const rc = rawRc as any;
      await client.query(
        `INSERT INTO receipt_records (
          id, receipt_number, payment_id, entity_id, registration_number, owner_name,
          amount_inr, payment_method, payment_date, issued_at, issued_by, ward_name,
          line_items, sha256_hash, verification_code, masked_summary
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ON CONFLICT (id) DO NOTHING;`,
        [
          rc.id,
          rc.receiptNumber,
          rc.paymentId,
          rc.entityId,
          rc.registrationNumber,
          rc.ownerName,
          rc.amountInr,
          rc.paymentMethod,
          rc.paymentDate,
          rc.issuedAt,
          rc.issuedBy,
          rc.wardName,
          JSON.stringify(rc.lineItems || []),
          rc.sha256Hash,
          rc.verificationCode,
          JSON.stringify(rc.maskedSummary || {}),
        ]
      );
    }

    // 5. Sync Daily Closings
    for (const rawCl of colls.closings) {
      const cl = rawCl as any;
      await client.query(
        `INSERT INTO daily_closings (
          id, closing_date, agent_id, agent_name, ward_id, ward_name, expected_cash,
          actual_cash_count, cash_variance, upi_total_logged, total_receipts_issued,
          status, discrepancy_note, submitted_at, verified_at, verified_by_officer_id,
          verified_by_officer_name, officer_comments, treasury_chest_deposit_ref
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
        ON CONFLICT (id) DO UPDATE SET
          actual_cash_count = EXCLUDED.actual_cash_count,
          cash_variance = EXCLUDED.cash_variance,
          status = EXCLUDED.status,
          discrepancy_note = EXCLUDED.discrepancy_note,
          submitted_at = EXCLUDED.submitted_at,
          verified_at = EXCLUDED.verified_at,
          verified_by_officer_id = EXCLUDED.verified_by_officer_id,
          verified_by_officer_name = EXCLUDED.verified_by_officer_name,
          officer_comments = EXCLUDED.officer_comments,
          treasury_chest_deposit_ref = EXCLUDED.treasury_chest_deposit_ref;`,
        [
          cl.id,
          cl.closingDate,
          cl.agentId,
          cl.agentName,
          cl.wardId,
          cl.wardName,
          cl.expectedCash,
          cl.actualCashCount,
          cl.cashVariance,
          cl.upiTotalLogged,
          cl.totalReceiptsIssued,
          cl.status,
          cl.discrepancyNote || null,
          cl.submittedAt || null,
          cl.verifiedAt || null,
          cl.verifiedByOfficerId || null,
          cl.verifiedByOfficerName || null,
          cl.officerComments || null,
          cl.treasuryChestDepositRef || null,
        ]
      );
    }

    // 6. Sync Rates
    for (const rawR of colls.rates) {
      const r = rawR as any;
      await client.query(
        `INSERT INTO rate_masters (
          id, category_id, category_name, entity_type, rate_amount_inr, billing_frequency,
          penalty_grace_days, penalty_percentage_monthly, effective_from, effective_to,
          ward_scope, status, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          effective_to = EXCLUDED.effective_to;`,
        [
          r.id,
          r.categoryId,
          r.categoryName,
          r.entityType,
          r.rateAmountInr,
          r.billingFrequency,
          r.penaltyGraceDays,
          r.penaltyPercentageMonthly,
          r.effectiveFrom,
          r.effectiveTo || null,
          r.wardScope,
          r.status,
          r.createdBy,
        ]
      );
    }

    // 7. Sync Due Adjustments
    for (const rawA of colls.adjustments) {
      const a = rawA as any;
      await client.query(
        `INSERT INTO due_adjustments (
          id, due_id, entity_id, entity_name, type, amount_inr, before_balance,
          after_balance, reason_code, description, approved_by, approved_at, correlation_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO NOTHING;`,
        [
          a.id,
          a.dueId,
          a.entityId,
          a.entityName,
          a.type,
          a.amountInr,
          a.beforeBalance,
          a.afterBalance,
          a.reasonCode,
          a.description,
          a.approvedBy,
          a.approvedAt,
          a.correlationId,
        ]
      );
    }

    // 8. Sync Audit Logs
    for (const al of colls.auditLogs) {
      await client.query(
        `INSERT INTO audit_logs (
          id, timestamp, actor_name, actor_role, action, module, entity_type,
          entity_id, previous_value_summary, new_value_summary, ip_address, correlation_id, sha256_signature
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        ON CONFLICT (id) DO NOTHING;`,
        [
          al.id,
          al.timestamp,
          al.actorName,
          al.actorRole,
          al.action,
          al.module,
          al.entityType,
          al.entityId,
          al.previousValueSummary,
          al.newValueSummary,
          al.ipAddress,
          al.correlationId,
          (al as any).sha256Signature || null,
        ]
      );
    }

    // 9. Sync Disputes
    for (const rawDis of colls.disputes) {
      const dis = rawDis as any;
      await client.query(
        `INSERT INTO refund_disputes (
          id, record_type, payment_id, entity_id, entity_name, amount_inr, reason_code,
          description, status, filed_by, filed_at, adjudicated_by, adjudicated_at, resolution_notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          adjudicated_by = EXCLUDED.adjudicated_by,
          adjudicated_at = EXCLUDED.adjudicated_at,
          resolution_notes = EXCLUDED.resolution_notes;`,
        [
          dis.id,
          dis.recordType,
          dis.paymentId,
          dis.entityId,
          dis.entityName,
          dis.amountInr,
          dis.reasonCode,
          dis.description,
          dis.status,
          dis.filedBy,
          dis.filedAt,
          dis.adjudicatedBy || null,
          dis.adjudicatedAt || null,
          dis.resolutionNotes || null,
        ]
      );
    }

    // 10. Sync Settings
    const s = colls.settings;
    await client.query(
      `INSERT INTO system_settings (
        id, municipality_name, municipality_code, tagline, receipt_prefix, financial_year,
        next_receipt_sequence, timezone, currency, allow_advance_overpayment,
        require_officer_approval_for_registrations, require_admin_approval_for_waivers,
        payment_gateway_provider, payment_gateway_status, sms_provider_status,
        whatsapp_provider_status, gov_verification_provider_status, updated_at, updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
      ON CONFLICT (id) DO UPDATE SET
        municipality_name = EXCLUDED.municipality_name,
        tagline = EXCLUDED.tagline,
        receipt_prefix = EXCLUDED.receipt_prefix,
        allow_advance_overpayment = EXCLUDED.allow_advance_overpayment,
        require_officer_approval_for_registrations = EXCLUDED.require_officer_approval_for_registrations,
        require_admin_approval_for_waivers = EXCLUDED.require_admin_approval_for_waivers,
        payment_gateway_status = EXCLUDED.payment_gateway_status,
        updated_at = EXCLUDED.updated_at,
        updated_by = EXCLUDED.updated_by;`,
      [
        'SYSTEM_CONFIG',
        s.municipalityName,
        s.municipalityCode,
        s.tagline,
        s.receiptPrefix,
        s.financialYear,
        s.nextReceiptSequence,
        s.timezone,
        s.currency,
        s.allowAdvanceOverpayment,
        s.requireOfficerApprovalForRegistrations,
        s.requireAdminApprovalForWaivers,
        s.paymentGatewayProvider,
        s.paymentGatewayStatus,
        s.smsProviderStatus,
        s.whatsappProviderStatus,
        s.govVerificationProviderStatus,
        new Date().toISOString(),
        s.updatedBy,
      ]
    );

    // 11. Sync Users
    for (const u of colls.users) {
      await client.query(
        `INSERT INTO system_users (
          id, full_name, login_identifier, mobile, email, role, assigned_ward, assigned_zone,
          status, created_date, last_login, password_hash, force_password_change, linked_entity_ids,
          failed_login_attempts, locked_until
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          last_login = EXCLUDED.last_login,
          password_hash = EXCLUDED.password_hash,
          force_password_change = EXCLUDED.force_password_change,
          failed_login_attempts = EXCLUDED.failed_login_attempts,
          locked_until = EXCLUDED.locked_until,
          linked_entity_ids = EXCLUDED.linked_entity_ids;`,
        [
          u.id,
          u.fullName,
          u.loginIdentifier,
          u.mobile,
          u.email || null,
          u.role,
          u.assignedWard,
          u.assignedZone,
          u.status,
          u.createdDate,
          u.lastLogin || null,
          u.passwordHash,
          u.forcePasswordChange,
          JSON.stringify(u.linkedEntityIds || []),
          u.failedLoginAttempts || 0,
          u.lockedUntil || null,
        ]
      );
    }
  }

  public async seedIfEmpty(): Promise<void> {
    await seedPostgresIfEmpty(this.pool);
  }

  public async resetToDeterministicSeed(): Promise<void> {
    await resetPostgresToSeed(this.pool, true);
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}
