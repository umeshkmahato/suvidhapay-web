import {
  INITIAL_ZONES,
  INITIAL_WARDS,
  INITIAL_CATEGORIES,
  INITIAL_RATES,
  INITIAL_ENTITIES,
  INITIAL_DUES,
  INITIAL_ADJUSTMENTS,
  INITIAL_PAYMENTS,
  INITIAL_RECEIPTS,
  INITIAL_CLOSINGS,
  INITIAL_RECONCILIATION,
  INITIAL_REFUNDS_DISPUTES,
  INITIAL_USERS,
  INITIAL_NOTIFICATIONS,
  INITIAL_AUDIT_LOGS,
} from '../../data/mockSuvidhaData';
import { hashPassword, AppError } from '../infra/core';
import {
  IDataStore,
  SuvidhaDataCollections,
  BackendUserRecord,
  NotificationTemplateRecord,
  GovVerificationRecord,
  SystemSettingsRecord,
  ImportBatchRecord,
} from '../repositories/interfaces';

/**
 * Dedicated Seed Data Mechanism (Section 4 & Phase 2)
 *
 * Characteristics:
 * 1. Realistic Municipal Records: Mirrors Indian ULB revenue operations across Zones, Wards,
 *    Vending Zones, Auto/E-Rickshaw stands, and Citizen Self-Service.
 * 2. Deterministic & Stable Identifiers: All entity IDs (`ENT-1001`, `WD-12`, `ZN-02`),
 *    user IDs (`USR-ADM-01`, `USR-CIT-1001`), and rate IDs (`RT-2026-01`) remain stable.
 * 3. Valid Relational Integrity: Entities point to valid Wards and Categories; Dues point
 *    to valid Entities and Rates; Receipts point to Payments and Entities; Closings point to Agents.
 * 4. Passwords Hashed with Scrypt: No plaintext credentials are ever stored.
 * 5. Production Safety Guard: `resetDatabaseToSeed` rejects execution if NODE_ENV === 'production'.
 */

