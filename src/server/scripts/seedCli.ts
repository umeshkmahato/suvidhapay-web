import dotenv from 'dotenv';
import { loadConfig } from '../infra/core';
import { DatabaseManager } from '../db/database';
import { JsonFileDataStore } from '../repositories/jsonDataStore';
import { LokiDataStore } from '../repositories/lokiDataStore';
import { seedCollectionsIfEmpty, resetDatabaseToSeed } from '../db/seedData';
import { validatePostgresSeed } from '../db/postgresSeed';

dotenv.config();

async function runCli() {
  const mode = process.argv[2] || 'seed';
  const config = loadConfig();

  console.log(
    `[SuvidhaPay CLI] Running seed task in mode: "${mode}" with target engine: "${config.databaseEngine}"`
  );

  if (mode === 'reset' && process.env.NODE_ENV === 'production') {
    console.error('[SuvidhaPay CLI] ERROR: Cannot reset database in production mode!');
    process.exit(1);
  }

  // 1. If PostgreSQL engine is requested, seed via DatabaseManager / PostgresDataStore
  if (config.databaseEngine === 'POSTGRES') {
    try {
      const dbManager = DatabaseManager.getInstance();
      const store = await dbManager.initialize();
      const activeEngine = dbManager.getActiveEngine();

      if (activeEngine === 'POSTGRESQL') {
        const pool = (store as any).getPool ? (store as any).getPool() : null;
        if (mode === 'reset') {
          await store.resetToDeterministicSeed();
          console.log('[SuvidhaPay CLI] SUCCESS: PostgreSQL database reset to fresh deterministic seed.');
        } else {
          await store.seedIfEmpty();
          console.log('[SuvidhaPay CLI] SUCCESS: PostgreSQL database seed verified.');
        }

        if (pool) {
          const val = await validatePostgresSeed(pool);
          console.log('[SuvidhaPay CLI] Validation Summary:', {
            valid: val.valid,
            totalUsers: val.counts.system_users,
            totalEntities: val.counts.municipal_entities,
            totalDues: val.counts.due_records,
            totalPayments: val.counts.payment_records,
            totalReceipts: val.counts.receipt_records,
          });
        }

        await dbManager.close();
        process.exit(0);
      }
    } catch (pgErr) {
      console.warn(
        `[SuvidhaPay CLI] PostgreSQL seed failed (${(pgErr as Error).message}). Seeding local file stores...`
      );
    }
  }

  // 2. Local fallback stores
  const lokiStore = new LokiDataStore(config.dataDir, { persistence: 'disk' });
  const jsonStore = new JsonFileDataStore(config.dataDir);

  if (mode === 'reset') {
    await resetDatabaseToSeed(lokiStore, true);
    await resetDatabaseToSeed(jsonStore, true);
    console.log(
      `[SuvidhaPay CLI] SUCCESS: Local data stores in "${config.dataDir}" reset to fresh deterministic seed data.`
    );
  } else {
    const lokiSeeded = await seedCollectionsIfEmpty(lokiStore);
    const jsonSeeded = await seedCollectionsIfEmpty(jsonStore);
    if (lokiSeeded || jsonSeeded) {
      console.log(
        `[SuvidhaPay CLI] SUCCESS: Unpopulated collections seeded with deterministic municipal dataset.`
      );
    } else {
      console.log(
        `[SuvidhaPay CLI] INFO: Collections already populated. Preserving existing records without duplication.`
      );
    }
  }

  await lokiStore.close();
  process.exit(0);
}

runCli().catch((err) => {
  console.error('[SuvidhaPay CLI] Error executing seed CLI:', err);
  process.exit(1);
});
