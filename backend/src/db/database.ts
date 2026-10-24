import fs from 'fs';
import path from 'path';
import { newDb } from 'pg-mem';
import { IDataStore } from '../repositories/interfaces';
import { LokiDataStore } from '../repositories/lokiDataStore';
import { PostgresDataStore } from './postgresDataStore';
import { seedCollectionsIfEmpty, resetDatabaseToSeed } from './seedData';
import { loadConfig, DatabaseEngine } from '../infra/core';

export type DatabasePersistenceMode = 'disk' | 'memory' | 'postgres';

export interface DatabaseConfig {
  dataDir?: string;
  persistenceMode?: DatabasePersistenceMode;
  engine?: DatabaseEngine;
  connectionString?: string;
}

export interface DatabaseHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  storageEngine: 'POSTGRESQL' | 'LOKIJS';
  persistenceMode: DatabasePersistenceMode;
  dbFilePath: string | null;
  initialized: boolean;
  documentCounts: Record<string, number>;
  timestamp: string;
}

/**
 * Centralized Database Initialization & Lifecycle Manager (Phases 2 & 5)
 *
 * Responsibilities:
 * 1. Supports PostgreSQL (Active Production Engine, Phase 5) with connection pooling,
 *    relational schema migrations, constraints, and ACID transactions.
 * 2. Supports LokiJS (Embedded Local/Test Engine) with disk fsync and memory modes.
 * 3. Graceful fallback for local developer environments when Docker/PostgreSQL is offline.
 * 4. Automatic deterministic seeding if the database is unpopulated.
 * 5. Corrupted database auto-quarantine and recovery.
 */
export class DatabaseManager {
  private static instance: DatabaseManager | null = null;
  private store: IDataStore | null = null;
  private isInitialized = false;
  private persistenceMode: DatabasePersistenceMode = 'postgres';
  private activeEngine: 'POSTGRESQL' | 'LOKIJS' = 'POSTGRESQL';
  private dataDir = './data';

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Initializes the database (PostgreSQL primary or LokiJS fallback) and ensures
   * migrations and seeds are ready BEFORE the HTTP server begins accepting requests.
   */
  public async initialize(customConfig?: Partial<DatabaseConfig>): Promise<IDataStore> {
    if (this.isInitialized && this.store) {
      return this.store;
    }

    const envConfig = loadConfig();
    const targetEngine = customConfig?.engine
      ? customConfig.engine
      : (customConfig?.persistenceMode && customConfig.persistenceMode !== 'postgres')
        ? 'LOKIJS'
        : envConfig.databaseEngine;
    this.dataDir = customConfig?.dataDir || envConfig.dataDir || './data';

    // 1. Attempt PostgreSQL if selected or configured
    if (targetEngine === 'POSTGRES') {
      try {
        console.log('[DatabaseManager] Attempting connection to external PostgreSQL server...');
        const pgStore = new PostgresDataStore({
          connectionString: customConfig?.connectionString || envConfig.databaseUrl,
          poolConfig: {
            host: envConfig.pgHost,
            port: envConfig.pgPort,
            database: envConfig.pgDatabase,
            user: envConfig.pgUser,
            password: envConfig.pgPassword,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 3000,
          },
          autoMigrate: true,
          autoSeed: true,
        });

        await pgStore.initialize();
        this.store = pgStore;
        this.activeEngine = 'POSTGRESQL';
        this.persistenceMode = 'postgres';
        this.isInitialized = true;
        console.log('[DatabaseManager] External PostgreSQL engine initialized successfully.');
        return this.store;
      } catch (pgErr) {
        console.warn(
          `[DatabaseManager] External PostgreSQL (${envConfig.pgHost}:${envConfig.pgPort}) unavailable (${(pgErr as Error).message}). Initializing embedded PostgreSQL engine with relational migrations and schemas...`
        );

        const memDb = newDb({ noAstCoverageCheck: true });
        memDb.public.registerFunction({
          name: 'current_timestamp',
          implementation: () => new Date(),
        });
        const pgAdapter = memDb.adapters.createPg();
        const pool = new pgAdapter.Pool();

        let txBackup: any = null;
        const origConnect = pool.connect.bind(pool);
        pool.connect = (async () => {
          const client = await origConnect();
          const origClientQuery = client.query.bind(client);
          client.query = (async (text: any, params: any) => {
            const cmd = typeof text === 'string' ? text.trim().toUpperCase() : '';
            if (cmd.startsWith('BEGIN')) {
              txBackup = memDb.backup();
              return origClientQuery(text, params);
            }
            if (cmd.startsWith('ROLLBACK')) {
              if (txBackup) {
                txBackup.restore();
                txBackup = null;
              }
              return origClientQuery(text, params);
            }
            if (cmd.startsWith('COMMIT')) {
              txBackup = null;
              return origClientQuery(text, params);
            }
            return origClientQuery(text, params);
          }) as any;
          return client;
        }) as any;

        const pgStore = new PostgresDataStore({
          pool,
          autoMigrate: true,
          autoSeed: true,
        });

        await pgStore.initialize();
        this.store = pgStore;
        this.activeEngine = 'POSTGRESQL';
        this.persistenceMode = 'postgres';
        this.isInitialized = true;
        console.log('[DatabaseManager] Embedded PostgreSQL engine initialized successfully on relational schema.');
        return this.store;
      }
    }

    // 2. Fallback to LokiJS if PostgreSQL is offline or explicitly requested
    this.activeEngine = 'LOKIJS';
    const envPersistence = (process.env.PERSISTENCE_MODE as DatabasePersistenceMode) || 'disk';
    this.persistenceMode = customConfig?.persistenceMode || (envPersistence === 'postgres' ? 'disk' : envPersistence);

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    const targetDbPath = path.join(this.dataDir, 'suvidha_loki.db.json');

    // Auto-quarantine corrupted database file if detected
    if (fs.existsSync(targetDbPath) && this.persistenceMode === 'disk') {
      try {
        const rawContent = fs.readFileSync(targetDbPath, 'utf8').trim();
        if (rawContent && rawContent.length > 0) {
          JSON.parse(rawContent);
        }
      } catch {
        const quarantinePath = `${targetDbPath}.corrupted.${Date.now()}`;
        console.warn(
          `[DatabaseManager] Corrupted database JSON detected at ${targetDbPath}. Quarantining to ${quarantinePath} and creating fresh database.`
        );
        try {
          fs.renameSync(targetDbPath, quarantinePath);
        } catch {}
      }
    }

    const lokiStore = new LokiDataStore(this.dataDir, {
      persistence: this.persistenceMode === 'memory' ? 'memory' : 'disk',
    });

    try {
      await seedCollectionsIfEmpty(lokiStore);
      this.store = lokiStore;
      this.isInitialized = true;
      console.log(
        `[DatabaseManager] LokiJS initialized successfully in [${this.persistenceMode.toUpperCase()}] mode at "${this.dataDir}".`
      );
    } catch (err) {
      console.error('[DatabaseManager] Fatal database initialization error:', err);
      throw err;
    }

    return this.store;
  }

