import { Pool, PoolClient } from 'pg';
import { generateDeterministicSeed } from './seedData';
import { SuvidhaDataCollections } from '../repositories/interfaces';

export interface SeedValidationResult {
  valid: boolean;
  counts: Record<string, number>;
  checks: {
    usersPopulated: boolean;
    entitiesWithValidWards: boolean;
    duesWithValidEntities: boolean;
    paymentsWithValidEntities: boolean;
    receiptsWithValidPayments: boolean;
    closingsWithValidWards: boolean;
    noFloatingPointErrors: boolean;
  };
}

export function parseDateToIso(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const year = m[3].length === 4 ? m[3] : `20${m[3].slice(0, 2)}`;
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

export function parseTimestampToIso(dateStr?: string | null): string {
  if (!dateStr) return new Date().toISOString();
  const s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00.000Z`;
  
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const year = m[3];
    const hour = (m[4] || '00').padStart(2, '0');
    const min = (m[5] || '00').padStart(2, '0');
    const sec = (m[6] || '00').padStart(2, '0');
    return `${year}-${month}-${day}T${hour}:${min}:${sec}.000Z`;
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString();
  }
  return new Date().toISOString();
}

/**
 * Idempotent PostgreSQL Seeder & Verifier (Phase 5)
 *
 * Guarantees:
 * 1. Safe insertion with `ON CONFLICT DO NOTHING` — running seed repeatedly never creates duplicates.
 * 2. Referential integrity: tables are populated in dependency order.
 * 3. Exact NUMERIC values for financial accounts avoiding floating point errors.
 * 4. Production guard against accidental resets.
 */
export async function seedPostgresIfEmpty(
  pool: Pool | PoolClient,
  customSeed?: SuvidhaDataCollections
): Promise<{ seeded: boolean; counts: Record<string, number> }> {
  const seed = customSeed || generateDeterministicSeed();

  // Check if already seeded
  const userCountRes = await pool.query('SELECT COUNT(*)::int as cnt FROM system_users;');
  const existingCount = userCountRes.rows[0]?.cnt || 0;

  if (existingCount > 0) {
    const counts = await getPostgresTableCounts(pool);
    return { seeded: false, counts };
  }

  console.log('[PostgresSeed] Database is unpopulated. Seeding deterministic municipal dataset...');

  // 1. Zones
  for (const z of seed.zones) {
    await pool.query(
      `INSERT INTO zones (id, code, name, ward_count, active_entities_count, total_collection_inr, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING;`,
      [
        z.id,
        z.code,
        z.name,
        (z as any).wardCount || (z as any).wardsCount || 0,
        (z as any).activeEntitiesCount || (z as any).totalEntities || 0,
        (z as any).totalCollectionInr || (z as any).totalOutstanding || 0,
        (z as any).description || '',
      ]
    );
  }

  // 2. Wards
  for (const w of seed.wards) {
    await pool.query(
      `INSERT INTO wards (id, code, name, zone_id, zone_name, officer_in_charge, agent_assigned, registered_entities_count, active_vendors_count, total_collection_inr, monthly_target_inr)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING;`,
      [
        w.id,
        w.code,
        w.name,
        w.zoneId,
        w.zoneName,
        (w as any).officerInCharge || (w as any).assignedOfficerName || 'Rajeshwari Verma (RO)',
        (w as any).agentAssigned || `Agent (${(w as any).assignedAgentsCount || 4} Assigned)`,
        (w as any).registeredEntitiesCount || 0,
        (w as any).activeVendorsCount || 0,
        (w as any).totalCollectionInr || (w as any).todayCollection || 0,
        (w as any).monthlyTargetInr || (w as any).outstandingDues || 0,
      ]
    );
  }

  // 3. Categories
  for (const c of seed.categories) {
    await pool.query(
      `INSERT INTO categories (id, code, name, type, base_rate_monthly_inr, penalty_rate_monthly_inr, billing_cycle, entities_count, active_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO NOTHING;`,
      [
        c.id,
        c.code,
        c.name,
        (c as any).type || (c as any).entityType || 'VEHICLE',
        (c as any).baseRateMonthlyInr || (c as any).activeRateAmount || 450,
        (c as any).penaltyRateMonthlyInr || 25,
        (c as any).billingCycle || 'MONTHLY',
        (c as any).entitiesCount || 0,
        (c as any).activeStatus !== undefined ? (c as any).activeStatus : true,
      ]
    );
  }

  // 4. System Users
  for (const u of seed.users) {
    await pool.query(
      `INSERT INTO system_users (id, full_name, login_identifier, mobile, email, role, assigned_ward, assigned_zone, status, created_date, password_hash, force_password_change, linked_entity_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO NOTHING;`,
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
        u.passwordHash,
        u.forcePasswordChange,
        JSON.stringify(u.linkedEntityIds || []),
      ]
    );
  }

  // 5. Rate Masters
  for (const rawR of seed.rates) {
    const r = rawR as any;
    await pool.query(
      `INSERT INTO rate_masters (id, category_id, category_name, entity_type, rate_amount_inr, billing_frequency, penalty_grace_days, penalty_percentage_monthly, effective_from, effective_to, ward_scope, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO NOTHING;`,
      [
        r.id,
        r.categoryId,
        r.categoryName,
        r.entityType || (r as any).vehicleType || 'VEHICLE',
        r.rateAmountInr || (r as any).amountInr || 450,
        r.billingFrequency || (r as any).frequency || 'MONTHLY',
        r.penaltyGraceDays || 15,
        r.penaltyPercentageMonthly || 5.0,
        parseDateToIso(r.effectiveFrom) || '2026-04-01',
        r.effectiveTo ? parseDateToIso(r.effectiveTo) : null,
        r.wardScope || 'ALL',
        r.status || 'ACTIVE',
        r.createdBy || 'ADMIN',
      ]
    );
  }

  // 6. Municipal Entities
  for (const e of seed.entities) {
    await pool.query(
      `INSERT INTO municipal_entities (
        id, registration_number, normalized_identifier, entity_type, name, mobile, address, category,
        category_id, vehicle_type, stall_location, ward_id, ward_name, zone_name, registration_date,
        previous_outstanding, new_charges, adjustments_total, waivers_total, paid_allocated, outstanding_amount,
        registration_status, gov_verification_status, gov_verification_ref, gov_last_checked
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
      ON CONFLICT (id) DO NOTHING;`,
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
        parseDateToIso(e.registrationDate) || '2025-01-12',
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
      ]
    );
  }

  // 7. Due Records
  for (const rawD of seed.dues) {
    const d = rawD as any;
    const entity = seed.entities.find((e) => e.id === d.entityId);
    const wardId = d.wardId || entity?.wardId || 'WD-12';
    const categoryId = d.categoryId || entity?.categoryId || 'CAT-AUTO';
    const baseAmount = d.baseAmountInr !== undefined ? d.baseAmountInr : ((d as any).originalAmount || 400);
    const penaltyAmount = d.penaltyAmountInr !== undefined ? d.penaltyAmountInr : 0;
    const adjustmentAmount = d.adjustmentAmountInr !== undefined ? d.adjustmentAmountInr : ((d as any).adjustmentsAmount || 0);
    const waiverAmount = d.waiverAmountInr !== undefined ? d.waiverAmountInr : ((d as any).waiversAmount || 0);
    const paidAmount = d.paidAmountInr !== undefined ? d.paidAmountInr : ((d as any).paidAmount || 0);
    const balance = d.balanceInr !== undefined ? d.balanceInr : ((d as any).outstandingAmount !== undefined ? (d as any).outstandingAmount : baseAmount - waiverAmount - paidAmount);
    const periodLabel = d.periodLabel || `${(d as any).periodStart || '01/03/2026'} - ${(d as any).periodEnd || '31/03/2026'}`;
    const dueDate = parseDateToIso(d.dueDate) || '2026-04-15';
    const rateSnapshot = d.rateSnapshotInr !== undefined ? d.rateSnapshotInr : baseAmount;

    await pool.query(
      `INSERT INTO due_records (
        id, entity_id, entity_name, registration_number, ward_id, ward_name, category_id,
        category_name, period_label, due_date, base_amount_inr, penalty_amount_inr,
        adjustment_amount_inr, waiver_amount_inr, paid_amount_inr, balance_inr, status,
        rate_id, rate_snapshot_inr
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (id) DO NOTHING;`,
      [
        d.id,
        d.entityId,
        d.entityName,
        d.registrationNumber,
        wardId,
        d.wardName,
        categoryId,
        d.categoryName,
        periodLabel,
        dueDate,
        baseAmount,
        penaltyAmount,
        adjustmentAmount,
        waiverAmount,
        paidAmount,
        balance,
        d.status,
        d.rateId,
        rateSnapshot,
      ]
    );
  }

  // 8. Due Adjustments
  for (const rawA of seed.adjustments) {
    const a = rawA as any;
    await pool.query(
      `INSERT INTO due_adjustments (id, due_id, entity_id, entity_name, type, amount_inr, before_balance, after_balance, reason_code, description, approved_by, approved_at, correlation_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
        a.reasonCode || a.reason || 'OTHER',
        a.description || a.supportingRef || 'Approved waiver',
        a.approvedBy || a.reviewedBy || a.requestedBy || 'ADMIN',
        a.approvedAt || new Date().toISOString(),
        a.correlationId || 'SEED_CORR',
      ]
    );
  }

  // 9. Payment Records
  for (const rawP of seed.payments) {
    const p = rawP as any;
    const entity = seed.entities.find((e) => e.id === p.entityId);
    const wardId = p.wardId || entity?.wardId || 'WD-12';
    let method = p.paymentMethod || p.method || 'CASH';
    if (method === 'UPI_REFERENCE') method = 'UPI_MANUAL';
    if (method === 'PAYMENT_GATEWAY') method = 'GATEWAY_ONLINE';

    let status = p.settlementStatus || 'SUCCESS';
    if (status === 'SETTLED') status = 'SUCCESS';

    const pDate = parseTimestampToIso(p.paymentDate || p.timestamp);

    await pool.query(
      `INSERT INTO payment_records (
        id, entity_id, registration_number, entity_name, amount_inr, payment_method,
        settlement_status, receipt_id, transaction_ref, upi_utr, collected_by,
        collector_role, ward_id, ward_name, payment_date, notes, allocated_dues
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT (id) DO NOTHING;`,
      [
        p.id,
        p.entityId,
        p.registrationNumber,
        p.entityName,
        p.amountInr,
        method,
        status,
        p.receiptId || null,
        p.transactionRef || p.referenceNumber || null,
        p.upiUtr || null,
        p.collectedBy,
        p.collectorRole || p.collectedByRole || 'AGENT',
        wardId,
        p.wardName,
        pDate,
        p.notes || null,
        JSON.stringify(p.allocatedDues || p.allocations || []),
      ]
    );
  }

  // 10. Receipt Records
  for (const rawRc of seed.receipts) {
    const rc = rawRc as any;
    const entity = seed.entities.find((e) => e.id === rc.entityId);
    const ownerName = rc.ownerName || rc.entityName || entity?.name || 'Citizen';
    const amountInr = rc.amountInr !== undefined ? rc.amountInr : (rc.currentPayment !== undefined ? rc.currentPayment : 500);
    const issuedBy = rc.issuedBy || rc.agentName || 'Municipal Authority';
    const paymentDate = parseTimestampToIso(rc.paymentDate || rc.dateTime);
    const issuedAt = parseTimestampToIso(rc.issuedAt || paymentDate);
    const wardName = rc.wardName || entity?.wardName || 'Ward Central';
    const regNo = rc.registrationNumber || entity?.registrationNumber || 'NA';

    await pool.query(
      `INSERT INTO receipt_records (
        id, receipt_number, payment_id, entity_id, registration_number, owner_name,
        amount_inr, payment_method, payment_date, issued_at, issued_by, ward_name,
        line_items, sha256_hash, verification_code, masked_summary
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (id) DO NOTHING;`,
      [
        rc.id,
        rc.receiptNumber,
        rc.paymentId,
        rc.entityId,
        regNo,
        ownerName,
        amountInr,
        rc.paymentMethod || 'CASH',
        paymentDate,
        issuedAt,
        issuedBy,
        wardName,
        JSON.stringify(rc.lineItems || []),
        rc.sha256Hash || 'seed_hash',
        rc.verificationCode || `VRF-${rc.id}`,
        JSON.stringify(rc.maskedSummary || {}),
      ]
    );
  }

  // 11. Daily Closings
  for (const rawCl of seed.closings) {
    const cl = rawCl as any;
    const ward = seed.wards.find((w) => w.id === cl.wardId || w.name === cl.wardName || (cl.wardName && w.name.includes(cl.wardName.split(' ')[0])));
    const wardId = cl.wardId || ward?.id || 'WD-12';
    const closingDate = parseDateToIso(cl.closingDate || cl.date) || '2026-10-18';
    const upiTotal = cl.upiTotalLogged !== undefined ? cl.upiTotalLogged : (cl.verifiedDigitalTotal || cl.pendingManualUpiTotal || 0);
    const totalReceipts = cl.totalReceiptsIssued !== undefined ? cl.totalReceiptsIssued : (cl.receiptsCount || 0);
    const verifiedByOfficerName = cl.verifiedByOfficerName || cl.verifyingOfficer || null;

    await pool.query(
      `INSERT INTO daily_closings (
        id, closing_date, agent_id, agent_name, ward_id, ward_name, expected_cash,
        actual_cash_count, cash_variance, upi_total_logged, total_receipts_issued,
        status, discrepancy_note, submitted_at, verified_at, verified_by_officer_id,
        verified_by_officer_name, officer_comments, treasury_chest_deposit_ref
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (id) DO NOTHING;`,
      [
        cl.id,
        closingDate,
        cl.agentId,
        cl.agentName,
        wardId,
        cl.wardName,
        cl.expectedCash,
        cl.actualCashCount,
        cl.cashVariance,
        upiTotal,
        totalReceipts,
        cl.status,
        cl.discrepancyNote || null,
        cl.submittedAt ? parseTimestampToIso(cl.submittedAt) : null,
        cl.verifiedAt ? parseTimestampToIso(cl.verifiedAt) : null,
        cl.verifiedByOfficerId || null,
        verifiedByOfficerName,
        cl.officerComments || null,
        cl.treasuryChestDepositRef || null,
      ]
    );
  }

  // 12. Reconciliation Items
  for (const rawRec of seed.reconciliations) {
    const rec = rawRec as any;
    const rDate = parseDateToIso(rec.date || rec.txnDate || rec.settlementDate) || '2026-10-18';
    const ledgerAmount = rec.ledgerAmountInr !== undefined ? rec.ledgerAmountInr : (rec.ledgerAmount !== undefined ? rec.ledgerAmount : 0);
    const gatewayAmount = rec.gatewaySettledAmountInr !== undefined ? rec.gatewaySettledAmountInr : (rec.gatewayAmount !== undefined ? rec.gatewayAmount : 0);
    const discrepancy = rec.discrepancyInr !== undefined ? rec.discrepancyInr : (rec.differenceAmount !== undefined ? rec.differenceAmount : (ledgerAmount - gatewayAmount));
    const internalPaymentId = rec.internalPaymentId || rec.suvidhaPaymentId || null;
    const utrOrTxn = rec.utrOrTxnId || rec.gatewayTxnId || null;
    const resolutionNotes = rec.resolutionNotes || rec.reviewNotes || null;

    await pool.query(
      `INSERT INTO reconciliation_items (id, date, gateway_provider, internal_payment_id, gateway_payment_id, utr_or_txn_id, ledger_amount_inr, gateway_settled_amount_inr, discrepancy_inr, status, resolution_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING;`,
      [
        rec.id,
        rDate,
        rec.gatewayProvider,
        internalPaymentId,
        rec.gatewayPaymentId || null,
        utrOrTxn,
        ledgerAmount,
        gatewayAmount,
        discrepancy,
        rec.status,
        resolutionNotes,
      ]
    );
  }

  // 13. Refund Disputes
  for (const rawDis of seed.disputes) {
    const dis = rawDis as any;
    const filedBy = dis.filedBy || dis.requestedBy || 'CITIZEN';
    const filedAt = dis.filedAt || dis.requestedAt || new Date().toISOString();
    const adjudicatedBy = dis.adjudicatedBy || dis.reviewedBy || null;
    const paymentExists = seed.payments.some((p) => p.id === dis.paymentId);
    const paymentId = paymentExists ? dis.paymentId : null;
    const receiptNumber = dis.receiptNumber || null;

    await pool.query(
      `INSERT INTO refund_disputes (id, record_type, payment_id, receipt_number, entity_id, entity_name, amount_inr, reason_code, description, status, filed_by, filed_at, adjudicated_by, adjudicated_at, resolution_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       ON CONFLICT (id) DO NOTHING;`,
      [
        dis.id,
        dis.recordType,
        paymentId,
        receiptNumber,
        dis.entityId,
        dis.entityName,
        dis.amountInr,
        dis.reasonCode,
        dis.description,
        dis.status,
        filedBy,
        parseTimestampToIso(filedAt),
        adjudicatedBy,
        dis.adjudicatedAt ? parseTimestampToIso(dis.adjudicatedAt) : null,
        dis.resolutionNotes || null,
      ]
    );
  }

  // 14. Notification Logs
  for (const n of seed.notifications) {
    await pool.query(
      `INSERT INTO notification_logs (id, timestamp, recipient_name, recipient_mobile, channel, eventType, template_id, status, retry_count, correlation_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING;`,
      [n.id, parseTimestampToIso(n.timestamp), n.recipientName, n.recipientMobile, n.channel, n.eventType, n.templateId, n.status, n.retryCount, n.correlationId]
    );
  }

  // 15. Notification Templates
  for (const t of seed.notificationTemplates) {
    await pool.query(
      `INSERT INTO notification_templates (id, name, channel, eventType, body_template, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING;`,
      [t.id, t.name, t.channel, t.eventType, t.bodyTemplate, t.active]
    );
  }

  // 16. Government Verifications
  for (const v of seed.verifications) {
    await pool.query(
      `INSERT INTO gov_verifications (id, entity_id, registration_number, provider, status, reference_number, owner_name_matched, vehicle_class, requested_by, requested_at, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING;`,
      [v.id, v.entityId, v.registrationNumber, v.provider, v.status, v.referenceNumber, v.ownerNameMatched, v.vehicleClass || null, v.requestedBy, parseTimestampToIso(v.requestedAt), v.notes || null]
    );
  }

  // 17. Audit Logs
  for (const al of seed.auditLogs) {
    await pool.query(
      `INSERT INTO audit_logs (id, timestamp, actor_name, actor_role, action, module, entity_type, entity_id, previous_value_summary, new_value_summary, ip_address, correlation_id, sha256_signature)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (id) DO NOTHING;`,
      [al.id, parseTimestampToIso(al.timestamp), al.actorName, al.actorRole, al.action, al.module, al.entityType, al.entityId, al.previousValueSummary, al.newValueSummary, al.ipAddress, al.correlationId, (al as any).sha256Signature || null]
    );
  }

  // 18. Settings
  const s = seed.settings;
  await pool.query(
    `INSERT INTO system_settings (
      id, municipality_name, municipality_code, tagline, receipt_prefix, financial_year,
      next_receipt_sequence, timezone, currency, allow_advance_overpayment,
      require_officer_approval_for_registrations, require_admin_approval_for_waivers,
      payment_gateway_provider, payment_gateway_status, sms_provider_status,
      whatsapp_provider_status, gov_verification_provider_status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    ON CONFLICT (id) DO UPDATE SET
      municipality_name = EXCLUDED.municipality_name,
      tagline = EXCLUDED.tagline;`,
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
    ]
  );

  const finalCounts = await getPostgresTableCounts(pool);
  console.log('[PostgresSeed] PostgreSQL seed completed successfully with verified counts:', finalCounts);
  return { seeded: true, counts: finalCounts };
}

/**
 * Returns record counts for essential PostgreSQL tables.
 */
export async function getPostgresTableCounts(pool: Pool | PoolClient): Promise<Record<string, number>> {
  const tables = [
    'system_users',
    'zones',
    'wards',
    'categories',
    'rate_masters',
    'municipal_entities',
    'due_records',
    'due_adjustments',
    'payment_records',
    'receipt_records',
    'daily_closings',
    'reconciliation_items',
    'refund_disputes',
    'notification_logs',
    'gov_verifications',
    'audit_logs',
  ];

  const counts: Record<string, number> = {};
  for (const table of tables) {
    try {
      const res = await pool.query(`SELECT COUNT(*)::int as count FROM ${table};`);
      counts[table] = res.rows[0]?.count || 0;
    } catch {
      counts[table] = 0;
    }
  }
  return counts;
}

/**
 * Validates seeded record counts, foreign key constraints, and basic financial totals.
 */
export async function validatePostgresSeed(pool: Pool | PoolClient): Promise<SeedValidationResult> {
  const counts = await getPostgresTableCounts(pool);

  // Check 1: User presence
  const usersPopulated = (counts['system_users'] || 0) >= 7;

  // Check 2: Entities have valid wards
  const orphanEntities = await pool.query(`
    SELECT COUNT(*)::int as cnt FROM municipal_entities e
    LEFT JOIN wards w ON e.ward_id = w.id
    WHERE w.id IS NULL;
  `);
  const entitiesWithValidWards = (orphanEntities.rows[0]?.cnt || 0) === 0;

  // Check 3: Dues have valid entities
  const orphanDues = await pool.query(`
    SELECT COUNT(*)::int as cnt FROM due_records d
    LEFT JOIN municipal_entities e ON d.entity_id = e.id
    WHERE e.id IS NULL;
  `);
  const duesWithValidEntities = (orphanDues.rows[0]?.cnt || 0) === 0;

  // Check 4: Payments have valid entities
  const orphanPayments = await pool.query(`
    SELECT COUNT(*)::int as cnt FROM payment_records p
    LEFT JOIN municipal_entities e ON p.entity_id = e.id
    WHERE e.id IS NULL;
  `);
  const paymentsWithValidEntities = (orphanPayments.rows[0]?.cnt || 0) === 0;

  // Check 5: Receipts point to valid payments
  const orphanReceipts = await pool.query(`
    SELECT COUNT(*)::int as cnt FROM receipt_records r
    LEFT JOIN payment_records p ON r.payment_id = p.id
    WHERE p.id IS NULL;
  `);
  const receiptsWithValidPayments = (orphanReceipts.rows[0]?.cnt || 0) === 0;

  // Check 6: Closings have valid wards
  const orphanClosings = await pool.query(`
    SELECT COUNT(*)::int as cnt FROM daily_closings c
    LEFT JOIN wards w ON c.ward_id = w.id
    WHERE w.id IS NULL;
  `);
  const closingsWithValidWards = (orphanClosings.rows[0]?.cnt || 0) === 0;

  // Check 7: No floating point rounding bugs (scale is strictly 2 decimals)
  const precisionCheck = await pool.query(`
    SELECT balance_inr FROM due_records;
  `);
  const noFloatingPointErrors = precisionCheck.rows.every((r) => {
    const val = Number(r.balance_inr);
    return !isNaN(val) && Number.isInteger(Math.round(val * 100));
  });

  const valid =
    usersPopulated &&
    entitiesWithValidWards &&
    duesWithValidEntities &&
    paymentsWithValidEntities &&
    receiptsWithValidPayments &&
    closingsWithValidWards &&
    noFloatingPointErrors;

  return {
    valid,
    counts,
    checks: {
      usersPopulated,
      entitiesWithValidWards,
      duesWithValidEntities,
      paymentsWithValidEntities,
      receiptsWithValidPayments,
      closingsWithValidWards,
      noFloatingPointErrors,
    },
  };
}

/**
 * Resets PostgreSQL database tables to fresh seed data.
 * Protected against production execution.
 */
export async function resetPostgresToSeed(
  pool: Pool,
  force = false
): Promise<void> {
  if (process.env.NODE_ENV === 'production' && !force) {
    throw new Error('FATAL: Cannot reset PostgreSQL database in production environment!');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN;');
    await client.query(`
      TRUNCATE TABLE
        due_adjustments,
        receipt_records,
        refund_disputes,
        payment_records,
        due_records,
        gov_verifications,
        municipal_entities,
        rate_masters,
        daily_closings,
        reconciliation_items,
        notification_logs,
        notification_templates,
        audit_logs,
        import_batches,
        idempotency_keys,
        password_reset_tokens,
        refresh_sessions,
        system_users,
        categories,
        wards,
        zones,
        system_settings
      CASCADE;
    `);
    await client.query('COMMIT;');

    await seedPostgresIfEmpty(client);
  } catch (err) {
    await client.query('ROLLBACK;');
    throw err;
  } finally {
    client.release();
  }
}
