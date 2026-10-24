import crypto from 'crypto';
import { AppError, JwtClaims, Money, loadConfig } from '../infra/core';
import {
  IDataStore,
  SuvidhaDataCollections,
} from '../repositories/interfaces';
import {
  IPaymentGatewayAdapter,
  INotificationAdapter,
} from '../adapters/mockAdapters';
import {
  hasWardJurisdiction,
  assertCitizenEntityOwnership,
} from '../middleware/authMiddleware';
import { appendAudit } from './authAndUsersService';
import {
  PaymentRecord,
  PaymentAllocationItem,
  ReceiptRecord,
  DueRecord,
} from '../types/suvidha';

export class PaymentsReceiptsService {
  constructor(
    private readonly store: IDataStore,
    private readonly gatewayAdapter: IPaymentGatewayAdapter,
    private readonly notificationAdapter: INotificationAdapter
  ) {}

  private computeEntityTotalOutstandingPaise(
    db: SuvidhaDataCollections,
    entityId: string
  ): { totalPaise: number; openDues: DueRecord[] } {
    const openDues = db.dues.filter(
      (d) =>
        d.entityId === entityId &&
        d.outstandingAmount > 0 &&
        d.status !== 'CANCELLED' &&
        d.status !== 'WAIVED'
    );
    const totalPaise = openDues.reduce(
      (sum, d) => sum + Money.inrToPaise(d.outstandingAmount),
      0
    );
    return { totalPaise, openDues };
  }

  private allocateAcrossDues(
    openDues: DueRecord[],
    paymentAmountInr: number,
    explicitAllocations?: Array<{ dueId: string; allocatedAmount: number }>,
    applyToDues = true
  ): PaymentAllocationItem[] {
    const paymentPaise = Money.inrToPaise(paymentAmountInr);

    if (explicitAllocations && explicitAllocations.length > 0) {
      const explicitSumPaise = explicitAllocations.reduce(
        (s, a) => s + Money.inrToPaise(a.allocatedAmount),
        0
      );
      if (explicitSumPaise !== paymentPaise) {
        throw new AppError(
          400,
          'INVALID_ALLOCATION_SUM',
          `Sum of explicit allocations (INR ${Money.paiseToInr(
            explicitSumPaise
          )}) does not equal payment amount (INR ${paymentAmountInr})`
        );
      }

      const items: PaymentAllocationItem[] = [];
      for (const reqAlloc of explicitAllocations) {
        const due = openDues.find((d) => d.id === reqAlloc.dueId);
        if (!due) {
          throw new AppError(
            400,
            'INVALID_ALLOCATION_DUE',
            `Due ${reqAlloc.dueId} is not an active open due for this entity`
          );
        }
        const allocPaise = Money.inrToPaise(reqAlloc.allocatedAmount);
        const dueOutPaise = Money.inrToPaise(due.outstandingAmount);
        if (allocPaise > dueOutPaise) {
          throw new AppError(
            400,
            'DUE_OVER_ALLOCATION',
            `Allocated amount INR ${reqAlloc.allocatedAmount} exceeds due ${due.id} remaining balance INR ${due.outstandingAmount}`
          );
        }

        const newDueOutInr = Money.paiseToInr(dueOutPaise - allocPaise);
        if (applyToDues) {
          due.paidAmount = Money.addInr(due.paidAmount, reqAlloc.allocatedAmount);
          due.outstandingAmount = newDueOutInr;
          due.status = newDueOutInr === 0 ? 'PAID' : 'PARTIALLY_PAID';
        }

        items.push({
          dueId: due.id,
          periodLabel: `${due.periodStart} - ${due.periodEnd}`,
          feeType: due.feeType,
          dueOriginalAmount: due.originalAmount,
          allocatedAmount: reqAlloc.allocatedAmount,
          remainingDueBalance: applyToDues ? newDueOutInr : due.outstandingAmount,
        });
      }
      return items;
    }

    // FIFO allocation across oldest open dues
    let remainingToAllocatePaise = paymentPaise;
    const items: PaymentAllocationItem[] = [];

    for (const due of openDues) {
      if (remainingToAllocatePaise <= 0) break;
      const dueOutPaise = Money.inrToPaise(due.outstandingAmount);
      const allocPaise = Math.min(remainingToAllocatePaise, dueOutPaise);
      const allocInr = Money.paiseToInr(allocPaise);
      const newDueOutInr = Money.paiseToInr(dueOutPaise - allocPaise);

      if (applyToDues) {
        due.paidAmount = Money.addInr(due.paidAmount, allocInr);
        due.outstandingAmount = newDueOutInr;
        due.status = newDueOutInr === 0 ? 'PAID' : 'PARTIALLY_PAID';
      }

      items.push({
        dueId: due.id,
        periodLabel: `${due.periodStart} - ${due.periodEnd}`,
        feeType: due.feeType,
        dueOriginalAmount: due.originalAmount,
        allocatedAmount: allocInr,
        remainingDueBalance: applyToDues ? newDueOutInr : due.outstandingAmount,
      });

      remainingToAllocatePaise -= allocPaise;
    }

    return items;
  }

