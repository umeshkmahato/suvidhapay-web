import { AppError } from '../infra/core';
import {
  IDataStore,
  BackendUserRecord,
  IUserRepository,
  IEntityRepository,
  IDueRepository,
  IPaymentRepository,
  IReceiptRepository,
  IRateRepository,
  IWardRepository,
  IZoneRepository,
  IClosingRepository,
  IReconciliationRepository,
  IDisputeRepository,
  IAuditLogRepository,
  INotificationRepository,
  ISettingsRepository,
  IVerificationRepository,
  IImportRepository,
  SystemSettingsRecord,
  GovVerificationRecord,
  ImportBatchRecord,
} from './interfaces';
import {
  Ward,
  Zone,
  RateMaster,
  MunicipalEntity,
  DueRecord,
  PaymentRecord,
  ReceiptRecord,
  DailyClosingRecord,
  ReconciliationItem,
  RefundDisputeRecord,
  NotificationLog,
  AuditLogEntry,
  UserRole,
} from '../types/suvidha';

/**
 * Domain Repositories Architecture (Section 2, 4 & Phase 2)
 *
 * Implements decoupled, strongly typed repository classes over IDataStore.
 * These classes isolate query logic, filtering, duplicate detection, and missing-record
 * semantics from higher-level services and controllers.
 *
 * Migration Note: When migrating to PostgreSQL, these classes can either be adapted
 * to execute SQL queries or swapped with a Drizzle/Prisma repository implementation
 * without touching controller or domain service code.
 */

export class UserRepository implements IUserRepository {
  constructor(private readonly store: IDataStore) {}

  public async findById(id: string): Promise<BackendUserRecord | null> {
    const db = await this.store.readAll();
    const user = db.users.find((u) => u.id === id);
    return user ? { ...user } : null;
  }

  public async findByLoginIdentifier(identifier: string): Promise<BackendUserRecord | null> {
    const db = await this.store.readAll();
    const cleanId = identifier.trim().toLowerCase();
    const user = db.users.find(
      (u) =>
        u.loginIdentifier.toLowerCase() === cleanId ||
        u.mobile === cleanId ||
        (u.email && u.email.toLowerCase() === cleanId)
    );
    return user ? { ...user } : null;
  }

  public async findByMobile(mobile: string): Promise<BackendUserRecord | null> {
    const db = await this.store.readAll();
    const user = db.users.find((u) => u.mobile === mobile);
    return user ? { ...user } : null;
  }

  public async list(filter?: { role?: UserRole; ward?: string; status?: string }): Promise<BackendUserRecord[]> {
    const db = await this.store.readAll();
    let users = db.users;
    if (filter?.role) {
      users = users.filter((u) => u.role === filter.role);
    }
    if (filter?.ward && filter.ward !== 'ALL') {
      users = users.filter((u) => u.assignedWard === filter.ward);
    }
    if (filter?.status && filter.status !== 'ALL') {
      users = users.filter((u) => u.status === filter.status);
    }
    return users.map((u) => ({ ...u }));
  }

  public async create(user: BackendUserRecord): Promise<BackendUserRecord> {
    return this.store.withTransaction('USER_CREATE', (db) => {
      const exists = db.users.some(
        (u) =>
          u.loginIdentifier.toLowerCase() === user.loginIdentifier.toLowerCase() ||
          u.mobile === user.mobile
      );
      if (exists) {
        throw new AppError(
          409,
          'DUPLICATE_USER',
          `A user with loginIdentifier "${user.loginIdentifier}" or mobile "${user.mobile}" already exists.`
        );
      }
      db.users.push(user);
      return { ...user };
    });
  }

  public async update(id: string, updates: Partial<BackendUserRecord>): Promise<BackendUserRecord> {
    return this.store.withTransaction('USER_UPDATE', (db) => {
      const idx = db.users.findIndex((u) => u.id === id);
      if (idx === -1) {
        throw new AppError(404, 'USER_NOT_FOUND', `User with ID "${id}" does not exist.`);
      }
      const updated = { ...db.users[idx], ...updates };
      db.users[idx] = updated;
      return { ...updated };
    });
  }

  public async count(filter?: Partial<BackendUserRecord>): Promise<number> {
    const list = await this.list(filter as { role?: UserRole; ward?: string; status?: string });
    return list.length;
  }
}

