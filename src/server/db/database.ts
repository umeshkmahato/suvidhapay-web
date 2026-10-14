import fs from 'fs';
import path from 'path';
import { IDataStore } from '../repositories/interfaces';
import { LokiDataStore } from '../repositories/lokiDataStore';
import { seedCollectionsIfEmpty, resetDatabaseToSeed } from './seedData';
import { loadConfig } from '../infra/core';

export type DatabasePersistenceMode = 'disk' | 'memory';

export interface DatabaseConfig {
  dataDir: string;
  persistenceMode?: DatabasePersistenceMode;
}

export interface DatabaseHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  storageEngine: 'LOKIJS';
  persistenceMode: DatabasePersistenceMode;
  dbFilePath: string | null;
  initialized: boolean;
  documentCounts: Record<string, number>;
  timestamp: string;
}

/**
 * Centralized Database Initialization & Lifecycle Manager (Section 3 & Phase 2)
 *
 * Responsibilities:
 * 1. Coordinates single-point database initialization, ensuring all collections and indexes
 *    are established BEFORE the HTTP server begins accepting requests.
 * 2. Manages storage persistence mode:
 *    - 'disk' (Default): Explicit local persistence via LokiFsAdapter into `data/suvidha_loki.db.json`.
 *      Changes survive server restarts, crashes, and redeploys.
 *    - 'memory': Purely in-memory storage (useful for isolated unit tests). Documented that
 *      data will disappear when the Node.js process terminates.
 * 3. Handles initialization errors, corrupted disk databases (auto-quarantine & recovery),
 *    and graceful shutdown signals (SIGINT / SIGTERM).
 * 4. Automatic deterministic seeding if the database is unpopulated.
 */
export class DatabaseManager {
  private static instance: DatabaseManager | null = null;
  private store: LokiDataStore | null = null;
  private isInitialized = false;
  private persistenceMode: DatabasePersistenceMode = 'disk';
  private dataDir = './data';

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Initializes the centralized database and ensures collections & seeds are ready.
   * MUST be awaited before Express begins listening.
   */
  public async initialize(customConfig?: Partial<DatabaseConfig>): Promise<IDataStore> {
    if (this.isInitialized && this.store) {
      return this.store;
    }

    const envConfig = loadConfig();
    this.dataDir = customConfig?.dataDir || envConfig.dataDir || './data';
    const envPersistence = (process.env.PERSISTENCE_MODE as DatabasePersistenceMode) || 'disk';
    this.persistenceMode = customConfig?.persistenceMode || envPersistence;

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
      } catch (err) {
        const quarantinePath = `${targetDbPath}.corrupted.${Date.now()}`;
        console.warn(
          `[DatabaseManager] Corrupted database JSON detected at ${targetDbPath}. Quarantining to ${quarantinePath} and creating fresh database.`
        );
        try {
          fs.renameSync(targetDbPath, quarantinePath);
        } catch {}
      }
    }

    this.store = new LokiDataStore(this.dataDir, {
      persistence: this.persistenceMode,
    });

    try {
      // Ensure seed data is populated if empty
      await seedCollectionsIfEmpty(this.store);
      this.isInitialized = true;

      console.log(
        `[DatabaseManager] LokiJS initialized successfully in [${this.persistenceMode.toUpperCase()}] mode at "${this.dataDir}".`
      );
      if (this.persistenceMode === 'memory') {
        console.warn(
          '[DatabaseManager] NOTE: Running in memory-only mode. All data changes will disappear on process restart.'
        );
      }
    } catch (err) {
      console.error('[DatabaseManager] Fatal database initialization error:', err);
      throw err;
    }

    return this.store;
  }

  public getStore(): LokiDataStore {
    if (!this.store || !this.isInitialized) {
      throw new Error(
        '[DatabaseManager] Database has not been initialized. Call initialize() first.'
      );
    }
    return this.store;
  }

  public async getHealth(): Promise<DatabaseHealth> {
    if (!this.store || !this.isInitialized) {
      return {
        status: 'DOWN',
        storageEngine: 'LOKIJS',
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
        storageEngine: 'LOKIJS',
        persistenceMode: this.persistenceMode,
        dbFilePath: this.persistenceMode === 'disk' ? this.store.getDbFilePath() : null,
        initialized: true,
        documentCounts: counts,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        status: 'DEGRADED',
        storageEngine: 'LOKIJS',
        persistenceMode: this.persistenceMode,
        dbFilePath: this.store.getDbFilePath(),
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
    await resetDatabaseToSeed(this.store!, force);
  }

  public async close(): Promise<void> {
    if (this.store) {
      await this.store.close();
      this.isInitialized = false;
      this.store = null;
      console.log('[DatabaseManager] Database closed cleanly.');
    }
  }
}

export async function initDatabase(customConfig?: Partial<DatabaseConfig>): Promise<IDataStore> {
  return DatabaseManager.getInstance().initialize(customConfig);
}

export function getDatabase(): LokiDataStore {
  return DatabaseManager.getInstance().getStore();
}

export async function closeDatabase(): Promise<void> {
  return DatabaseManager.getInstance().close();
}