  private generateAuthoritativeReceiptNumber(db: SuvidhaDataCollections): string {
    const seq = db.settings.nextReceiptSequence || 12347;
    db.settings.nextReceiptSequence = seq + 1;
    const prefix = db.settings.receiptPrefix || 'SUP/2026';
    return `${prefix}/${String(seq).padStart(9, '0')}`;
  }

  public async recordCashPayment(
    actor: JwtClaims,
    payload: {
      entityId: string;
      amountInr: number;
      dueIds?: string[];
      allocations?: Array<{ dueId: string; allocatedAmount: number }>;
      referenceNumber?: string;
      notes?: string;
      idempotencyKey?: string;
    },
    correlationId: string
  ): Promise<{
    payment: PaymentRecord;
    receipt: ReceiptRecord;
    idempotentReplay: boolean;
  }> {
    return this.store.withTransaction('CASH_PAYMENT', async (db) => {
      if (payload.idempotencyKey) {
        const existingIdem = db.idempotencyKeys.find(
          (k) =>
            k.key === payload.idempotencyKey &&
            k.endpoint === 'POST /payments/cash'
        );
        if (existingIdem) {
          if (existingIdem.actorId !== actor.sub) {
            throw new AppError(409, 'IDEMPOTENCY_KEY_CONFLICT', 'Idempotency key is already in use');
          }
          const cached = existingIdem.responseBody as {
            payment: PaymentRecord;
            receipt: ReceiptRecord;
          };
          return { ...cached, idempotentReplay: true };
        }
      }

      const entity = db.entities.find((e) => e.id === payload.entityId);
      if (!entity) {
        throw new AppError(
          404,
          'ENTITY_NOT_FOUND',
          `Entity ${payload.entityId} was not found`
        );
      }

      if (!hasWardJurisdiction(actor, entity.wardId, db.wards)) {
        throw new AppError(
          403,
          'JURISDICTION_FORBIDDEN',
          `Agent/Officer ${actor.loginIdentifier} is not assigned to Ward ${entity.wardId}`
        );
      }

      const { totalPaise, openDues } = this.computeEntityTotalOutstandingPaise(
        db,
        entity.id
      );
      const amountPaise = Money.inrToPaise(payload.amountInr);

      if (
        !db.settings.allowAdvanceOverpayment &&
        amountPaise > totalPaise
      ) {
        throw new AppError(
          400,
          'OVERPAYMENT_NOT_ALLOWED',
          `Payment amount (INR ${payload.amountInr}) exceeds authoritative outstanding balance (INR ${Money.paiseToInr(
            totalPaise
          )}). Overpayment is disabled by municipal policy.`
        );
      }

      const refNo =
        payload.referenceNumber ||
        `CASH-${actor.loginIdentifier}-${Date.now().toString().slice(-6)}`;
      const duplicateRef = db.payments.find(
        (p) => p.referenceNumber === refNo
      );
      if (duplicateRef) {
        throw new AppError(
          409,
          'DUPLICATE_PAYMENT_REFERENCE',
          `Payment reference ${refNo} already exists`
        );
      }

      const prevOutstandingInr = Money.paiseToInr(totalPaise);
      const allocations = this.allocateAcrossDues(
        openDues,
        payload.amountInr,
        payload.allocations,
        true
      );
      const newOutstandingInr = Money.paiseToInr(totalPaise - amountPaise);

      entity.paidAllocated = Money.addInr(
        entity.paidAllocated,
        payload.amountInr
      );
      entity.outstandingAmount = newOutstandingInr;

      const receiptNumber = this.generateAuthoritativeReceiptNumber(db);
      const paymentId = `PAY-2026-${9085 + db.payments.length + 1}`;
      const receiptId = `RCP-${100 + db.receipts.length + 1}`;
      const nowIso = new Date().toISOString();

      const payment: PaymentRecord = {
        id: paymentId,
        entityId: entity.id,
        entityName: entity.name,
        registrationNumber: entity.registrationNumber,
        wardName: entity.wardName,
        categoryName: entity.category,
        amountInr: payload.amountInr,
        method: 'CASH',
        referenceNumber: refNo,
        processingStatus: 'RECEIPT_GENERATED',
        settlementStatus: 'SETTLED',
        receiptId,
        receiptNumber,
        collectedBy: actor.loginIdentifier,
        collectedByRole: actor.role,
        timestamp: nowIso,
        verifiedBy: 'Server Ledger Engine',
        verifiedAt: nowIso,
        notes: payload.notes || 'Authorized field cash collection',
        allocations,
      };

      const receipt: ReceiptRecord = {
        id: receiptId,
        receiptNumber,
        paymentId,
        entityId: entity.id,
        entityName: entity.name,
        registrationNumber: entity.registrationNumber,
        categoryName: entity.category,
        wardName: entity.wardName,
        dateTime: nowIso,
        previousOutstanding: prevOutstandingInr,
        currentPayment: payload.amountInr,
        allocatedAmount: payload.amountInr,
        remainingOutstanding: newOutstandingInr,
        paymentMethod: 'CASH',
        transactionReference: refNo,
        agentName: actor.loginIdentifier,
        agentId: actor.sub,
        verificationCode: `VRF-${crypto.randomBytes(3).toString('hex').toUpperCase()}-SUP26`,
        status: 'VALID',
      };

      db.payments.unshift(payment);
      db.receipts.unshift(receipt);

      appendAudit(db, {
        actorName: actor.loginIdentifier,
        actorRole: actor.role,
        action: 'AGENTCREATEDCASH_PAYMENT',
        module: 'FIELD_COLLECTIONS',
        entityType: 'PAYMENT',
        entityId: payment.id,
        previousValueSummary: `Entity ${entity.registrationNumber} Due: INR ${prevOutstandingInr}`,
        newValueSummary: `Paid INR ${payload.amountInr} (CASH) -> Receipt ${receiptNumber}, New Bal: INR ${newOutstandingInr}`,
        correlationId,
      });

      if (payload.idempotencyKey) {
        db.idempotencyKeys.push({
          key: payload.idempotencyKey,
          endpoint: 'POST /payments/cash',
          actorId: actor.sub,
          statusCode: 201,
          responseBody: { payment, receipt },
          createdAt: nowIso,
        });
      }

      return { payment, receipt, idempotentReplay: false };
    });
  }

