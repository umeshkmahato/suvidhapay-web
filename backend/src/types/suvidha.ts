export type UserRole = 'ADMIN' | 'OFFICER' | 'AGENT' | 'CITIZEN';

export type GovVerificationStatus =
  | 'NOT_REQUESTED'
  | 'PENDING'
  | 'VERIFIED'
  | 'FAILED'
  | 'NOT_FOUND'
  | 'SERVICE_UNAVAILABLE'
  | 'MANUAL_REVIEW';

export type RegistrationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'ACTIVE'
  | 'SUSPENDED';

export type DueStatus =
  | 'PENDING'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'WAIVED'
  | 'CANCELLED'
  | 'DISPUTED';

export type PaymentMethod =
  | 'CASH'
  | 'UPI_REFERENCE'
  | 'PAYMENT_GATEWAY'
  | 'BANK_TRANSFER'
  | 'OTHER';

export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'ALLOCATED'
  | 'RECEIPT_GENERATED'
  | 'NOTIFIED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'DISPUTED';

export type ReconciliationStatus =
  | 'MATCHED'
  | 'MISSING_PAYMENT'
  | 'MISSING_SETTLEMENT'
  | 'AMOUNT_MISMATCH'
  | 'DUPLICATE'
  | 'UNDER_REVIEW';

export type ClosingStatus =
  | 'OPEN'
  | 'SUBMITTED'
  | 'OFFICER_VERIFIED'
  | 'CLOSED';

export type NotificationStatus =
  | 'PENDING'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETRYING';

export type NotificationChannel = 'SMS' | 'WHATSAPP' | 'IN_APP';

