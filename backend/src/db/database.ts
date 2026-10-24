import { IDataStore } from '../repositories/interfaces';
import { PostgresDataStore } from './postgresDataStore';
import { loadConfig, DatabaseEngine } from '../infra/core';

export interface DatabaseConfig {
  dataDir?: string;
  engine?: DatabaseEngine;
  connectionString?: string;
}

export interface DatabaseHealth {
  status: 'HEALTHY' | 'DOWN';
  storageEngine: 'POSTGRESQL';
  persistenceMode: 'postgres';
  initialized: boolean;
  timestamp: string;
}

export class DatabaseManager {
  private static instance: DatabaseManager | null = null;
  private store: PostgresDataStore | null = null;
  private initializing: Promise<IDataStore> | null = null;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    return DatabaseManager.instance ??= new DatabaseManager();
  }

  public async initialize(customConfig?: Partial<DatabaseConfig>): Promise<IDataStore> {
    if (this.store) return this.store;
    if (this.initializing) return this.initializing;
    this.initializing = this.open(customConfig);
    try {
      return await this.initializing;
    } finally {
      this.initializing = null;
    }
  }

  private async open(customConfig?: Partial<DatabaseConfig>): Promise<IDataStore> {
    const config = loadConfig();
    const store = new PostgresDataStore({
      connectionString: customConfig?.connectionString || config.databaseUrl,
      poolConfig: {
        host: config.pgHost,
        port: config.pgPort,
        database: config.pgDatabase,
        user: config.pgUser,
        password: config.pgPassword,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 3000,
      },
      autoMigrate: true,
      autoSeed: config.demoMode,
    });
    try {
      await store.initialize();
      this.store = store;
      return store;
    } catch (err) {
      await store.close();
      throw err;
    }
  }

  public getStore(): IDataStore {
    if (!this.store) throw new Error('Database has not been initialized');
    return this.store;
  }

  public getActiveEngine(): 'POSTGRESQL' {
    return 'POSTGRESQL';
  }

  public async getHealth(): Promise<DatabaseHealth> {
    let healthy = false;
    if (this.store) {
      try {
        await this.store.getPool().query('SELECT 1');
        healthy = true;
      } catch {}
    }
    return {
      status: healthy ? 'HEALTHY' : 'DOWN',
      storageEngine: 'POSTGRESQL',
      persistenceMode: 'postgres',
      initialized: Boolean(this.store),
      timestamp: new Date().toISOString(),
    };
  }

  public async close(): Promise<void> {
    if (this.initializing) await this.initializing.catch(() => undefined);
    if (this.store) {
      await this.store.close();
      this.store = null;
    }
  }
}

export async function initDatabase(config?: Partial<DatabaseConfig>): Promise<IDataStore> {
  return DatabaseManager.getInstance().initialize(config);
}

export async function closeDatabase(): Promise<void> {
  await DatabaseManager.getInstance().close();
}
