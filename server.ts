import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { loadConfig } from './backend/src/infra/core';
import { initDatabase, closeDatabase } from './backend/src/db/database';
import { createSuvidhaApiApp } from './backend/src/app';

dotenv.config();

/**
 * Root Development Server for AI Studio
 *
 * Runs Express backend from backend/src while proxying/mounting Vite
 * for the frontend from frontend/ root directory.
 */
async function startServer() {
  const config = loadConfig();

  // Centralized Database Initialization — ensures collections & indexes are ready before listening
  const store = await initDatabase({ dataDir: config.dataDir });

  const app = createSuvidhaApiApp(store);

  if (config.nodeEnv !== 'production') {
    const vite = await createViteServer({
      root: path.resolve(process.cwd(), 'frontend'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'frontend/dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(
      `[SuvidhaPay] Server listening on http://0.0.0.0:${config.port} (API: /api/v1, Docs: /docs, DataDir: ${store.getDataDir()})`
    );
  });

  const shutdown = async () => {
    try {
      await closeDatabase();
    } catch (e) {
      console.error('[SuvidhaPay] Error during database shutdown:', e);
    }
    server.close(() => {
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('[SuvidhaPay] Fatal startup error:', err);
  process.exit(1);
});
