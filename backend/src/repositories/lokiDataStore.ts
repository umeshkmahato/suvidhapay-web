import fs from 'fs';
import path from 'path';
import loki from 'lokijs';
import {
  IDataStore,
  SuvidhaDataCollections,
  BackendUserRecord,
  RefreshSessionRecord,
  PasswordResetTokenRecord,
  IdempotencyRecord,
  NotificationTemplateRecord,
  GovVerificationRecord,
  ImportBatchRecord,
  SystemSettingsRecord,
} from './interfaces';
import {
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
  NotificationLog,
  AuditLogEntry,
} from '../types/suvidha';
import { generateDeterministicSeed } from '../db/seedData';

export interface LokiStoreOptions {
  persistence?: 'disk' | 'memory';
}

/**
 * LokiDataStore — Database-Independent LokiJS Storage Engine (Sections 3, 4, 15)
 *
 * Provides an in-memory document database with indexing, fast query capabilities,
 * and periodic/on-demand persistence to disk via LokiFsAdapter.
 *
 * Implements IDataStore so controllers and domain services can transition seamlessly
 * between JSON file storage, LokiJS, and future PostgreSQL implementations without
 * modifying any business logic or signatures.
 *
 * Metadata Boundary:
 * All returned documents have `$loki` and `meta` completely stripped, ensuring zero
 * leak of LokiJS internal document pointers or revision numbers to callers.
 */
export class LokiDataStore implements IDataStore {
  private db: loki | null = null;
  private readonly dbFilePath: string;
  private initialized = false;
  private transactionQueue: Promise<unknown> = Promise.resolve();
  private readonly persistenceMode: 'disk' | 'memory';

  constructor(
    private readonly dataDir: string,
    options?: LokiStoreOptions
  ) {
    this.persistenceMode = options?.persistence || 'disk';
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    this.dbFilePath = path.join(this.dataDir, 'suvidha_loki.db.json');
  }

  public getDataDir(): string {
    return this.dataDir;
  }

  public getDbFilePath(): string {
    return this.dbFilePath;
  }

  public getPersistenceMode(): 'disk' | 'memory' {
    return this.persistenceMode;
  }

  /**
   * Initializes LokiJS database instance with LokiFsAdapter (or in-memory if requested).
   */
  private async initDb(): Promise<loki> {
    if (this.db && this.initialized) {
      return this.db;
    }

    if (this.persistenceMode === 'memory') {
      const dbInstance = new loki('suvidha_memory.db');
      this.ensureCollections(dbInstance);
      this.db = dbInstance;
      this.initialized = true;
      return dbInstance;
    }

    const adapter = new loki.LokiFsAdapter();
    return new Promise<loki>((resolve, reject) => {
      const dbInstance = new loki(this.dbFilePath, {
        adapter,
        autoload: fs.existsSync(this.dbFilePath),
        autoloadCallback: (err) => {
          if (err) {
            return reject(err);
          }
          this.ensureCollections(dbInstance);
          this.db = dbInstance;
          this.initialized = true;
          resolve(dbInstance);
        },
        autosave: true,
        autosaveInterval: 4000,
      });

      if (!fs.existsSync(this.dbFilePath)) {
        this.ensureCollections(dbInstance);
        this.db = dbInstance;
        this.initialized = true;
        resolve(dbInstance);
      }
    });
  }

