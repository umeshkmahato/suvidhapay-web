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

// ============================================================================
// DOMAIN REPOSITORY INTERFACES (Database-Agnostic, Section 4 & Phase 2)
// Designed for transparent future PostgreSQL migration without service rewrites.
// ============================================================================

export interface IUserRepository {
  findById(id: string): Promise<BackendUserRecord | null>;
  findByLoginIdentifier(identifier: string): Promise<BackendUserRecord | null>;
  findByMobile(mobile: string): Promise<BackendUserRecord | null>;
  list(filter?: { role?: UserRole; ward?: string; status?: string }): Promise<BackendUserRecord[]>;
  create(user: BackendUserRecord): Promise<BackendUserRecord>;
  update(id: string, updates: Partial<BackendUserRecord>): Promise<BackendUserRecord>;
  count(filter?: Partial<BackendUserRecord>): Promise<number>;
}

export interface IEntityRepository {
  findById(id: string): Promise<MunicipalEntity | null>;
  findByNormalizedIdentifier(normalizedId: string): Promise<MunicipalEntity | null>;
  findByRegistrationNumber(regNo: string): Promise<MunicipalEntity | null>;
  list(filter?: {
    q?: string;
    entityType?: string;
    wardId?: string;
    categoryId?: string;
    status?: string;
    mobile?: string;
  }): Promise<MunicipalEntity[]>;
  create(entity: MunicipalEntity): Promise<MunicipalEntity>;
  update(id: string, updates: Partial<MunicipalEntity>): Promise<MunicipalEntity>;
  count(filter?: Partial<MunicipalEntity>): Promise<number>;
}

export interface IDueRepository {
  findById(id: string): Promise<DueRecord | null>;
  findByEntityId(entityId: string): Promise<DueRecord[]>;
  list(filter?: { entityId?: string; wardId?: string; status?: string; rateId?: string }): Promise<DueRecord[]>;
  create(due: DueRecord): Promise<DueRecord>;
  createMany(dues: DueRecord[]): Promise<DueRecord[]>;
  update(id: string, updates: Partial<DueRecord>): Promise<DueRecord>;
  updateMany(dues: DueRecord[]): Promise<void>;
}

export interface IPaymentRepository {
  findById(id: string): Promise<PaymentRecord | null>;
  findByReceiptId(receiptId: string): Promise<PaymentRecord | null>;
  findByEntityId(entityId: string): Promise<PaymentRecord[]>;
  list(filter?: {
    entityId?: string;
    method?: string;
    settlementStatus?: string;
    collectedBy?: string;
    date?: string;
  }): Promise<PaymentRecord[]>;
  create(payment: PaymentRecord): Promise<PaymentRecord>;
  update(id: string, updates: Partial<PaymentRecord>): Promise<PaymentRecord>;
}

export interface IReceiptRepository {
  findById(id: string): Promise<ReceiptRecord | null>;
  findByReceiptNumber(receiptNumber: string): Promise<ReceiptRecord | null>;
  findByVerificationCode(code: string): Promise<ReceiptRecord | null>;
  findByPaymentId(paymentId: string): Promise<ReceiptRecord | null>;
  list(filter?: { entityId?: string; date?: string; wardName?: string }): Promise<ReceiptRecord[]>;
  create(receipt: ReceiptRecord): Promise<ReceiptRecord>;
}

export interface IRateRepository {
  findById(id: string): Promise<RateMaster | null>;
  findActiveForCategory(categoryId: string, wardScope?: string): Promise<RateMaster | null>;
  list(filter?: { categoryId?: string; status?: string; wardScope?: string }): Promise<RateMaster[]>;
  create(rate: RateMaster): Promise<RateMaster>;
  update(id: string, updates: Partial<RateMaster>): Promise<RateMaster>;
}

export interface IWardRepository {
  findById(id: string): Promise<Ward | null>;
  findByCode(code: string): Promise<Ward | null>;
  list(filter?: { zoneId?: string; status?: string }): Promise<Ward[]>;
  create(ward: Ward): Promise<Ward>;
  update(id: string, updates: Partial<Ward>): Promise<Ward>;
}