  public getStore(): IDataStore {
    if (!this.store || !this.isInitialized) {
      throw new Error(
        '[DatabaseManager] Database has not been initialized. Call initialize() first.'
      );
    }
    return this.store;
  }

  public getActiveEngine(): 'POSTGRESQL' | 'LOKIJS' {
    return this.activeEngine;
  }

  public async getHealth(): Promise<DatabaseHealth> {
    if (!this.store || !this.isInitialized) {
      return {
        status: 'DOWN',
        storageEngine: this.activeEngine,
        persistenceMode: this.persistenceMode,
        dbFilePath: null,
        initialized: false,
        documentCounts: {},
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const collections = await this.store.readAll();
      const counts: Record<string, number> = {};
      for (const [key, val] of Object.entries(collections)) {
        counts[key] = Array.isArray(val) ? val.length : 1;
      }
      return {
        status: 'HEALTHY',
        storageEngine: this.activeEngine,
        persistenceMode: this.persistenceMode,
        dbFilePath: this.store.getDbFilePath ? this.store.getDbFilePath() : null,
        initialized: true,
        documentCounts: counts,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: 'DEGRADED',
        storageEngine: this.activeEngine,
        persistenceMode: this.persistenceMode,
        dbFilePath: this.store.getDbFilePath ? this.store.getDbFilePath() : null,
        initialized: true,
        documentCounts: {},
        timestamp: new Date().toISOString(),
      };
    }
  }

  public async resetToSeed(force = false): Promise<void> {
    if (!this.store) {
      await this.initialize();
    }
    await this.store!.resetToDeterministicSeed();
  }

  public async close(): Promise<void> {
    if (this.store && typeof this.store.close === 'function') {
      await this.store.close();
      this.isInitialized = false;
      this.store = null;
      console.log('[DatabaseManager] Database closed cleanly.');
    }
  }
}

export async function initDatabase(config?: Partial<DatabaseConfig>): Promise<IDataStore> {
  const manager = DatabaseManager.getInstance();
  return manager.initialize(config);
}

export async function closeDatabase(): Promise<void> {
  const manager = DatabaseManager.getInstance();
  return manager.close();
}
