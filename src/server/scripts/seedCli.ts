import dotenv from 'dotenv';
import { loadConfig } from '../infra/core';
import { JsonFileDataStore } from '../repositories/jsonDataStore';

dotenv.config();

async function runCli() {
  const mode = process.argv[2] || 'seed';
  const config = loadConfig();
  const store = new JsonFileDataStore(config.dataDir);

  if (mode === 'reset') {
    await store.resetToDeterministicSeed();
    console.log(
      `[SuvidhaPay Seed] Data directory ${store.getDataDir()} reset to deterministic seed state.`
    );
  } else {
    await store.seedIfEmpty();
    console.log(
      `[SuvidhaPay Seed] Data directory ${store.getDataDir()} verified/seeded without overwriting existing records.`
    );
  }
}

runCli().catch((err) => {
  console.error('[SuvidhaPay Seed] Error:', err);
  process.exit(1);
});
