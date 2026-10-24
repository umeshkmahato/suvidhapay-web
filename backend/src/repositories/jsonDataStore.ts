import fs from 'fs';
import path from 'path';
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
} from '../data/mockSuvidhaData';
import { hashPassword, AppError } from '../infra/core';
import {
  IDataStore,
  SuvidhaDataCollections,
  BackendUserRecord,
  NotificationTemplateRecord,
  GovVerificationRecord,
  SystemSettingsRecord,
} from './interfaces';

/**
 * Deterministic Seed Builder (Section 4 & 11)
 * Passwords are hashed with scrypt. Never stored in plaintext.
 * Demo credentials (development only):
 * - Admin: loginIdentifier "admin.kulkarni", password "Suvidha@Admin2026"
 * - Officer 1 (Zone 2: W-12, W-14): loginIdentifier "ro.rajeshwari", password "Suvidha@Officer2026"
 * - Officer 2 (Zone 1 & 3: W-04, W-19): loginIdentifier "aro.arvind", password "Suvidha@Officer2026"
 * - Agent 1 (Ward W-12): loginIdentifier "AG-104", password "Suvidha@Agent2026"
 * - Agent 2 (Ward W-14): loginIdentifier "AG-108", password "Suvidha@Agent2026"
 * - Disabled Agent (Ward W-04): loginIdentifier "AG-112", password "Suvidha@Agent2026"
 * - Citizen (Linked ENT-1001, ENT-1002): loginIdentifier "9811452310", password "Suvidha@Citizen2026"
 */
export function buildDeterministicSeed(): SuvidhaDataCollections {
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

  // Add deterministic Citizen demo user
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
    imports: [],
    idempotencyKeys: [],
    settings,
  };
}

const DOMAIN_FILES: Array<keyof SuvidhaDataCollections> = [
  'users',
  'sessions',
  'resetTokens',
  'wards',
  'zones',
  'categories',
  'rates',
  'entities',
  'dues',
  'adjustments',
  'payments',
  'receipts',
  'closings',
  'reconciliations',
  'disputes',
  'notifications',
  'notificationTemplates',
  'verifications',
  'auditLogs',
  'imports',
  'idempotencyKeys',
  'settings',
];

/**
 * Persistent File-Backed JSON Repository with In-Process Mutex & Atomic Writes (Section 4)
 * DEVELOPMENT ONLY: Serializes writes within a single Node.js process and uses atomic
 * temp-file rename (`<domain>.json.tmp` -> `<domain>.json`).
 * Not a replacement for PostgreSQL ACID transactions in multi-node production.
 */
export class JsonFileDataStore implements IDataStore {
  private readonly dataDir: string;
  private writeLock: Promise<void> = Promise.resolve();

  constructor(dataDir: string) {
    this.dataDir = path.resolve(dataDir);
  }

  public getDataDir(): string {
    return this.dataDir;
  }

  private getFilePath(domain: keyof SuvidhaDataCollections): string {
    return path.join(this.dataDir, `${domain}.json`);
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  public async seedIfEmpty(): Promise<void> {
    this.ensureDir();
    const settingsPath = this.getFilePath('settings');
    if (!fs.existsSync(settingsPath)) {
      await this.resetToDeterministicSeed();
    }
  }

  public async resetToDeterministicSeed(): Promise<void> {
    this.ensureDir();
    const seed = buildDeterministicSeed();
    await this.writeAllInternal(seed);
  }

  private async writeAllInternal(data: SuvidhaDataCollections): Promise<void> {
    this.ensureDir();
    for (const domain of DOMAIN_FILES) {
      const targetPath = this.getFilePath(domain);
      const tempPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
      const payload = JSON.stringify(data[domain], null, 2);
      await fs.promises.writeFile(tempPath, payload, 'utf8');
      await fs.promises.rename(tempPath, targetPath);
    }
  }

  public async readAll(): Promise<SuvidhaDataCollections> {
    await this.seedIfEmpty();
    const result: Partial<SuvidhaDataCollections> = {};
    for (const domain of DOMAIN_FILES) {
      const filePath = this.getFilePath(domain);
      try {
        const raw = await fs.promises.readFile(filePath, 'utf8');
        result[domain] = JSON.parse(raw);
      } catch (err) {
        throw new AppError(
          500,
          'STORAGE_READ_ERROR',
          `Failed to read or parse domain storage file ${domain}.json`,
          [(err as Error).message]
        );
      }
    }
    return result as SuvidhaDataCollections;
  }

  public async withTransaction<R>(
    _operationName: string,
    fn: (collections: SuvidhaDataCollections) => Promise<R> | R
  ): Promise<R> {
    let release: () => void = () => {};
    const previousLock = this.writeLock;
    this.writeLock = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previousLock;
    try {
      const snapshot = await this.readAll();
      const outcome = await fn(snapshot);
      await this.writeAllInternal(snapshot);
      return outcome;
    } finally {
      release();
    }
  }
}
