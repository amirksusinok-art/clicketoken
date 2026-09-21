import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { userRoutes } from './routes/user.js';
import { gamesRoutes } from './routes/games.js';
import { transfersRoutes } from './routes/transfers.js';
import { setupTelegramBot } from './bot.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../../client/dist');

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'warn',
  },
});

await fastify.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-telegram-init-data', 'x-dev-user-id'],
});

// Register API Routes
await fastify.register(userRoutes, { prefix: '/api/user' });
await fastify.register(gamesRoutes, { prefix: '/api/games' });
await fastify.register(transfersRoutes, { prefix: '/api/transfers' });

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', time: new Date().toISOString() };
});

// Serve frontend static files if client/dist exists
if (fs.existsSync(clientDistPath)) {
  await fastify.register(fastifyStatic, {
    root: clientDistPath,
    prefix: '/',
  });

  fastify.setNotFoundHandler((req, reply) => {
    if (req.raw.url && req.raw.url.startsWith('/api')) {
      return reply.status(404).send({ error: 'Endpoint not found' });
    }
    return reply.sendFile('index.html');
  });
}

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

try {
  await fastify.listen({ port: PORT, host: HOST });
  console.log(`🚀 Сервер кликера Токен запущен: http://localhost:${PORT}`);

  // Start Telegram bot if token exists
  setupTelegramBot();
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