export class EntityRepository implements IEntityRepository {
  constructor(private readonly store: IDataStore) {}

  public async findById(id: string): Promise<MunicipalEntity | null> {
    const db = await this.store.readAll();
    const entity = db.entities.find((e) => e.id === id);
    return entity ? { ...entity } : null;
  }

  public async findByNormalizedIdentifier(normalizedId: string): Promise<MunicipalEntity | null> {
    const db = await this.store.readAll();
    const clean = normalizedId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const entity = db.entities.find((e) => e.normalizedIdentifier === clean);
    return entity ? { ...entity } : null;
  }

  public async findByRegistrationNumber(regNo: string): Promise<MunicipalEntity | null> {
    return this.findByNormalizedIdentifier(regNo);
  }

  public async list(filter?: {
    q?: string;
    entityType?: string;
    wardId?: string;
    categoryId?: string;
    status?: string;
    mobile?: string;
  }): Promise<MunicipalEntity[]> {
    const db = await this.store.readAll();
    let entities = db.entities;

    if (filter?.q) {
      const q = filter.q.trim().toUpperCase();
      const qClean = q.replace(/[^a-zA-Z0-9]/g, '');
      entities = entities.filter(
        (e) =>
          e.normalizedIdentifier.includes(qClean) ||
          e.registrationNumber.toUpperCase().includes(q) ||
          e.name.toUpperCase().includes(q) ||
          e.mobile.includes(q)
      );
    }
    if (filter?.entityType && filter.entityType !== 'ALL') {
      entities = entities.filter((e) => e.entityType === filter.entityType);
    }
    if (filter?.wardId && filter.wardId !== 'ALL') {
      const targetWard = filter.wardId;
      entities = entities.filter((e) => e.wardId === targetWard || e.wardName.includes(targetWard));
    }
    if (filter?.categoryId && filter.categoryId !== 'ALL') {
      entities = entities.filter((e) => e.categoryId === filter.categoryId);
    }
    if (filter?.status && filter.status !== 'ALL') {
      entities = entities.filter((e) => e.registrationStatus === filter.status);
    }
    if (filter?.mobile) {
      entities = entities.filter((e) => e.mobile === filter.mobile);
    }

    return entities.map((e) => ({ ...e }));
  }

  public async create(entity: MunicipalEntity): Promise<MunicipalEntity> {
    return this.store.withTransaction('ENTITY_CREATE', (db) => {
      const exists = db.entities.some(
        (e) => e.normalizedIdentifier === entity.normalizedIdentifier
      );
      if (exists) {
        throw new AppError(
          409,
          'DUPLICATE_REGISTRATION',
          `An entity with registration number "${entity.registrationNumber}" is already registered.`
        );
      }
      db.entities.unshift(entity);
      return { ...entity };
    });
  }

  public async update(id: string, updates: Partial<MunicipalEntity>): Promise<MunicipalEntity> {
    return this.store.withTransaction('ENTITY_UPDATE', (db) => {
      const idx = db.entities.findIndex((e) => e.id === id);
      if (idx === -1) {
        throw new AppError(404, 'ENTITY_NOT_FOUND', `Entity with ID "${id}" does not exist.`);
      }
      const updated = { ...db.entities[idx], ...updates };
      db.entities[idx] = updated;
      return { ...updated };
    });
  }

  public async count(): Promise<number> {
    const db = await this.store.readAll();
    return db.entities.length;
  }
}

export class DueRepository implements IDueRepository {
  constructor(private readonly store: IDataStore) {}

  public async findById(id: string): Promise<DueRecord | null> {
    const db = await this.store.readAll();
    const due = db.dues.find((d) => d.id === id);
    return due ? { ...due } : null;
  }

  public async findByEntityId(entityId: string): Promise<DueRecord[]> {
    const db = await this.store.readAll();
    return db.dues.filter((d) => d.entityId === entityId).map((d) => ({ ...d }));
  }