export function generateDeterministicSeed(): SuvidhaDataCollections {
  const adminHash = hashPassword('Suvidha@Admin2026');
  const officerHash = hashPassword('Suvidha@Officer2026');
  const agentHash = hashPassword('Suvidha@Agent2026');
  const citizenHash = hashPassword('Suvidha@Citizen2026');

  const seededUsers: BackendUserRecord[] = INITIAL_USERS.map((u) => {
    let pw = agentHash;
    if (u.role === 'ADMIN') pw = adminHash;
    else if (u.role === 'OFFICER') pw = officerHash;
    return {
      ...u,
      passwordHash: pw,
      forcePasswordChange: false,
      linkedEntityIds: [],
      failedLoginAttempts: 0,
      lockedUntil: null,
    };
  });

  // Deterministic Citizen demo user (linked to ENT-1001 UP16AB1234 & ENT-1002 UP16ER7781)
  seededUsers.push({
    id: 'USR-CIT-1001',
    fullName: 'Ramesh Chandra Yadav',
    loginIdentifier: '9811452310',
    mobile: '9811452310',
    email: 'ramesh.yadav@citizen.in',
    role: 'CITIZEN',
    assignedWard: 'W-12',
    assignedZone: 'Zone 2 — Central Commercial Hub',
    status: 'ACTIVE',
    createdDate: '12/01/2025',
    lastLogin: '10/10/2026 09:00',
    passwordHash: citizenHash,
    forcePasswordChange: false,
    linkedEntityIds: ['ENT-1001', 'ENT-1002'],
    failedLoginAttempts: 0,
    lockedUntil: null,
  });

  const seededTemplates: NotificationTemplateRecord[] = [
    {
      id: 'TPL_SMS_RCP_HI',
      name: 'Official Receipt Generated SMS',
      channel: 'SMS',
      eventType: 'RECEIPT_GENERATED',
      bodyTemplate:
        'Noida MC SuvidhaPay: Payment of INR {{amount}} received for {{regNo}}. Receipt No: {{receiptNo}}.',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'TPL_WA_RCP_PDF',
      name: 'WhatsApp E-Receipt PDF Dispatch',
      channel: 'WHATSAPP',
      eventType: 'RECEIPT_PDF_DISPATCH',
      bodyTemplate:
        'Namaste {{name}}, your official Noida Municipal Corporation receipt {{receiptNo}} for INR {{amount}} is attached.',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'TPL_SMS_REG_SUB',
      name: 'Registration Submitted Confirmation',
      channel: 'SMS',
      eventType: 'REGISTRATION_SUBMITTED',
      bodyTemplate:
        'SuvidhaPay: Registration for {{regNo}} submitted for Revenue Officer review.',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'TPL_SMS_WAIVER_APPR',
      name: 'Due Waiver / Adjustment Approved Notification',
      channel: 'SMS',
      eventType: 'WAIVER_APPROVED',
      bodyTemplate:
        'SuvidhaPay: Waiver of INR {{amount}} approved for {{regNo}} by Revenue Officer. Reference: {{refNo}}.',
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ];

  const seededVerifications: GovVerificationRecord[] = INITIAL_ENTITIES.map(
    (e, idx) => ({
      id: `VER-2026-00${idx + 1}`,
      entityId: e.id,
      registrationNumber: e.registrationNumber,
      provider: e.entityType === 'VEHICLE' ? 'VAHAN_MOCK' : 'SVANIDHI_MOCK',
      status: e.govVerificationStatus,
      referenceNumber: e.govVerificationRef || `VAHAN-REF-${idx + 1}`,
      ownerNameMatched: e.govVerificationStatus === 'VERIFIED',
      vehicleClass: e.vehicleType || e.category,
      requestedBy: 'SYSTEM_AUTO',
      requestedAt: '2026-10-08T09:00:00.000Z',
      updatedAt: '2026-10-10T05:30:00.000Z',
      notes: e.officerComments,
    })
  );

  const seededImports: ImportBatchRecord[] = [
    {
      id: 'IMP-2026-001',
      fileName: 'legacy_commercial_vehicles_sector18.csv',
      importType: 'VEHICLES',
      status: 'COMMITTED',
      totalRows: 14,
      validRowsCount: 14,
      errorRowsCount: 0,
      validStagingRecords: [
        {
          registrationNumber: 'UP-16-AB-1234',
          ownerName: 'Ramesh Chandra Yadav',
          mobile: '9811452310',
          category: 'Auto-Rickshaw (Three-Wheeler)',
          ward: 'W-12',
          initialOutstanding: 800,
        },
      ],
      rowErrors: [],
      createdBy: 'USR-ADM-01',
      createdAt: '2026-09-15T10:00:00.000Z',
      committedAt: '2026-09-15T10:12:00.000Z',
    },
    {
      id: 'IMP-2026-002',
      fileName: 'staged_tehbazari_vendors_phase2.csv',
      importType: 'VENDORS',
      status: 'STAGED',
      totalRows: 3,
      validRowsCount: 2,
      errorRowsCount: 1,
      validStagingRecords: [
        {
          registrationNumber: 'KSK-MND-01',
          name: 'Mukesh Fruit Stall',
          mobile: '9811223344',
          category: 'Stationary Kiosk / Tehbazari Vendor',
          ward: 'W-19',
          address: 'Phase 2 Mandi Gate 1',
        },
        {
          registrationNumber: 'KSK-MND-02',
          name: 'Shyam Tea Point',
          mobile: '9877665544',
          category: 'Stationary Kiosk / Tehbazari Vendor',
          ward: 'W-19',
          address: 'Phase 2 Mandi Shed 4',
        },
      ],
      rowErrors: [
        {
          rowNumber: 3,
          identifier: 'UNKNOWN-VEND',
          errorMessage: 'Invalid Indian mobile number. Must be 10 digits starting with 6-9.',
        },
      ],
      createdBy: 'USR-OFF-01',
      createdAt: '2026-10-12T14:30:00.000Z',
    },
  ];

  const settings: SystemSettingsRecord = {
    municipalityName: 'Noida Municipal Corporation',
    municipalityCode: 'NMC-UP16',
    tagline: 'Transparent Collections. Trusted Governance.',
    receiptPrefix: 'SUP/2026',
    financialYear: '2026-27',
    nextReceiptSequence: 12347,
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
    updatedAt: '2026-10-10T05:00:00.000Z',
    updatedBy: 'USR-ADM-01',
  };

  return {
    users: structuredClone(seededUsers),
    sessions: [],
    resetTokens: [],
    wards: structuredClone(INITIAL_WARDS),
    zones: structuredClone(INITIAL_ZONES),
    categories: structuredClone(INITIAL_CATEGORIES),
    rates: structuredClone(INITIAL_RATES),
    entities: structuredClone(INITIAL_ENTITIES),
    dues: structuredClone(INITIAL_DUES),
    adjustments: structuredClone(INITIAL_ADJUSTMENTS),
    payments: structuredClone(INITIAL_PAYMENTS),
    receipts: structuredClone(INITIAL_RECEIPTS),
    closings: structuredClone(INITIAL_CLOSINGS),
    reconciliations: structuredClone(INITIAL_RECONCILIATION),
    disputes: structuredClone(INITIAL_REFUNDS_DISPUTES),
    notifications: structuredClone(INITIAL_NOTIFICATIONS),
    notificationTemplates: structuredClone(seededTemplates),
    verifications: structuredClone(seededVerifications),
    auditLogs: structuredClone(INITIAL_AUDIT_LOGS),
    imports: structuredClone(seededImports),
    idempotencyKeys: [],
    settings,
  };
}

/**
 * Seeds the data store if the `users` collection is currently empty.
 * Running repeatedly does NOT duplicate records.
 */
export async function seedCollectionsIfEmpty(store: IDataStore): Promise<boolean> {
  const current = await store.readAll();
  if (current.users && current.users.length > 0) {
    return false; // Already populated, do not overwrite or duplicate
  }
  const seed = generateDeterministicSeed();
  await store.withTransaction('SEED_COLLECTIONS_IF_EMPTY', (collections) => {
    Object.assign(collections, seed);
  });
  return true;
}

/**
 * Resets the data store back to the deterministic initial state.
 * PRODUCTION SAFEGUARD: Throws an error if executed in NODE_ENV === 'production'.
 */
export async function resetDatabaseToSeed(
  store: IDataStore,
  forceReset = false
): Promise<void> {
  if (process.env.NODE_ENV === 'production' && !forceReset) {
    throw new AppError(
      403,
      'FORBIDDEN_OPERATION',
      'Database reset is strictly prohibited in production environments.'
    );
  }
  const seed = generateDeterministicSeed();
  await store.withTransaction('RESET_DATABASE_TO_SEED', (collections) => {
    Object.assign(collections, seed);
  });
}