export interface IZoneRepository {
  findById(id: string): Promise<Zone | null>;
  findByCode(code: string): Promise<Zone | null>;
  list(filter?: { status?: string }): Promise<Zone[]>;
  create(zone: Zone): Promise<Zone>;
  update(id: string, updates: Partial<Zone>): Promise<Zone>;
}

export interface IClosingRepository {
  findById(id: string): Promise<DailyClosingRecord | null>;
  findByAgentAndDate(agentId: string, date: string): Promise<DailyClosingRecord | null>;
  list(filter?: { agentId?: string; date?: string; status?: string; wardCode?: string }): Promise<DailyClosingRecord[]>;
  create(closing: DailyClosingRecord): Promise<DailyClosingRecord>;
  update(id: string, updates: Partial<DailyClosingRecord>): Promise<DailyClosingRecord>;
}

export interface IReconciliationRepository {
  findById(id: string): Promise<ReconciliationItem | null>;
  findByGatewayOrderId(orderId: string): Promise<ReconciliationItem | null>;
  list(filter?: { status?: string; gateway?: string }): Promise<ReconciliationItem[]>;
  create(item: ReconciliationItem): Promise<ReconciliationItem>;
  update(id: string, updates: Partial<ReconciliationItem>): Promise<ReconciliationItem>;
}

export interface IDisputeRepository {
  findById(id: string): Promise<RefundDisputeRecord | null>;
  findByPaymentId(paymentId: string): Promise<RefundDisputeRecord | null>;
  list(filter?: { status?: string; entityId?: string }): Promise<RefundDisputeRecord[]>;
  create(dispute: RefundDisputeRecord): Promise<RefundDisputeRecord>;
  update(id: string, updates: Partial<RefundDisputeRecord>): Promise<RefundDisputeRecord>;
}

export interface IAuditLogRepository {
  create(entry: AuditLogEntry): Promise<AuditLogEntry>;
  list(filter?: {
    entityId?: string;
    entityType?: string;
    actorRole?: string;
    correlationId?: string;
    module?: string;
  }): Promise<AuditLogEntry[]>;
}

export interface INotificationRepository {
  create(notification: NotificationLog): Promise<NotificationLog>;
  list(filter?: { status?: string; recipientMobile?: string; channel?: string }): Promise<NotificationLog[]>;
  update(id: string, updates: Partial<NotificationLog>): Promise<NotificationLog>;
}

export interface ISettingsRepository {
  get(): Promise<SystemSettingsRecord>;
  update(updates: Partial<SystemSettingsRecord>): Promise<SystemSettingsRecord>;
}

export interface IVerificationRepository {
  findById(id: string): Promise<GovVerificationRecord | null>;
  findByRegistrationNumber(regNo: string): Promise<GovVerificationRecord | null>;
  findByEntityId(entityId: string): Promise<GovVerificationRecord | null>;
  list(filter?: { status?: string; provider?: string }): Promise<GovVerificationRecord[]>;
  create(record: GovVerificationRecord): Promise<GovVerificationRecord>;
  update(id: string, updates: Partial<GovVerificationRecord>): Promise<GovVerificationRecord>;
}

export interface IImportRepository {
  findById(id: string): Promise<ImportBatchRecord | null>;
  list(filter?: { status?: string; importType?: string }): Promise<ImportBatchRecord[]>;
  create(record: ImportBatchRecord): Promise<ImportBatchRecord>;
  update(id: string, updates: Partial<ImportBatchRecord>): Promise<ImportBatchRecord>;
}

/**
 * Repository & Unit-of-Work Abstraction (Section 3, 4, 15)
 * Designed so LokiJS repositories can be swapped for PostgreSQL transactional repositories
 * without modifying any controller or service signature.
 */
export interface IDataStore {
  getDataDir(): string;
  getDbFilePath?(): string;
  readAll(): Promise<SuvidhaDataCollections>;
  /**
   * Executes a serialized read-modify-write unit of work.
   * NOTE: In LokiJS development mode, this uses an in-process mutex and atomic disk save.
   * In PostgreSQL mode, this maps to `BEGIN ... COMMIT / ROLLBACK`.
   */
  withTransaction<R>(
    operationName: string,
    fn: (collections: SuvidhaDataCollections) => Promise<R> | R
  ): Promise<R>;
  seedIfEmpty(): Promise<void>;
  resetToDeterministicSeed(): Promise<void>;
  close?(): Promise<void>;
}
