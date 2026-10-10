import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { loadConfig } from './src/server/infra/core';
import { JsonFileDataStore } from './src/server/repositories/jsonDataStore';
import { createSuvidhaApiApp } from './src/server/app';

dotenv.config();

async function startServer() {
  const config = loadConfig();
  const store = new JsonFileDataStore(config.dataDir);
  await store.seedIfEmpty();

  const app = createSuvidhaApiApp(store);

  if (config.nodeEnv !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
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

  const shutdown = () => {
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