  /**
   * Ensures all 22 required municipal collections and their indices exist.
   */
  private ensureCollections(db: loki): void {
    const defineCol = <T extends object>(
      name: string,
      indices: string[] = [],
      unique: string[] = []
    ): Collection<T> => {
      let col = db.getCollection<T>(name);
      if (!col) {
        col = db.addCollection<T>(name, {
          indices: indices as unknown as (keyof T)[],
          unique: unique as unknown as (keyof T)[],
          autoupdate: true,
        });
      }
      return col;
    };

    defineCol<BackendUserRecord>('users', ['id', 'loginIdentifier', 'mobile', 'role', 'status'], ['loginIdentifier']);
    defineCol<RefreshSessionRecord>('sessions', ['jti', 'userId', 'expiresAt'], ['jti']);
    defineCol<PasswordResetTokenRecord>('resetTokens', ['token', 'userId'], ['token']);
    defineCol<Ward>('wards', ['id', 'code', 'zoneId', 'status'], ['code']);
    defineCol<Zone>('zones', ['id', 'code', 'status'], ['code']);
    defineCol<EntityCategory>('categories', ['id', 'code', 'entityType', 'status'], ['code']);
    defineCol<RateMaster>('rates', ['id', 'categoryId', 'status', 'effectiveFrom'], ['id']);
    defineCol<MunicipalEntity>('entities', ['id', 'normalizedIdentifier', 'wardId', 'mobile', 'registrationStatus'], ['normalizedIdentifier']);
    defineCol<DueRecord>('dues', ['id', 'entityId', 'rateId', 'status', 'periodStart'], ['id']);
    defineCol<DueAdjustment>('adjustments', ['id', 'dueId', 'entityId', 'approvalStatus'], ['id']);
    defineCol<PaymentRecord>('payments', ['id', 'entityId', 'settlementStatus', 'method', 'receiptId', 'collectedBy'], ['id']);
    defineCol<ReceiptRecord>('receipts', ['id', 'receiptNumber', 'paymentId', 'entityId', 'verificationCode'], ['receiptNumber', 'verificationCode']);
    defineCol<DailyClosingRecord>('closings', ['id', 'agentId', 'date', 'status'], ['id']);
    defineCol<ReconciliationItem>('reconciliations', ['id', 'gatewayOrderId', 'status'], ['id']);
    defineCol<RefundDisputeRecord>('disputes', ['id', 'paymentId', 'status'], ['id']);
    defineCol<NotificationLog>('notifications', ['id', 'correlationId', 'status', 'recipientMobile'], ['id']);
    defineCol<NotificationTemplateRecord>('notificationTemplates', ['id', 'eventType', 'active'], ['id']);
    defineCol<GovVerificationRecord>('verifications', ['id', 'entityId', 'registrationNumber', 'status'], ['id']);
    defineCol<AuditLogEntry>('auditLogs', ['id', 'correlationId', 'entityId', 'actorRole', 'timestamp'], ['id']);
    defineCol<ImportBatchRecord>('imports', ['id', 'status', 'importType'], ['id']);
    defineCol<IdempotencyRecord>('idempotencyKeys', ['key', 'endpoint', 'actorId'], ['key']);
    defineCol<SystemSettingsRecord>('settings', ['currency']);
  }

  /**
   * Helper to strip internal Loki metadata properties ($loki, meta)
   */
  public cleanDocument<T>(doc: T): T {
    if (!doc || typeof doc !== 'object') return doc;
    const clone = { ...doc } as Record<string, unknown>;
    delete clone['$loki'];
    delete clone['meta'];
    return clone as T;
  }

  private cleanCollection<T extends object>(colName: string): T[] {
    const db = this.db!;
    const col = db.getCollection<T>(colName);
    if (!col) return [];
    return col.data.map((d) => this.cleanDocument<T>(d));
  }

  public async readAll(): Promise<SuvidhaDataCollections> {
    await this.initDb();
    const settingsCol = this.db!.getCollection<SystemSettingsRecord>('settings');
    const settingsDoc = settingsCol?.data[0]
      ? this.cleanDocument<SystemSettingsRecord>(settingsCol.data[0])
      : generateDeterministicSeed().settings;

    return {
      users: this.cleanCollection<BackendUserRecord>('users'),
      sessions: this.cleanCollection<RefreshSessionRecord>('sessions'),
      resetTokens: this.cleanCollection<PasswordResetTokenRecord>('resetTokens'),
      wards: this.cleanCollection<Ward>('wards'),
      zones: this.cleanCollection<Zone>('zones'),
      categories: this.cleanCollection<EntityCategory>('categories'),
      rates: this.cleanCollection<RateMaster>('rates'),
      entities: this.cleanCollection<MunicipalEntity>('entities'),
      dues: this.cleanCollection<DueRecord>('dues'),
      adjustments: this.cleanCollection<DueAdjustment>('adjustments'),
      payments: this.cleanCollection<PaymentRecord>('payments'),
      receipts: this.cleanCollection<ReceiptRecord>('receipts'),
      closings: this.cleanCollection<DailyClosingRecord>('closings'),
      reconciliations: this.cleanCollection<ReconciliationItem>('reconciliations'),
      disputes: this.cleanCollection<RefundDisputeRecord>('disputes'),
      notifications: this.cleanCollection<NotificationLog>('notifications'),
      notificationTemplates: this.cleanCollection<NotificationTemplateRecord>('notificationTemplates'),
      verifications: this.cleanCollection<GovVerificationRecord>('verifications'),
      auditLogs: this.cleanCollection<AuditLogEntry>('auditLogs'),
      imports: this.cleanCollection<ImportBatchRecord>('imports'),
      idempotencyKeys: this.cleanCollection<IdempotencyRecord>('idempotencyKeys'),
      settings: settingsDoc,
    };
  }

