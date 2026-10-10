import {
  UserRole,
  Ward,
  Zone,
  EntityCategory,
  RateMaster,
  MunicipalEntity,
  DueRecord,
  DueAdjustment,
  PaymentRecord,
  ReceiptRecord,
  DailyClosingRecord,
  ReconciliationItem,
  RefundDisputeRecord,
  SystemUser,
  NotificationLog,
  AuditLogEntry,
  GovVerificationStatus,
} from '../../types/suvidha';

export interface BackendUserRecord extends SystemUser {
  passwordHash: string;
  forcePasswordChange: boolean;
  linkedEntityIds: string[];
  failedLoginAttempts: number;
  lockedUntil?: string | null;
}

export interface RefreshSessionRecord {
  jti: string;
  userId: string;
  loginIdentifier: string;
  role: UserRole;
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  replacedByJti?: string | null;
  ipAddress: string;
  userAgent: string;
}

export interface PasswordResetTokenRecord {
  token: string;
  userId: string;
  expiresAt: string;
  usedAt?: string | null;
}

export interface IdempotencyRecord {
  key: string;
  endpoint: string;
  actorId: string;
  statusCode: number;
  responseBody: unknown;
  createdAt: string;
}

export interface NotificationTemplateRecord {
  id: string;
  name: string;
  channel: 'SMS' | 'WHATSAPP' | 'IN_APP';
  eventType: string;
  bodyTemplate: string;
  active: boolean;
  createdAt: string;
}

export interface GovVerificationRecord {
  id: string;
  entityId: string;
  registrationNumber: string;
  provider: 'VAHAN_MOCK' | 'SVANIDHI_MOCK';
  status: GovVerificationStatus;
  referenceNumber: string;
  ownerNameMatched: boolean;
  vehicleClass?: string;
  requestedBy: string;
  requestedAt: string;
  updatedAt: string;
  notes?: string;
}

export interface ImportBatchRecord {
  id: string;
  fileName: string;
  importType: 'VEHICLES' | 'VENDORS' | 'LEGACY_DUES';
  status: 'STAGED' | 'COMMITTED' | 'REJECTED';
  totalRows: number;
  validRowsCount: number;
  errorRowsCount: number;
  validStagingRecords: Array<Record<string, unknown>>;
  rowErrors: Array<{ rowNumber: number; identifier: string; errorMessage: string }>;
  createdBy: string;
  createdAt: string;
  committedAt?: string;
}

export interface SystemSettingsRecord {
  municipalityName: string;
  municipalityCode: string;
  tagline: string;
  receiptPrefix: string;
  financialYear: string;
  nextReceiptSequence: number;
  timezone: string;
  currency: 'INR';
  allowAdvanceOverpayment: boolean;
  requireOfficerApprovalForRegistrations: boolean;
  requireAdminApprovalForWaivers: boolean;
  paymentGatewayProvider: 'RAZORPAY_MOCK' | 'CASHFREE_MOCK';
  paymentGatewayStatus: 'ACTIVE' | 'MAINTENANCE';
  smsProviderStatus: 'ACTIVE' | 'DEGRADED';
  whatsappProviderStatus: 'ACTIVE' | 'DEGRADED';
  govVerificationProviderStatus: 'ACTIVE' | 'INTERMITTENT';
  updatedAt: string;
  updatedBy: string;
}

export interface SuvidhaDataCollections {
  users: BackendUserRecord[];
  sessions: RefreshSessionRecord[];
  resetTokens: PasswordResetTokenRecord[];
  wards: Ward[];
  zones: Zone[];
  categories: EntityCategory[];
  rates: RateMaster[];
  entities: MunicipalEntity[];
  dues: DueRecord[];
  adjustments: DueAdjustment[];
  payments: PaymentRecord[];
  receipts: ReceiptRecord[];
  closings: DailyClosingRecord[];
  reconciliations: ReconciliationItem[];
  disputes: RefundDisputeRecord[];
  notifications: NotificationLog[];
  notificationTemplates: NotificationTemplateRecord[];
  verifications: GovVerificationRecord[];
  auditLogs: AuditLogEntry[];
  imports: ImportBatchRecord[];
  idempotencyKeys: IdempotencyRecord[];
  settings: SystemSettingsRecord;
}

/**
 * Repository & Unit-of-Work Abstraction (Section 3, 4, 15)
 * Designed so JSON file repositories can be swapped for PostgreSQL transactional repositories
 * without modifying any controller or service signature.
 */
export interface IDataStore {
  getDataDir(): string;
  readAll(): Promise<SuvidhaDataCollections>;
  /**
   * Executes a serialized read-modify-write unit of work.
   * NOTE: In JSON development mode, this uses an in-process mutex and atomic temp-file rename.
   * In PostgreSQL mode, this maps to `BEGIN ... COMMIT / ROLLBACK`.
   */
  withTransaction<R>(
    operationName: string,
    fn: (collections: SuvidhaDataCollections) => Promise<R> | R
  ): Promise<R>;
  seedIfEmpty(): Promise<void>;
  resetToDeterministicSeed(): Promise<void>;
}