  public async list(filter?: {
    entityId?: string;
    wardId?: string;
    status?: string;
    rateId?: string;
  }): Promise<DueRecord[]> {
    const db = await this.store.readAll();
    let dues = db.dues;
    if (filter?.entityId) {
      dues = dues.filter((d) => d.entityId === filter.entityId);
    }
    if (filter?.status && filter.status !== 'ALL') {
      dues = dues.filter((d) => d.status === filter.status);
    }
    if (filter?.rateId) {
      dues = dues.filter((d) => d.rateId === filter.rateId);
    }
    return dues.map((d) => ({ ...d }));
  }

  public async create(due: DueRecord): Promise<DueRecord> {
    return this.store.withTransaction('DUE_CREATE', (db) => {
      db.dues.unshift(due);
      return { ...due };
    });
  }

  public async createMany(dues: DueRecord[]): Promise<DueRecord[]> {
    return this.store.withTransaction('DUES_CREATE_MANY', (db) => {
      db.dues.unshift(...dues);
      return dues.map((d) => ({ ...d }));
    });
  }

  public async update(id: string, updates: Partial<DueRecord>): Promise<DueRecord> {
    return this.store.withTransaction('DUE_UPDATE', (db) => {
      const idx = db.dues.findIndex((d) => d.id === id);
      if (idx === -1) {
        throw new AppError(404, 'DUE_NOT_FOUND', `Due with ID "${id}" does not exist.`);
      }
      const updated = { ...db.dues[idx], ...updates };
      db.dues[idx] = updated;
      return { ...updated };
    });
  }

  public async updateMany(dues: DueRecord[]): Promise<void> {
    await this.store.withTransaction('DUES_UPDATE_MANY', (db) => {
      const map = new Map(dues.map((d) => [d.id, d]));
      for (let i = 0; i < db.dues.length; i++) {
        const replacement = map.get(db.dues[i].id);
        if (replacement) {
          db.dues[i] = replacement;
        }
      }
    });
  }
}

export class PaymentRepository implements IPaymentRepository {
  constructor(private readonly store: IDataStore) {}

  public async findById(id: string): Promise<PaymentRecord | null> {
    const db = await this.store.readAll();
    const p = db.payments.find((item) => item.id === id);
    return p ? { ...p } : null;
  }

  public async findByReceiptId(receiptId: string): Promise<PaymentRecord | null> {
    const db = await this.store.readAll();
    const p = db.payments.find((item) => item.receiptId === receiptId);
    return p ? { ...p } : null;
  }

  public async findByEntityId(entityId: string): Promise<PaymentRecord[]> {
    const db = await this.store.readAll();
    return db.payments.filter((p) => p.entityId === entityId).map((p) => ({ ...p }));
  }

  public async list(filter?: {
    entityId?: string;
    method?: string;
    settlementStatus?: string;
    collectedBy?: string;
    date?: string;
  }): Promise<PaymentRecord[]> {
    const db = await this.store.readAll();
    let payments = db.payments;
    if (filter?.entityId) {
      payments = payments.filter((p) => p.entityId === filter.entityId);
    }
    if (filter?.method && filter.method !== 'ALL') {
      payments = payments.filter((p) => p.method === filter.method);
    }
    if (filter?.settlementStatus && filter.settlementStatus !== 'ALL') {
      payments = payments.filter((p) => p.settlementStatus === filter.settlementStatus);
    }
    if (filter?.collectedBy) {
      payments = payments.filter((p) =>
        p.collectedBy.toUpperCase().includes(filter.collectedBy!.toUpperCase())
      );
    }
    return payments.map((p) => ({ ...p }));
  }

  public async create(payment: PaymentRecord): Promise<PaymentRecord> {
    return this.store.withTransaction('PAYMENT_CREATE', (db) => {
      db.payments.unshift(payment);
      return { ...payment };
    });
  }

  public async update(id: string, updates: Partial<PaymentRecord>): Promise<PaymentRecord> {
    return this.store.withTransaction('PAYMENT_UPDATE', (db) => {
      const idx = db.payments.findIndex((p) => p.id === id);
      if (idx === -1) {
        throw new AppError(404, 'PAYMENT_NOT_FOUND', `Payment with ID "${id}" does not exist.`);
      }
      const updated = { ...db.payments[idx], ...updates };
      db.payments[idx] = updated;
      return { ...updated };
    });
  }
}

export class ReceiptRepository implements IReceiptRepository {
  constructor(private readonly store: IDataStore) {}