  /**
   * Manual UPI Reference Collection (Module E & F Critical Invariant)
   * A manually entered UPI UTR MUST NOT mark the payment as verified or issue a final receipt
   * until an Officer or Admin explicitly verifies the bank/gateway UTR.
   */
  public async recordManualUpiPayment(
    actor: JwtClaims,
    payload: {
      entityId: string;
      amountInr: number;
      referenceNumber: string;
      dueIds?: string[];
      notes?: string;
      idempotencyKey?: string;
    },
    correlationId: string
  ): Promise<{ payment: PaymentRecord; idempotentReplay: boolean }> {
    return this.store.withTransaction('MANUAL_UPI_PAYMENT', (db) => {
      if (payload.idempotencyKey) {
        const existing = db.idempotencyKeys.find(
          (k) =>
            k.key === payload.idempotencyKey &&
            k.endpoint === 'POST /payments/manual-upi'
        );
        if (existing) {
          if (existing.actorId !== actor.sub) {
            throw new AppError(409, 'IDEMPOTENCY_KEY_CONFLICT', 'Idempotency key is already in use');
          }
          return {
            payment: (existing.responseBody as { payment: PaymentRecord }).payment,
            idempotentReplay: true,
          };
        }
      }

      const entity = db.entities.find((e) => e.id === payload.entityId);
      if (!entity) {
        throw new AppError(
          404,
          'ENTITY_NOT_FOUND',
          `Entity ${payload.entityId} was not found`
        );
      }

      if (!hasWardJurisdiction(actor, entity.wardId, db.wards)) {
        throw new AppError(
          403,
          'JURISDICTION_FORBIDDEN',
          `Agent ${actor.loginIdentifier} does not have jurisdiction over Ward ${entity.wardId}`
        );
      }

      const duplicateUtr = db.payments.find(
        (p) =>
          p.referenceNumber.toLowerCase() ===
          payload.referenceNumber.trim().toLowerCase()
      );
      if (duplicateUtr) {
        throw new AppError(
          409,
          'DUPLICATE_UTR_REFERENCE',
          `UPI reference ${payload.referenceNumber} has already been submitted under payment ${duplicateUtr.id}`
        );
      }

      const { totalPaise, openDues } = this.computeEntityTotalOutstandingPaise(
        db,
        entity.id
      );
      const amountPaise = Money.inrToPaise(payload.amountInr);
      if (!db.settings.allowAdvanceOverpayment && amountPaise > totalPaise) {
        throw new AppError(
          400,
          'OVERPAYMENT_NOT_ALLOWED',
          `Manual UPI amount (INR ${payload.amountInr}) exceeds outstanding balance (INR ${Money.paiseToInr(
            totalPaise
          )})`
        );
      }

      // Compute preview allocations WITHOUT mutating due balances yet!
      const previewAllocations = this.allocateAcrossDues(
        openDues,
        payload.amountInr,
        undefined,
        false
      );

      const nowIso = new Date().toISOString();
      const payment: PaymentRecord = {
        id: `PAY-2026-${9085 + db.payments.length + 1}`,
        entityId: entity.id,
        entityName: entity.name,
        registrationNumber: entity.registrationNumber,
        wardName: entity.wardName,
        categoryName: entity.category,
        amountInr: payload.amountInr,
        method: 'UPI_REFERENCE',
        referenceNumber: payload.referenceNumber.trim().toUpperCase(),
        processingStatus: 'PENDING',
        settlementStatus: 'UNVERIFIED_MANUAL_REF',
        collectedBy: actor.loginIdentifier,
        collectedByRole: actor.role,
        timestamp: nowIso,
        notes:
          payload.notes ||
          'Manual UPI UTR submitted; awaiting Officer verification before marking PAID or generating final receipt.',
        allocations: previewAllocations,
      };

      db.payments.unshift(payment);

      appendAudit(db, {
        actorName: actor.loginIdentifier,
        actorRole: actor.role,
        action: 'AGENTCREATEDMANUAL_UPI_REF',
        module: 'FIELD_COLLECTIONS',
        entityType: 'PAYMENT',
        entityId: payment.id,
        previousValueSummary: `Entity ${entity.registrationNumber} Due: INR ${Money.paiseToInr(
          totalPaise
        )}`,
        newValueSummary: `Recorded PENDING Manual UPI INR ${payload.amountInr} (UTR: ${payment.referenceNumber}) — Final receipt withheld until verification`,
        correlationId,
      });

      if (payload.idempotencyKey) {
        db.idempotencyKeys.push({
          key: payload.idempotencyKey,
          endpoint: 'POST /payments/manual-upi',
          actorId: actor.sub,
          statusCode: 201,
          responseBody: { payment },
          createdAt: nowIso,
        });
      }

      return { payment, idempotentReplay: false };
    });
  }

