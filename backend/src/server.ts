import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool } from './db/client.js';

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`📖 Guide du chrétien API sur http://localhost:${env.PORT}/api/v1 (${env.NODE_ENV})`);
});

function shutdown(signal: string) {
  console.log(`${signal} reçu, arrêt en cours…`);
  server.close(() => pool.end().then(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