  public async findById(id: string): Promise<ReceiptRecord | null> {
    const db = await this.store.readAll();
    const r = db.receipts.find((item) => item.id === id);
    return r ? { ...r } : null;
  }

  public async findByReceiptNumber(receiptNumber: string): Promise<ReceiptRecord | null> {
    const db = await this.store.readAll();
    const r = db.receipts.find(
      (item) => item.receiptNumber.toUpperCase() === receiptNumber.trim().toUpperCase()
    );
    return r ? { ...r } : null;
  }

  public async findByVerificationCode(code: string): Promise<ReceiptRecord | null> {
    const db = await this.store.readAll();
    const clean = code.trim().toUpperCase();
    const r = db.receipts.find(
      (item) =>
        item.verificationCode.toUpperCase() === clean ||
        item.receiptNumber.toUpperCase() === clean
    );
    return r ? { ...r } : null;
  }

  public async findByPaymentId(paymentId: string): Promise<ReceiptRecord | null> {
    const db = await this.store.readAll();
    const r = db.receipts.find((item) => item.paymentId === paymentId);
    return r ? { ...r } : null;
  }

  public async list(filter?: { entityId?: string; date?: string; wardName?: string }): Promise<ReceiptRecord[]> {
    const db = await this.store.readAll();
    let receipts = db.receipts;
    if (filter?.entityId) {
      receipts = receipts.filter((r) => r.entityId === filter.entityId);
    }
    if (filter?.wardName && filter.wardName !== 'ALL') {
      receipts = receipts.filter((r) => r.wardName.includes(filter.wardName!));
    }
    return receipts.map((r) => ({ ...r }));
  }

  public async create(receipt: ReceiptRecord): Promise<ReceiptRecord> {
    return this.store.withTransaction('RECEIPT_CREATE', (db) => {
      db.receipts.unshift(receipt);
      return { ...receipt };
    });
  }
}

export class RateRepository implements IRateRepository {
  constructor(private readonly store: IDataStore) {}

  public async findById(id: string): Promise<RateMaster | null> {
    const db = await this.store.readAll();
    const r = db.rates.find((item) => item.id === id);
    return r ? { ...r } : null;
  }

  public async findActiveForCategory(
    categoryId: string,
    wardScope = 'ALL'
  ): Promise<RateMaster | null> {
    const db = await this.store.readAll();
    const match = db.rates.find(
      (r) =>
        r.categoryId === categoryId &&
        r.status === 'ACTIVE' &&
        (r.wardScope === 'ALL' || r.wardScope === wardScope)
    );
    return match ? { ...match } : null;
  }

  public async list(filter?: { categoryId?: string; status?: string; wardScope?: string }): Promise<RateMaster[]> {
    const db = await this.store.readAll();
    let rates = db.rates;
    if (filter?.categoryId) {
      rates = rates.filter((r) => r.categoryId === filter.categoryId);
    }
    if (filter?.status && filter.status !== 'ALL') {
      rates = rates.filter((r) => r.status === filter.status);
    }
    if (filter?.wardScope && filter.wardScope !== 'ALL') {
      rates = rates.filter((r) => r.wardScope === filter.wardScope || r.wardScope === 'ALL');
    }
    return rates.map((r) => ({ ...r }));
  }

  public async create(rate: RateMaster): Promise<RateMaster> {
    return this.store.withTransaction('RATE_CREATE', (db) => {
      db.rates.unshift(rate);
      return { ...rate };
    });
  }

  public async update(id: string, updates: Partial<RateMaster>): Promise<RateMaster> {
    return this.store.withTransaction('RATE_UPDATE', (db) => {
      const idx = db.rates.findIndex((r) => r.id === id);
      if (idx === -1) {
        throw new AppError(404, 'RATE_NOT_FOUND', `Rate with ID "${id}" does not exist.`);
      }
      const updated = { ...db.rates[idx], ...updates };
      db.rates[idx] = updated;
      return { ...updated };
    });
  }
}

export class WardRepository implements IWardRepository {
  constructor(private readonly store: IDataStore) {}

  public async findById(id: string): Promise<Ward | null> {
    const db = await this.store.readAll();
    const w = db.wards.find((item) => item.id === id);
    return w ? { ...w } : null;
  }