  public async createOnlinePaymentOrder(
    actor: JwtClaims,
    payload: {
      entityId: string;
      amountInr: number;
      provider?: 'RAZORPAY_MOCK' | 'CASHFREE_MOCK';
    },
    correlationId: string
  ) {
    return this.store.withTransaction('CREATE_PAYMENT_ORDER', async (db) => {
      const entity = db.entities.find((e) => e.id === payload.entityId);
      if (!entity) {
        throw new AppError(
          404,
          'ENTITY_NOT_FOUND',
          `Entity ${payload.entityId} was not found`
        );
      }
      assertCitizenEntityOwnership(actor, entity.id, entity.mobile);

      const { totalPaise, openDues } = this.computeEntityTotalOutstandingPaise(
        db,
        entity.id
      );
      const amountPaise = Money.inrToPaise(payload.amountInr);
      if (!db.settings.allowAdvanceOverpayment && amountPaise > totalPaise) {
        throw new AppError(
          400,
          'OVERPAYMENT_NOT_ALLOWED',
          `Order amount (INR ${payload.amountInr}) exceeds outstanding balance (INR ${Money.paiseToInr(
            totalPaise
          )})`
        );
      }

      const paymentId = `PAY-2026-${9085 + db.payments.length + 1}`;
      const orderResult = await this.gatewayAdapter.createOrder({
        paymentId,
        entityId: entity.id,
        amountInr: payload.amountInr,
        provider: payload.provider,
      });

      const previewAllocations = this.allocateAcrossDues(
        openDues,
        payload.amountInr,
        undefined,
        false
      );

      const payment: PaymentRecord = {
        id: paymentId,
        orderId: orderResult.gatewayOrderId,
        entityId: entity.id,
        entityName: entity.name,
        registrationNumber: entity.registrationNumber,
        wardName: entity.wardName,
        categoryName: entity.category,
        amountInr: payload.amountInr,
        method: 'PAYMENT_GATEWAY',
        referenceNumber: orderResult.gatewayOrderId,
        processingStatus: 'CREATED',
        settlementStatus: 'PENDING_SETTLEMENT',
        collectedBy: actor.loginIdentifier,
        collectedByRole: actor.role,
        timestamp: new Date().toISOString(),
        notes: 'Online gateway order created; awaiting verified webhook/server confirmation',
        allocations: previewAllocations,
      };

      db.payments.unshift(payment);

      appendAudit(db, {
        actorName: actor.loginIdentifier,
        actorRole: actor.role,
        action: 'PAYMENT_ORDER_CREATED',
        module: 'ONLINE_PAYMENTS',
        entityType: 'PAYMENT',
        entityId: payment.id,
        previousValueSummary: 'None',
        newValueSummary: `Created Order ${orderResult.gatewayOrderId} for INR ${payload.amountInr} (Status: CREATED)`,
        correlationId,
      });

      return {
        orderId: orderResult.gatewayOrderId,
        amountPaise: Money.inrToPaise(payload.amountInr),
        payment,
        gatewayOrder: orderResult,
      };
    });
  }

