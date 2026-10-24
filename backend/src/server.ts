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
  const store = await initDatabase({ dataDir: config.dataDir });

  const app = createSuvidhaApiApp(store);

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(
      `[SuvidhaPay Backend] Server listening on http://0.0.0.0:${config.port} (API: /api/v1, Health: /api/v1/health, Docs: /docs)`
    );
  });

  const shutdown = async () => {
    console.log('[SuvidhaPay Backend] Graceful termination signal received. Closing connections...');
    try {
      await closeDatabase();
    } catch (e) {
      console.error('[SuvidhaPay Backend] Error closing database:', e);
    }
    server.close(() => {
      console.log('[SuvidhaPay Backend] HTTP server closed cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startStandaloneBackend().catch((err) => {
  console.error('[SuvidhaPay Backend] Fatal startup error:', err);
  process.exit(1);
});