  public async findByCode(code: string): Promise<Ward | null> {
    const db = await this.store.readAll();
    const w = db.wards.find((item) => item.code.toUpperCase() === code.trim().toUpperCase());
    return w ? { ...w } : null;
  }

  public async list(filter?: { zoneId?: string; status?: string }): Promise<Ward[]> {
    const db = await this.store.readAll();
    let wards = db.wards;
    if (filter?.zoneId && filter.zoneId !== 'ALL') {
      wards = wards.filter((w) => w.zoneId === filter.zoneId);
    }
    if (filter?.status && filter.status !== 'ALL') {
      wards = wards.filter((w) => w.status === filter.status);
    }
    return wards.map((w) => ({ ...w }));
  }

  public async create(ward: Ward): Promise<Ward> {
    return this.store.withTransaction('WARD_CREATE', (db) => {
      const exists = db.wards.some((w) => w.code.toUpperCase() === ward.code.toUpperCase());
      if (exists) {
        throw new AppError(409, 'DUPLICATE_WARD', `Ward with code "${ward.code}" already exists.`);
      }
      db.wards.push(ward);
      return { ...ward };
    });
  }

  public async update(id: string, updates: Partial<Ward>): Promise<Ward> {
    return this.store.withTransaction('WARD_UPDATE', (db) => {
      const idx = db.wards.findIndex((w) => w.id === id);
      if (idx === -1) {
        throw new AppError(404, 'WARD_NOT_FOUND', `Ward with ID "${id}" does not exist.`);
      }
      const updated = { ...db.wards[idx], ...updates };
      db.wards[idx] = updated;
      return { ...updated };
    });
  }
}

export class ZoneRepository implements IZoneRepository {
  constructor(private readonly store: IDataStore) {}

  public async findById(id: string): Promise<Zone | null> {
    const db = await this.store.readAll();
    const z = db.zones.find((item) => item.id === id);
    return z ? { ...z } : null;
  }

  public async findByCode(code: string): Promise<Zone | null> {
    const db = await this.store.readAll();
    const z = db.zones.find((item) => item.code.toUpperCase() === code.trim().toUpperCase());
    return z ? { ...z } : null;
  }

  public async list(filter?: { status?: string }): Promise<Zone[]> {
    const db = await this.store.readAll();
    let zones = db.zones;
    if (filter?.status && filter.status !== 'ALL') {
      zones = zones.filter((z) => z.status === filter.status);
    }
    return zones.map((z) => ({ ...z }));
  }

  public async create(zone: Zone): Promise<Zone> {
    return this.store.withTransaction('ZONE_CREATE', (db) => {
      const exists = db.zones.some((z) => z.code.toUpperCase() === zone.code.toUpperCase());
      if (exists) {
        throw new AppError(409, 'DUPLICATE_ZONE', `Zone with code "${zone.code}" already exists.`);
      }
      db.zones.push(zone);
      return { ...zone };
    });
  }

  public async update(id: string, updates: Partial<Zone>): Promise<Zone> {
    return this.store.withTransaction('ZONE_UPDATE', (db) => {
      const idx = db.zones.findIndex((z) => z.id === id);
      if (idx === -1) {
        throw new AppError(404, 'ZONE_NOT_FOUND', `Zone with ID "${id}" does not exist.`);
      }
      const updated = { ...db.zones[idx], ...updates };
      db.zones[idx] = updated;
      return { ...updated };
    });
  }
}

export class ClosingRepository implements IClosingRepository {
  constructor(private readonly store: IDataStore) {}

  public async findById(id: string): Promise<DailyClosingRecord | null> {
    const db = await this.store.readAll();
    const c = db.closings.find((item) => item.id === id);
    return c ? { ...c } : null;
  }

  public async findByAgentAndDate(agentId: string, date: string): Promise<DailyClosingRecord | null> {
    const db = await this.store.readAll();
    const c = db.closings.find((item) => item.agentId === agentId && item.date === date);
    return c ? { ...c } : null;
  }

