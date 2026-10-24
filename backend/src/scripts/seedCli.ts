import dotenv from 'dotenv';
import { loadConfig } from '../infra/core';
import { DatabaseManager } from '../db/database';

dotenv.config();

async function runCli() {
  const mode = process.argv[2] || 'seed';
  const config = loadConfig();
  if (!config.demoMode || config.nodeEnv === 'production') {
    throw new Error('Demo seeding requires explicit non-production SUVIDHAPAY_DEMO_MODE=true');
  }
  if (mode !== 'seed') {
    throw new Error('Automatic database reset is unavailable; preserve existing records');
  }
  const manager = DatabaseManager.getInstance();
  try {
    const store = await manager.initialize();
    await store.seedIfEmpty();
    console.log('[SuvidhaPay CLI] PostgreSQL demo seed completed.');
  } finally {
    await manager.close();
  }
}

runCli().catch(() => {
  console.error('[SuvidhaPay CLI] Seed failed; no fallback store was created.');
  process.exitCode = 1;
});
