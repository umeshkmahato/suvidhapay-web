import dotenv from 'dotenv';
import { loadConfig } from '../infra/core';
import { JsonFileDataStore } from '../repositories/jsonDataStore';
import { LokiDataStore } from '../repositories/lokiDataStore';

dotenv.config();

async function runCli() {
  const mode = process.argv[2] || 'seed';
  const config = loadConfig();
  const jsonStore = new JsonFileDataStore(config.dataDir);
  const lokiStore = new LokiDataStore(config.dataDir);

  if (mode === 'reset') {
    await jsonStore.resetToDeterministicSeed();
    await lokiStore.resetToDeterministicSeed();
    console.log(
      `[SuvidhaPay Seed] Data stores (JSON & LokiJS) in ${config.dataDir} reset to deterministic seed state.`
    );
  } else {
    await jsonStore.seedIfEmpty();
    await lokiStore.seedIfEmpty();
    console.log(
      `[SuvidhaPay Seed] Data stores (JSON & LokiJS) in ${config.dataDir} verified/seeded without overwriting existing records.`
    );
  }
  await lokiStore.close();
  process.exit(0);
}

runCli().catch((err) => {
  console.error('[SuvidhaPay Seed] Error:', err);
  process.exit(1);
});