  public async list(filter?: {
    agentId?: string;
    date?: string;
    status?: string;
    wardCode?: string;
  }): Promise<DailyClosingRecord[]> {
    const db = await this.store.readAll();
    let closings = db.closings;
    if (filter?.agentId) {
      closings = closings.filter((c) => c.agentId === filter.agentId);
    }
    if (filter?.date) {
      closings = closings.filter((c) => c.date === filter.date);
    }
    if (filter?.status && filter.status !== 'ALL') {
      closings = closings.filter((c) => c.status === filter.status);
    }
    return closings.map((c) => ({ ...c }));
  }

  public async create(closing: DailyClosingRecord): Promise<DailyClosingRecord> {
    return this.store.withTransaction('CLOSING_CREATE', (db) => {
      db.closings.unshift(closing);
      return { ...closing };
    });
  }

  public async update(id: string, updates: Partial<DailyClosingRecord>): Promise<DailyClosingRecord> {
    return this.store.withTransaction('CLOSING_UPDATE', (db) => {
      const idx = db.closings.findIndex((c) => c.id === id);
      if (idx === -1) {
        throw new AppError(404, 'CLOSING_NOT_FOUND', `Closing with ID "${id}" does not exist.`);
      }
      const updated = { ...db.closings[idx], ...updates };
      db.closings[idx] = updated;
      return { ...updated };
    });
  }
}

export class ReconciliationRepository implements IReconciliationRepository {
  constructor(private readonly store: IDataStore) {}

  public async findById(id: string): Promise<ReconciliationItem | null> {
    const db = await this.store.readAll();
    const r = db.reconciliations.find((item) => item.id === id);
    return r ? { ...r } : null;
  }

  public async findByGatewayOrderId(orderId: string): Promise<ReconciliationItem | null> {
    const db = await this.store.readAll();
    const r = db.reconciliations.find((item) => item.gatewayOrderId === orderId);
    return r ? { ...r } : null;
  }

  public async list(filter?: { status?: string; gateway?: string }): Promise<ReconciliationItem[]> {
    const db = await this.store.readAll();
    let items = db.reconciliations;
    if (filter?.status && filter.status !== 'ALL') {
      items = items.filter((item) => item.status === filter.status);
    }
    if (filter?.gateway && filter.gateway !== 'ALL') {
      items = items.filter((item) => item.gatewayProvider === filter.gateway);
    }
    return items.map((item) => ({ ...item }));
  }

  public async create(item: ReconciliationItem): Promise<ReconciliationItem> {
    return this.store.withTransaction('RECONCILIATION_CREATE', (db) => {
      db.reconciliations.unshift(item);
      return { ...item };
    });
  }

  public async update(id: string, updates: Partial<ReconciliationItem>): Promise<ReconciliationItem> {
    return this.store.withTransaction('RECONCILIATION_UPDATE', (db) => {
      const idx = db.reconciliations.findIndex((item) => item.id === id);
      if (idx === -1) {
        throw new AppError(404, 'RECONCILIATION_NOT_FOUND', `Item with ID "${id}" does not exist.`);
      }
      const updated = { ...db.reconciliations[idx], ...updates };
      db.reconciliations[idx] = updated;
      return { ...updated };
    });
  }
}

export class DisputeRepository implements IDisputeRepository {
  constructor(private readonly store: IDataStore) {}

  public async findById(id: string): Promise<RefundDisputeRecord | null> {
    const db = await this.store.readAll();
    const d = db.disputes.find((item) => item.id === id);
    return d ? { ...d } : null;
  }

  public async findByPaymentId(paymentId: string): Promise<RefundDisputeRecord | null> {
    const db = await this.store.readAll();
    const d = db.disputes.find((item) => item.paymentId === paymentId);
    return d ? { ...d } : null;
  }

  public async list(filter?: { status?: string; entityId?: string }): Promise<RefundDisputeRecord[]> {
    const db = await this.store.readAll();
    let disputes = db.disputes;
    if (filter?.status && filter.status !== 'ALL') {
      disputes = disputes.filter((d) => d.status === filter.status);
    }
    return disputes.map((d) => ({ ...d }));
  }

  public async create(dispute: RefundDisputeRecord): Promise<RefundDisputeRecord> {
    return this.store.withTransaction('DISPUTE_CREATE', (db) => {
      db.disputes.unshift(dispute);
      return { ...dispute };
    });
  }