  /**
   * Authoritative Payment Verification (Officer Manual UPI Verify OR Gateway Webhook Verify)
   * Transitions PENDING / CREATED payment -> ALLOCATED -> RECEIPT_GENERATED and issues final receipt.
   * Safe against duplicate webhook/verification calls (Idempotent).
   */
  public async verifyPayment(
    actor: JwtClaims,
    paymentId: string,
    payload: {
      verificationNotes?: string;
      gatewayTxnId?: string;
      simulateOutcome?: 'SUCCESS' | 'FAILED' | 'EXPIRED';
    },
    correlationId: string
  ): Promise<{
    payment: PaymentRecord;
    receipt?: ReceiptRecord;
    alreadyVerified: boolean;
  }> {
    return this.store.withTransaction('VERIFY_PAYMENT', (db) => {
      const payment = db.payments.find((p) => p.id === paymentId);
      if (!payment) {
        throw new AppError(
          404,
          'PAYMENT_NOT_FOUND',
          `Payment ${paymentId} was not found`
        );
      }

      const linkedEntity = db.entities.find((e) => e.id === payment.entityId);
      if (!linkedEntity) throw new AppError(404, 'ENTITY_NOT_FOUND', 'Linked entity not found');
      assertCitizenEntityOwnership(actor, linkedEntity.id, linkedEntity.mobile);
      if (actor.role !== 'CITIZEN' && !hasWardJurisdiction(actor, linkedEntity.wardId, db.wards)) {
        throw new AppError(403, 'JURISDICTION_FORBIDDEN', 'Payment is outside the assigned jurisdiction');
      }
      if (payment.method === 'UPI_REFERENCE' && !['ADMIN', 'OFFICER'].includes(actor.role)) {
        throw new AppError(403, 'FORBIDDEN_ROLE', 'Only authorized officers can confirm manual references');
      }
      if (payment.method === 'PAYMENT_GATEWAY' && !loadConfig().demoMode) {
        throw new AppError(503, 'PAYMENT_GATEWAY_NOT_CONFIGURED', 'Gateway confirmation requires trusted provider verification');
      }
      if (payload.simulateOutcome && !loadConfig().demoMode) {
        throw new AppError(400, 'SIMULATION_FORBIDDEN', 'Simulated payment outcomes are unavailable');
      }

      // Duplicate webhook / verification protection
      if (
        payment.processingStatus === 'RECEIPT_GENERATED' ||
        payment.processingStatus === 'NOTIFIED' ||
        payment.processingStatus === 'ALLOCATED'
      ) {
        const existingReceipt = db.receipts.find(
          (r) => r.paymentId === payment.id
        );
        return {
          payment,
          receipt: existingReceipt,
          alreadyVerified: true,
        };
      }

      const entity = db.entities.find((e) => e.id === payment.entityId);
      if (!entity) {
        throw new AppError(404, 'ENTITY_NOT_FOUND', 'Linked entity not found');
      }

      // If manual UPI verification, only ADMIN or OFFICER with ward jurisdiction may verify
      if (payment.method === 'UPI_REFERENCE') {
        if (actor.role !== 'ADMIN' && actor.role !== 'OFFICER') {
          throw new AppError(
            403,
            'FORBIDDEN_ROLE',
            'Only an authorized Revenue Officer or Administrator can verify a manual UPI reference'
          );
        }
        if (!hasWardJurisdiction(actor, entity.wardId, db.wards)) {
          throw new AppError(
            403,
            'JURISDICTION_FORBIDDEN',
            `Officer ${actor.loginIdentifier} does not have jurisdiction over Ward ${entity.wardId}`
          );
        }
      }

      if (payload.simulateOutcome === 'FAILED') {
        payment.processingStatus = 'FAILED';
        appendAudit(db, {
          actorName: actor.loginIdentifier,
          actorRole: actor.role,
          action: 'PAYMENTSTATUSCHANGED',
          module: 'PAYMENTS',
          entityType: 'PAYMENT',
          entityId: payment.id,
          previousValueSummary: 'Status: PENDING',
          newValueSummary: 'Status: FAILED',
          correlationId,
        });
        return { payment, alreadyVerified: false };
      }

      if (payload.simulateOutcome === 'EXPIRED') {
        payment.processingStatus = 'EXPIRED';
        return { payment, alreadyVerified: false };
      }

      const { totalPaise, openDues } = this.computeEntityTotalOutstandingPaise(
        db,
        entity.id
      );
      const prevOutstandingInr = Money.paiseToInr(totalPaise);
      if (Money.inrToPaise(payment.amountInr) > totalPaise) {
        throw new AppError(409, 'PAYMENT_REQUIRES_RECONCILIATION', 'Outstanding balance changed; reconcile this payment before confirmation');
      }

      // Atomically allocate across open dues
      const appliedAllocations = this.allocateAcrossDues(
        openDues,
        payment.amountInr,
        undefined,
        true
      );
      const newOutstandingInr = Math.max(
        0,
        Money.subInr(prevOutstandingInr, payment.amountInr)
      );

      entity.paidAllocated = Money.addInr(
        entity.paidAllocated,
        payment.amountInr
      );
      entity.outstandingAmount = newOutstandingInr;

      const receiptNumber = this.generateAuthoritativeReceiptNumber(db);
      const receiptId = `RCP-${100 + db.receipts.length + 1}`;
      const nowIso = new Date().toISOString();

      if (payload.gatewayTxnId) {
        payment.referenceNumber = payload.gatewayTxnId;
      }
      payment.allocations = appliedAllocations;
      payment.processingStatus = 'RECEIPT_GENERATED';
      payment.settlementStatus = 'SETTLED';
      payment.receiptId = receiptId;
      payment.receiptNumber = receiptNumber;
      payment.verifiedBy = actor.loginIdentifier;
      payment.verifiedAt = nowIso;
      if (payload.verificationNotes) {
        payment.notes = payload.verificationNotes;
      }

      const receipt: ReceiptRecord = {
        id: receiptId,
        receiptNumber,
        paymentId: payment.id,
        entityId: entity.id,
        entityName: entity.name,
        registrationNumber: entity.registrationNumber,
        categoryName: entity.category,
        wardName: entity.wardName,
        dateTime: nowIso,
        previousOutstanding: prevOutstandingInr,
        currentPayment: payment.amountInr,
        allocatedAmount: payment.amountInr,
        remainingOutstanding: newOutstandingInr,
        paymentMethod: payment.method,
        transactionReference: payment.referenceNumber,
        agentName: payment.collectedBy,
        agentId: actor.sub,
        verificationCode: `VRF-${crypto.randomBytes(3).toString('hex').toUpperCase()}-SUP26`,
        status: 'VALID',
      };

      db.receipts.unshift(receipt);

      appendAudit(db, {
        actorName: actor.loginIdentifier,
        actorRole: actor.role,
        action:
          payment.method === 'PAYMENT_GATEWAY'
            ? 'PAYMENTWEBHOOKRECEIVED'
            : 'PAYMENTSTATUSCHANGED',
        module: 'PAYMENTS',
        entityType: 'PAYMENT',
        entityId: payment.id,
        previousValueSummary: 'Status: PENDING / UNVERIFIED',
        newValueSummary: `Verified & Allocated INR ${payment.amountInr} -> Issued Receipt ${receiptNumber}`,
        correlationId,
      });

      return { payment, receipt, alreadyVerified: false };
    });
  }

