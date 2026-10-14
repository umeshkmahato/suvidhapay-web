import dotenv from 'dotenv';
import { loadConfig } from '../infra/core';
import { JsonFileDataStore } from '../repositories/jsonDataStore';
import { LokiDataStore } from '../repositories/lokiDataStore';
import { seedCollectionsIfEmpty, resetDatabaseToSeed } from '../db/seedData';

dotenv.config();

async function runCli() {
  const mode = process.argv[2] || 'seed';
  const config = loadConfig();

  console.log(`[SuvidhaPay CLI] Running seed task in mode: "${mode}" for dataDir: "${config.dataDir}"`);

  const lokiStore = new LokiDataStore(config.dataDir, { persistence: 'disk' });
  const jsonStore = new JsonFileDataStore(config.dataDir);

  if (mode === 'reset') {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SuvidhaPay CLI] ERROR: Cannot reset database in production mode!');
      process.exit(1);
    }
    await resetDatabaseToSeed(lokiStore, true);
    await resetDatabaseToSeed(jsonStore, true);
    console.log(
      `[SuvidhaPay CLI] SUCCESS: All data stores in "${config.dataDir}" reset to fresh deterministic seed data.`
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
