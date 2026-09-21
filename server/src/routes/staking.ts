import { FastifyInstance } from 'fastify';
import { authenticateRequest } from '../auth.js';
import {
  createStakingDeposit,
  getUserStakingDeposits,
  claimStakingDeposit,
  withdrawStakingDepositEarly,
  STAKING_PLANS,
} from '../db.js';

export async function stakingRoutes(fastify: FastifyInstance) {
  // Get active and history deposits
  fastify.get('/state', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const deposits = getUserStakingDeposits(user.id);
    return {
      deposits,
      plans: STAKING_PLANS,
    };
  });

  // Create new deposit
  fastify.post('/deposit', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { amount, termDays } = (req.body as { amount?: number; termDays?: number }) || {};
    if (!amount || typeof amount !== 'number' || !termDays || typeof termDays !== 'number') {
      return reply.status(400).send({ error: 'Неверные параметры запроса' });
    }

    const res = createStakingDeposit(user.id, amount, termDays);
    if (!res.success) {
      return reply.status(400).send({ error: res.error });
    }

    const deposits = getUserStakingDeposits(user.id);
    return {
      success: true,
      newBalance: res.newBalance,
      deposits,
    };
  });

  // Claim matured deposit
  fastify.post('/claim', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { depositId } = (req.body as { depositId?: number }) || {};
    if (!depositId || typeof depositId !== 'number') {
      return reply.status(400).send({ error: 'Не указан ID депозита' });
    }

    const res = claimStakingDeposit(user.id, depositId);
    if (!res.success) {
      return reply.status(400).send({ error: res.error });
    }

    const deposits = getUserStakingDeposits(user.id);
    return {
      success: true,
      payout: res.payout,
      profit: res.profit,
      newBalance: res.newBalance,
      deposits,
    };
  });

  // Emergency early withdraw (lose interest, get principal back)
  fastify.post('/withdraw-early', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { depositId } = (req.body as { depositId?: number }) || {};
    if (!depositId || typeof depositId !== 'number') {
      return reply.status(400).send({ error: 'Не указан ID депозита' });
    }

    const res = withdrawStakingDepositEarly(user.id, depositId);
    if (!res.success) {
      return reply.status(400).send({ error: res.error });
    }

    const deposits = getUserStakingDeposits(user.id);
    return {
      success: true,
      returnedPrincipal: res.returnedPrincipal,
      newBalance: res.newBalance,
      deposits,
    };
  });
}