  public async refundOrReversePayment(
    actor: JwtClaims,
    paymentId: string,
    mode: 'REFUND' | 'REVERSAL',
    payload: {
      amountInr?: number;
      reasonCode: string;
      description: string;
    },
    correlationId: string
  ) {
    return this.store.withTransaction('REFUND_OR_REVERSE_PAYMENT', (db) => {
      const payment = db.payments.find((p) => p.id === paymentId);
      if (!payment) {
        throw new AppError(
          404,
          'PAYMENT_NOT_FOUND',
          `Payment ${paymentId} was not found`
        );
      }
      if (
        payment.processingStatus === 'REFUNDED' ||
        payment.settlementStatus === 'REVERSED'
      ) {
        throw new AppError(
          409,
          'ALREADY_REVERSED',
          `Payment ${paymentId} has already been refunded or reversed`
        );
      }

      const reversalAmount = payload.amountInr || payment.amountInr;
      const revPaise = Money.inrToPaise(reversalAmount);
      const origPaise = Money.inrToPaise(payment.amountInr);

      if (revPaise > origPaise) {
        throw new AppError(
          400,
          'INVALID_REFUND_AMOUNT',
          `Refund/reversal amount (INR ${reversalAmount}) cannot exceed original payment (INR ${payment.amountInr})`
        );
      }

      const isPartial = revPaise < origPaise;
      payment.processingStatus = isPartial ? 'PARTIALLY_REFUNDED' : 'REFUNDED';
      payment.settlementStatus = 'REVERSED';

      // Restore outstanding balance on entity & allocated dues without deleting historical records!
      const entity = db.entities.find((e) => e.id === payment.entityId);
      if (entity) {
        entity.paidAllocated = Math.max(
          0,
          Money.subInr(entity.paidAllocated, reversalAmount)
        );
        entity.outstandingAmount = Money.addInr(
          entity.outstandingAmount,
          reversalAmount
        );
      }

      let toRestorePaise = revPaise;
      for (const alloc of payment.allocations) {
        if (toRestorePaise <= 0) break;
        const due = db.dues.find((d) => d.id === alloc.dueId);
        if (due) {
          const restoreHerePaise = Math.min(
            toRestorePaise,
            Money.inrToPaise(alloc.allocatedAmount)
          );
          const restoreInr = Money.paiseToInr(restoreHerePaise);
          due.paidAmount = Math.max(0, Money.subInr(due.paidAmount, restoreInr));
          due.outstandingAmount = Money.addInr(
            due.outstandingAmount,
            restoreInr
          );
          due.status = due.paidAmount > 0 ? 'PARTIALLY_PAID' : 'PENDING';
          toRestorePaise -= restoreHerePaise;
        }
      }

      const receipt = db.receipts.find((r) => r.paymentId === payment.id);
      if (receipt) {
        receipt.status = 'REVERSED';
      }

      const disputeRecord = {
        id: `${mode.slice(0, 3)}-2026-0${db.disputes.length + 50}`,
        recordType: mode,
        paymentId: payment.id,
        receiptNumber: payment.receiptNumber || 'N/A',
        entityId: payment.entityId,
        entityName: payment.entityName,
        registrationNumber: payment.registrationNumber,
        amountInr: reversalAmount,
        reasonCode: payload.reasonCode,
        description: payload.description,
        requestedBy: actor.loginIdentifier,
        requestedAt: new Date().toISOString(),
        status: 'APPROVED' as const,
        resolutionNotes: `Processed ${mode} (${payload.reasonCode})`,
        reviewedBy: actor.loginIdentifier,
      };
      db.disputes.unshift(disputeRecord);

      appendAudit(db, {
        actorName: actor.loginIdentifier,
        actorRole: actor.role,
        action: mode === 'REFUND' ? 'PAYMENT_REFUNDED' : 'PAYMENT_REVERSED',
        module: 'PAYMENTS',
        entityType: 'PAYMENT',
        entityId: payment.id,
        previousValueSummary: `Status: SETTLED (INR ${payment.amountInr})`,
        newValueSummary: `${mode} of INR ${reversalAmount} (${payload.reasonCode}); Ledger restored without deleting payment/receipt`,
        correlationId,
      });

      return { payment, receipt, reversalRecord: disputeRecord };
    });
  }

