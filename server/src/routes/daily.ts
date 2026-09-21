import { FastifyInstance } from 'fastify';
import { authenticateRequest } from '../auth.js';
import { getDailyStreakState, claimDailyReward } from '../db.js';

export async function dailyRoutes(fastify: FastifyInstance) {
  // Get daily streak info
  fastify.get('/state', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const state = getDailyStreakState(user.id);
    if (!state) return reply.status(404).send({ error: 'User not found' });

    return state;
  });

  // Claim daily streak reward
  fastify.post('/claim', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const res = claimDailyReward(user.id);
    if (!res.success) {
      return reply.status(400).send({ error: res.error });
    }

    const nextState = getDailyStreakState(user.id);
    return {
      success: true,
      rewardAmount: res.rewardAmount,
      newStreak: res.newStreak,
      newBalance: res.newBalance,
      dayClaimed: res.dayClaimed,
      state: nextState,
    };
  });
}