export interface Ward {
  id: string;
  code: string;
  name: string;
  zoneId: string;
  zoneName: string;
  assignedOfficerId: string;
  assignedOfficerName: string;
  assignedAgentsCount: number;
  registeredEntitiesCount: number;
  outstandingDues: number;
  todayCollection: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Zone {
  id: string;
  code: string;
  name: string;
  wardsCount: number;
  totalEntities: number;
  totalOutstanding: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface EntityCategory {
  id: string;
  code: string;
  name: string;
  entityType: 'VEHICLE' | 'VENDOR';
  specificFields: string[];
  applicableFeeTypes: string[];
  activeRateId: string;
  activeRateAmount: number;
  entitiesCount: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface RateMaster {
  id: string;
  categoryId: string;
  categoryName: string;
  feeType: string;
  vehicleType?: string;
  frequency: 'DAILY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  amountInr: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  wardScope: string; // 'ALL' or Ward Code
  status: 'ACTIVE' | 'UPCOMING' | 'EXPIRED';
  createdBy: string;
  createdAt: string;
}

export interface MunicipalEntity {
  id: string;
  registrationNumber: string; // e.g., UP16AB1234 or VND-NMC-2026-0041
  normalizedIdentifier: string; // e.g., UP16AB1234
  entityType: 'VEHICLE' | 'VENDOR';
  name: string; // Owner or Vendor Name
  mobile: string;
  address: string;
  category: string;
  categoryId: string;
  vehicleType?: string;
  stallLocation?: string;
  wardId: string;
  wardName: string;
  zoneName: string;
  registrationDate: string;
  previousOutstanding: number;
  newCharges: number;
  adjustmentsTotal: number;
  waiversTotal: number;
  paidAllocated: number;
  outstandingAmount: number;
  registrationStatus: RegistrationStatus;
  govVerificationStatus: GovVerificationStatus;
  govVerificationRef?: string;
  govLastChecked?: string;
  officerComments?: string;
  rejectionReason?: string;
}

export interface DueAdjustment {
  id: string;
  dueId: string;
  entityId: string;
  entityName: string;
  type: 'ADJUSTMENT' | 'WAIVER';
  amountInr: number;
  beforeBalance: number;
  afterBalance: number;
  reason: string;
  supportingRef: string;
  requestedBy: string;
  requestedAt: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface DueRecord {
  id: string;
  entityId: string;
  entityName: string;
  registrationNumber: string;
  categoryName: string;
  wardName: string;
  rateId: string;
  feeType: string;
  periodStart: string;
  periodEnd: string;
  originalAmount: number;
  adjustmentsAmount: number;
  waiversAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  status: DueStatus;
  generationDate: string;
}

export interface PaymentAllocationItem {
  dueId: string;
  periodLabel: string;
  feeType: string;
  dueOriginalAmount: number;
  allocatedAmount: number;
  remainingDueBalance: number;
}

export interface PaymentRecord {
  id: string;
  orderId?: string;
  entityId: string;
  entityName: string;
  registrationNumber: string;
  wardName: string;
  categoryName: string;
  amountInr: number;
  method: PaymentMethod;
  referenceNumber: string;
  processingStatus: PaymentStatus;
  settlementStatus: 'SETTLED' | 'PENDING_SETTLEMENT' | 'UNVERIFIED_MANUAL_REF' | 'PROVISIONAL_OFFLINE' | 'REVERSED';
  receiptId?: string;
  receiptNumber?: string;
  collectedBy: string;
  collectedByRole: UserRole;
  timestamp: string;
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
  allocations: PaymentAllocationItem[];
}

export interface ReceiptRecord {
  id: string;
  receiptNumber: string; // e.g., SUP/2026/000012345
  paymentId: string;
  entityId: string;
  entityName: string;
  registrationNumber: string;
  categoryName: string;
  wardName: string;
  dateTime: string;
  previousOutstanding: number;
  currentPayment: number;
  allocatedAmount: number;
  remainingOutstanding: number;
  paymentMethod: PaymentMethod;
  transactionReference: string;
  agentName: string;
  agentId: string;
  verificationCode: string;
  status: 'VALID' | 'PROVISIONAL_OFFLINE' | 'PENDING_UPI_VERIFICATION' | 'CANCELLED' | 'REVERSED';
}

export interface DailyClosingRecord {
  id: string;
  agentId: string;
  agentName: string;
  wardName: string;
  date: string;
  expectedCash: number;
  actualCashCount: number;
  cashVariance: number;
  verifiedDigitalTotal: number;
  pendingManualUpiCount: number;
  pendingManualUpiTotal: number;
  receiptsCount: number;
  cancelledCount: number;
  status: ClosingStatus;
  submittedAt: string;
  discrepancyNote?: string;
  verifyingOfficer?: string;
  officerComments?: string;
  verifiedAt?: string;
}

export interface ReconciliationItem {
  id: string;
  gatewayProvider: 'RAZORPAY' | 'CASHFREE';
  gatewayOrderId: string;
  gatewayTxnId: string;
  suvidhaPaymentId: string;
  entityName: string;
  registrationNumber: string;
  gatewayAmount: number;
  ledgerAmount: number;
  differenceAmount: number;
  txnDate: string;
  settlementDate: string;
  status: ReconciliationStatus;
  assignedReviewer: string;
  reviewNotes: string;
}

export interface RefundDisputeRecord {
  id: string;
  recordType: 'REFUND' | 'REVERSAL' | 'DISPUTE';
  paymentId: string;
  receiptNumber: string;
  entityId: string;
  entityName: string;
  registrationNumber: string;
  amountInr: number;
  reasonCode: string;
  description: string;
  requestedBy: string;
  requestedAt: string;
  status: 'OPEN' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'RESOLVED';
  resolutionNotes?: string;
  reviewedBy?: string;
}

export interface SystemUser {
  id: string;
  fullName: string;
  loginIdentifier: string;
  mobile: string;
  email: string;
  role: UserRole;
  assignedWard: string;
  assignedZone: string;
  status: 'ACTIVE' | 'DISABLED' | 'LOCKED';
  createdDate: string;
  lastLogin: string;
  todayCashCollected?: number;
  todayDigitalCollected?: number;
  receiptCount?: number;
  closingStatus?: ClosingStatus;
  reconciliationVariance?: number;
}

export interface NotificationLog {
  id: string;
  timestamp: string;
  recipientName: string;
  recipientMobile: string;
  channel: NotificationChannel;
  eventType: string;
  templateId: string;
  status: NotificationStatus;
  retryCount: number;
  failureReason?: string;
  correlationId: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole | 'SYSTEM_WEBHOOK';
  action: string;
  module: string;
  entityType: string;
  entityId: string;
  previousValueSummary: string;
  newValueSummary: string;
  ipAddress: string;
  correlationId: string;
}

export interface TraceabilityRequirement {
  reqId: string;
  sourceSection: string;
  phase: string;
  module: string;
  feature: string;
  subFeature: string;
  userRole: UserRole | 'ALL';
  screen: string;
  interaction: string;
  stateCoverage: string;
  designStatus: 'COMPLETE' | 'VERIFIED';
  openQuestion: string;
  targetRoleShell: UserRole;
  targetModuleKey: string;
}