  public async listPayments(
    actor: JwtClaims,
    filters: {
      entityId?: string;
      method?: string;
      status?: string;
      q?: string;
    }
  ): Promise<PaymentRecord[]> {
    const db = await this.store.readAll();
    let list = db.payments;

    if (actor.role === 'CITIZEN') {
      const linked = actor.linkedEntityIds || [];
      list = list.filter((p) => linked.includes(p.entityId));
    } else if (actor.role === 'OFFICER' || actor.role === 'AGENT') {
      list = list.filter((p) => {
        const entity = db.entities.find((e) => e.id === p.entityId);
        return entity && hasWardJurisdiction(actor, entity.wardId, db.wards);
      });
    }

    if (filters.entityId) {
      list = list.filter((p) => p.entityId === filters.entityId);
    }
    if (filters.method) {
      list = list.filter((p) => p.method === filters.method);
    }
    if (filters.status) {
      list = list.filter(
        (p) =>
          p.processingStatus === filters.status ||
          p.settlementStatus === filters.status
      );
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      list = list.filter(
        (p) =>
          p.id.toLowerCase().includes(q) ||
          p.referenceNumber.toLowerCase().includes(q) ||
          p.registrationNumber.toLowerCase().includes(q) ||
          p.entityName.toLowerCase().includes(q)
      );
    }
    return list;
  }

  public async getPaymentById(
    actor: JwtClaims,
    id: string
  ): Promise<PaymentRecord> {
    const db = await this.store.readAll();
    const payment = db.payments.find((p) => p.id === id);
    if (!payment) {
      throw new AppError(404, 'PAYMENT_NOT_FOUND', `Payment ${id} was not found`);
    }
    assertCitizenEntityOwnership(actor, payment.entityId);
    const entity = db.entities.find((e) => e.id === payment.entityId);
    if (
      entity &&
      (actor.role === 'OFFICER' || actor.role === 'AGENT') &&
      !hasWardJurisdiction(actor, entity.wardId, db.wards)
    ) {
      throw new AppError(
        403,
        'JURISDICTION_FORBIDDEN',
        `Actor ${actor.loginIdentifier} does not have jurisdiction over Ward ${entity.wardId}`
      );
    }
    return payment;
  }