  public async update(id: string, updates: Partial<RefundDisputeRecord>): Promise<RefundDisputeRecord> {
    return this.store.withTransaction('DISPUTE_UPDATE', (db) => {
      const idx = db.disputes.findIndex((d) => d.id === id);
      if (idx === -1) {
        throw new AppError(404, 'DISPUTE_NOT_FOUND', `Dispute with ID "${id}" does not exist.`);
      }
      const updated = { ...db.disputes[idx], ...updates };
      db.disputes[idx] = updated;
      return { ...updated };
    });
  }
}

export class AuditLogRepository implements IAuditLogRepository {
  constructor(private readonly store: IDataStore) {}

  public async create(entry: AuditLogEntry): Promise<AuditLogEntry> {
    return this.store.withTransaction('AUDIT_LOG_CREATE', (db) => {
      db.auditLogs.unshift(entry);
      return { ...entry };
    });
  }

  public async list(filter?: {
    entityId?: string;
    entityType?: string;
    actorRole?: string;
    correlationId?: string;
    module?: string;
  }): Promise<AuditLogEntry[]> {
    const db = await this.store.readAll();
    let logs = db.auditLogs;
    if (filter?.entityId) {
      logs = logs.filter((l) => l.entityId === filter.entityId);
    }
    if (filter?.actorRole) {
      logs = logs.filter((l) => l.actorRole === filter.actorRole);
    }
    if (filter?.correlationId) {
      logs = logs.filter((l) => l.correlationId === filter.correlationId);
    }
    if (filter?.module) {
      logs = logs.filter((l) => l.module === filter.module);
    }
    return logs.map((l) => ({ ...l }));
  }
}

export class NotificationRepository implements INotificationRepository {
  constructor(private readonly store: IDataStore) {}

  public async create(notification: NotificationLog): Promise<NotificationLog> {
    return this.store.withTransaction('NOTIFICATION_CREATE', (db) => {
      db.notifications.unshift(notification);
      return { ...notification };
    });
  }

  public async list(filter?: {
    status?: string;
    recipientMobile?: string;
    channel?: string;
  }): Promise<NotificationLog[]> {
    const db = await this.store.readAll();
    let notifs = db.notifications;
    if (filter?.status && filter.status !== 'ALL') {
      notifs = notifs.filter((n) => n.status === filter.status);
    }
    if (filter?.recipientMobile) {
      notifs = notifs.filter((n) => n.recipientMobile === filter.recipientMobile);
    }
    if (filter?.channel) {
      notifs = notifs.filter((n) => n.channel === filter.channel);
    }
    return notifs.map((n) => ({ ...n }));
  }

  public async update(id: string, updates: Partial<NotificationLog>): Promise<NotificationLog> {
    return this.store.withTransaction('NOTIFICATION_UPDATE', (db) => {
      const idx = db.notifications.findIndex((n) => n.id === id);
      if (idx === -1) {
        throw new AppError(404, 'NOTIFICATION_NOT_FOUND', `Notification "${id}" not found.`);
      }
      const updated = { ...db.notifications[idx], ...updates };
      db.notifications[idx] = updated;
      return { ...updated };
    });
  }
}

export class SettingsRepository implements ISettingsRepository {
  constructor(private readonly store: IDataStore) {}

  public async get(): Promise<SystemSettingsRecord> {
    const db = await this.store.readAll();
    return { ...db.settings };
  }

  public async update(updates: Partial<SystemSettingsRecord>): Promise<SystemSettingsRecord> {
    return this.store.withTransaction('SETTINGS_UPDATE', (db) => {
      const updated = { ...db.settings, ...updates, updatedAt: new Date().toISOString() };
      db.settings = updated;
      return { ...updated };
    });
  }
}

export class VerificationRepository implements IVerificationRepository {
  constructor(private readonly store: IDataStore) {}

  public async findById(id: string): Promise<GovVerificationRecord | null> {
    const db = await this.store.readAll();
    const v = db.verifications.find((item) => item.id === id);
    return v ? { ...v } : null;
  }

  public async findByRegistrationNumber(regNo: string): Promise<GovVerificationRecord | null> {
    const db = await this.store.readAll();
    const clean = regNo.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const v = db.verifications.find(
      (item) => item.registrationNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() === clean
    );
    return v ? { ...v } : null;
  }

