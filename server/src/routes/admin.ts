import { FastifyInstance } from 'fastify';
import { authenticateRequest } from '../auth.js';
import {
  ADMIN_TELEGRAM_ID,
  isAdminUser,
  findUserByQuery,
  adminAddBalance,
  adminSetBalance,
  adminGetStats,
} from '../db.js';

export async function adminRoutes(fastify: FastifyInstance) {
  // Middleware/pre-handler check for all /api/admin routes
  fastify.addHook('preHandler', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    if (!isAdminUser(user.id)) {
      return reply.status(403).send({ error: 'Доступ запрещён. Только для владельца проекта.' });
    }
  });

  // Get admin stats
  fastify.get('/stats', async (req, reply) => {
    const stats = adminGetStats();
    return stats;
  });

  // Search user by @username or Telegram ID
  fastify.post('/search-user', async (req, reply) => {
    const { query } = (req.body as { query?: string | number }) || {};
    if (!query) {
      return reply.status(400).send({ error: 'Введите никнейм или ID' });
    }

    const targetUser = findUserByQuery(query);
    if (!targetUser) {
      return reply.status(404).send({ error: 'Пользователь не найден' });
    }

    return {
      user: {
        id: targetUser.id,
        username: targetUser.username,
        first_name: targetUser.first_name,
        balance: targetUser.balance,
        earn_per_click: targetUser.earn_per_click,
        upgrade_level: targetUser.upgrade_level,
        mining_level: targetUser.mining_level || 0,
        daily_streak: targetUser.daily_streak || 0,
        created_at: targetUser.created_at,
      },
    };
  });

  // Add balance to user (self or any player)
  fastify.post('/add-balance', async (req, reply) => {
    const { targetUserId, amount } = (req.body as { targetUserId?: number; amount?: number }) || {};
    if (!targetUserId || typeof targetUserId !== 'number' || typeof amount !== 'number') {
      return reply.status(400).send({ error: 'Неверные параметры запроса' });
    }

    const res = adminAddBalance(targetUserId, amount);
    if (!res.success) {
      return reply.status(400).send({ error: res.error });
    }

    return {
      success: true,
      user: {
        id: res.user!.id,
        username: res.user!.username,
        first_name: res.user!.first_name,
        balance: res.user!.balance,
      },
    };
  });

  // Set / Reset balance for user
  fastify.post('/set-balance', async (req, reply) => {
    const { targetUserId, newBalance } = (req.body as { targetUserId?: number; newBalance?: number }) || {};
    if (!targetUserId || typeof targetUserId !== 'number' || typeof newBalance !== 'number') {
      return reply.status(400).send({ error: 'Неверные параметры запроса' });
    }

    const res = adminSetBalance(targetUserId, newBalance);
    if (!res.success) {
      return reply.status(400).send({ error: res.error });
    }

    return {
      success: true,
      user: {
        id: res.user!.id,
        username: res.user!.username,
        first_name: res.user!.first_name,
        balance: res.user!.balance,
      },
    };
  });
}