  // Module G — Receipts
  public async listReceipts(
    actor: JwtClaims,
    filters: { entityId?: string; q?: string }
  ): Promise<ReceiptRecord[]> {
    const db = await this.store.readAll();
    let list = db.receipts;

    if (actor.role === 'CITIZEN') {
      const linked = actor.linkedEntityIds || [];
      list = list.filter((r) => linked.includes(r.entityId));
    } else if (actor.role === 'OFFICER' || actor.role === 'AGENT') {
      list = list.filter((r) => {
        const entity = db.entities.find((e) => e.id === r.entityId);
        return entity && hasWardJurisdiction(actor, entity.wardId, db.wards);
      });
    }

    if (filters.entityId) {
      list = list.filter((r) => r.entityId === filters.entityId);
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      list = list.filter(
        (r) =>
          r.receiptNumber.toLowerCase().includes(q) ||
          r.registrationNumber.toLowerCase().includes(q) ||
          r.entityName.toLowerCase().includes(q) ||
          r.verificationCode.toLowerCase().includes(q)
      );
    }
    return list;
  }

  public async getReceiptById(
    actor: JwtClaims,
    id: string
  ): Promise<ReceiptRecord> {
    const db = await this.store.readAll();
    const receipt = db.receipts.find(
      (r) => r.id === id || r.receiptNumber === id
    );
    if (!receipt) {
      throw new AppError(404, 'RECEIPT_NOT_FOUND', `Receipt ${id} was not found`);
    }
    assertCitizenEntityOwnership(actor, receipt.entityId);
    const entity = db.entities.find((e) => e.id === receipt.entityId);
    if (
      entity &&
      (actor.role === 'OFFICER' || actor.role === 'AGENT') &&
      !hasWardJurisdiction(actor, entity.wardId, db.wards)
    ) {
      throw new AppError(
        403,
        'JURISDICTION_FORBIDDEN',
        `Actor ${actor.loginIdentifier} does not have jurisdiction over Ward ${entity.wardId}`
      );
    }
    return receipt;
  }

  public async generateReceiptPdfPayload(actor: JwtClaims, id: string) {
    const receipt = await this.getReceiptById(actor, id);
    const db = await this.store.readAll();
    return {
      format: 'APPLICATION_PDF_DESCRIPTOR',
      municipalityName: db.settings.municipalityName,
      tagline: db.settings.tagline,
      receiptNumber: receipt.receiptNumber,
      dateTime: receipt.dateTime,
      payerName: receipt.entityName,
      registrationNumber: receipt.registrationNumber,
      category: receipt.categoryName,
      ward: receipt.wardName,
      financials: {
        currency: 'INR',
        previousOutstandingInr: receipt.previousOutstanding,
        currentPaymentInr: receipt.currentPayment,
        allocatedAmountInr: receipt.allocatedAmount,
        remainingOutstandingInr: receipt.remainingOutstanding,
      },
      paymentMethod: receipt.paymentMethod,
      transactionReference: receipt.transactionReference,
      collector: `${receipt.agentName} (${receipt.agentId})`,
      verificationCode: receipt.verificationCode,
      qrVerifyUrl: `/api/v1/receipts/verify/${encodeURIComponent(
        receipt.verificationCode
      )}`,
      status: receipt.status,
    };
  }

  /**
   * Public Receipt Verification (Section 34 & Module G Privacy Invariant)
   * Returns ONLY validity, receiptNumber, amount, date, paymentStatus, and municipality identity.
   * Strictly omits personal mobile numbers, addresses, payer names, and full ledger history.
   */
  public async verifyReceiptPublic(codeOrNumber: string) {
    const db = await this.store.readAll();
    const q = codeOrNumber.trim().toLowerCase();
    const receipt = db.receipts.find(
      (r) =>
        r.verificationCode.toLowerCase() === q ||
        r.receiptNumber.toLowerCase() === q ||
        r.id.toLowerCase() === q
    );

    if (!receipt) {
      return {
        valid: false,
        receiptStatus: 'INVALID_OR_NOT_FOUND',
        municipalityName: db.settings.municipalityName,
      };
    }

    return {
      valid: receipt.status === 'VALID',
      receiptStatus: receipt.status,
      receiptNumber: receipt.receiptNumber,
      amountInr: receipt.currentPayment,
      currency: 'INR',
      dateTime: receipt.dateTime,
      paymentMethod: receipt.paymentMethod,
      municipalityName: db.settings.municipalityName,
    };
  }
}
