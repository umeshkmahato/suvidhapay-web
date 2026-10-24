import dotenv from 'dotenv';
import { loadConfig } from './infra/core';
import { initDatabase, closeDatabase } from './db/database';
import { createSuvidhaApiApp } from './app';

dotenv.config();

/**
 * Standalone Backend Server Entry Point (Phase 5 Restructuring)
 *
 * Runs Express independently on PORT (default 3000) with complete REST API (/api/v1),
 * OpenAPI 3.0 specification (/docs), Swagger UI, and PostgreSQL database connectivity.
 */
async function startStandaloneBackend() {
  const config = loadConfig();

  console.log(`[SuvidhaPay Backend] Initializing database engine: ${config.databaseEngine}...`);
  console.log('[SuvidhaPay Backend] Running database migration + seed preflight before startup...');
  const store = await initDatabase({ dataDir: config.dataDir });
  console.log('[SuvidhaPay Backend] Database preflight complete. Starting HTTP server...');

  const app = createSuvidhaApiApp(store);

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(
      `[SuvidhaPay Backend] Server listening on http://0.0.0.0:${config.port} (API: /api/v1, Health: /api/v1/health, Docs: /docs)`
    );
  });

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('[SuvidhaPay Backend] Graceful termination signal received. Draining requests...');
    const deadline = setTimeout(() => process.exit(1), 30000);
    deadline.unref();
    server.close(async () => {
      try {
        await closeDatabase();
        clearTimeout(deadline);
        console.log('[SuvidhaPay Backend] HTTP server and database closed cleanly.');
        process.exitCode = 0;
      } catch {
        console.error('[SuvidhaPay Backend] Database shutdown failed.');
        process.exitCode = 1;
      }
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startStandaloneBackend().catch((err) => {
  console.error('[SuvidhaPay Backend] Fatal startup error:', err);
  process.exit(1);
});