  /**
   * Executes a unit of work serialized through an in-process queue,
   * providing read-modify-write transactional semantics.
   */
  public async withTransaction<R>(
    _operationName: string,
    fn: (collections: SuvidhaDataCollections) => Promise<R> | R
  ): Promise<R> {
    await this.initDb();

    const run = async (): Promise<R> => {
      const collections = await this.readAll();
      const result = await fn(collections);
      await this.saveAllCollections(collections);
      return result;
    };

    const nextPromise = this.transactionQueue.then(run, run);
    this.transactionQueue = nextPromise.catch(() => {});
    return nextPromise;
  }

  /**
   * Synchronizes an updated SuvidhaDataCollections snapshot back into Loki collections and saves to disk.
   */
  private async saveAllCollections(collections: SuvidhaDataCollections): Promise<void> {
    const db = this.db!;

    const syncCollection = <T extends object>(
      name: string,
      items: T[]
    ) => {
      let col = db.getCollection<T>(name);
      if (!col) {
        col = db.addCollection<T>(name);
      }
      col.clear();
      for (const item of items) {
        col.insert(this.cleanDocument({ ...item }));
      }
    };

    syncCollection('users', collections.users);
    syncCollection('sessions', collections.sessions);
    syncCollection('resetTokens', collections.resetTokens);
    syncCollection('wards', collections.wards);
    syncCollection('zones', collections.zones);
    syncCollection('categories', collections.categories);
    syncCollection('rates', collections.rates);
    syncCollection('entities', collections.entities);
    syncCollection('dues', collections.dues);
    syncCollection('adjustments', collections.adjustments);
    syncCollection('payments', collections.payments);
    syncCollection('receipts', collections.receipts);
    syncCollection('closings', collections.closings);
    syncCollection('reconciliations', collections.reconciliations);
    syncCollection('disputes', collections.disputes);
    syncCollection('notifications', collections.notifications);
    syncCollection('notificationTemplates', collections.notificationTemplates);
    syncCollection('verifications', collections.verifications);
    syncCollection('auditLogs', collections.auditLogs);
    syncCollection('imports', collections.imports);
    syncCollection('idempotencyKeys', collections.idempotencyKeys);

    let settingsCol = db.getCollection<SystemSettingsRecord>('settings');
    if (!settingsCol) {
      settingsCol = db.addCollection<SystemSettingsRecord>('settings');
    }
    settingsCol.clear();
    settingsCol.insert(this.cleanDocument({ ...collections.settings }));

    if (this.persistenceMode === 'disk') {
      await this.saveDatabase();
    }
  }

  public async saveDatabase(): Promise<void> {
    if (!this.db || this.persistenceMode !== 'disk') return;
    return new Promise<void>((resolve, reject) => {
      this.db!.saveDatabase((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  public async seedIfEmpty(): Promise<void> {
    await this.initDb();
    const usersCol = this.db!.getCollection<BackendUserRecord>('users');
    if (!usersCol || usersCol.count() === 0) {
      await this.resetToDeterministicSeed();
    }
  }

  public async resetToDeterministicSeed(): Promise<void> {
    await this.initDb();
    const seed = generateDeterministicSeed();
    await this.saveAllCollections(seed);
  }

  public async close(): Promise<void> {
    if (this.db) {
      try {
        this.db.autosaveDisable();
      } catch {}
      if (this.persistenceMode === 'disk') {
        await this.saveDatabase();
      }
    }
  }
}