  public async findByEntityId(entityId: string): Promise<GovVerificationRecord | null> {
    const db = await this.store.readAll();
    const v = db.verifications.find((item) => item.entityId === entityId);
    return v ? { ...v } : null;
  }

  public async list(filter?: { status?: string; provider?: string }): Promise<GovVerificationRecord[]> {
    const db = await this.store.readAll();
    let verifs = db.verifications;
    if (filter?.status && filter.status !== 'ALL') {
      verifs = verifs.filter((v) => v.status === filter.status);
    }
    if (filter?.provider) {
      verifs = verifs.filter((v) => v.provider === filter.provider);
    }
    return verifs.map((v) => ({ ...v }));
  }

  public async create(record: GovVerificationRecord): Promise<GovVerificationRecord> {
    return this.store.withTransaction('VERIFICATION_CREATE', (db) => {
      db.verifications.unshift(record);
      return { ...record };
    });
  }

  public async update(id: string, updates: Partial<GovVerificationRecord>): Promise<GovVerificationRecord> {
    return this.store.withTransaction('VERIFICATION_UPDATE', (db) => {
      const idx = db.verifications.findIndex((v) => v.id === id);
      if (idx === -1) {
        throw new AppError(404, 'VERIFICATION_NOT_FOUND', `Verification record "${id}" not found.`);
      }
      const updated = { ...db.verifications[idx], ...updates, updatedAt: new Date().toISOString() };
      db.verifications[idx] = updated;
      return { ...updated };
    });
  }
}

export class ImportRepository implements IImportRepository {
  constructor(private readonly store: IDataStore) {}

  public async findById(id: string): Promise<ImportBatchRecord | null> {
    const db = await this.store.readAll();
    const imp = db.imports.find((item) => item.id === id);
    return imp ? { ...imp } : null;
  }

  public async list(filter?: { status?: string; importType?: string }): Promise<ImportBatchRecord[]> {
    const db = await this.store.readAll();
    let imports = db.imports;
    if (filter?.status && filter.status !== 'ALL') {
      imports = imports.filter((i) => i.status === filter.status);
    }
    if (filter?.importType) {
      imports = imports.filter((i) => i.importType === filter.importType);
    }
    return imports.map((i) => ({ ...i }));
  }

  public async create(record: ImportBatchRecord): Promise<ImportBatchRecord> {
    return this.store.withTransaction('IMPORT_CREATE', (db) => {
      db.imports.unshift(record);
      return { ...record };
    });
  }

  public async update(id: string, updates: Partial<ImportBatchRecord>): Promise<ImportBatchRecord> {
    return this.store.withTransaction('IMPORT_UPDATE', (db) => {
      const idx = db.imports.findIndex((i) => i.id === id);
      if (idx === -1) {
        throw new AppError(404, 'IMPORT_NOT_FOUND', `Import batch "${id}" not found.`);
      }
      const updated = { ...db.imports[idx], ...updates };
      db.imports[idx] = updated;
      return { ...updated };
    });
  }
}

export interface DomainRepositories {
  users: UserRepository;
  entities: EntityRepository;
  dues: DueRepository;
  payments: PaymentRepository;
  receipts: ReceiptRepository;
  rates: RateRepository;
  wards: WardRepository;
  zones: ZoneRepository;
  closings: ClosingRepository;
  reconciliations: ReconciliationRepository;
  disputes: DisputeRepository;
  auditLogs: AuditLogRepository;
  notifications: NotificationRepository;
  settings: SettingsRepository;
  verifications: VerificationRepository;
  imports: ImportRepository;
}

export function createRepositories(store: IDataStore): DomainRepositories {
  return {
    users: new UserRepository(store),
    entities: new EntityRepository(store),
    dues: new DueRepository(store),
    payments: new PaymentRepository(store),
    receipts: new ReceiptRepository(store),
    rates: new RateRepository(store),
    wards: new WardRepository(store),
    zones: new ZoneRepository(store),
    closings: new ClosingRepository(store),
    reconciliations: new ReconciliationRepository(store),
    disputes: new DisputeRepository(store),
    auditLogs: new AuditLogRepository(store),
    notifications: new NotificationRepository(store),
    settings: new SettingsRepository(store),
    verifications: new VerificationRepository(store),
    imports: new ImportRepository(store),
  };
}
