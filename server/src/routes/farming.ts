import { FastifyPluginAsync } from 'fastify';
import { authenticateRequest } from '../auth.js';
import { getMiningState, claimMiningReward, upgradeMiningFarm } from '../db.js';
import { VIDEO_CARDS } from '../farmingConfig.js';

export const farmingRoutes: FastifyPluginAsync = async (fastify) => {
  // Get current farm status and all available video cards
  fastify.get('/status', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const state = getMiningState(user.id);
    return {
      success: true,
      state,
      allCards: VIDEO_CARDS,
    };
  });

  // Claim accumulated offline mining rewards
  fastify.post('/claim', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const result = claimMiningReward(user.id);
    const updatedState = getMiningState(user.id);

    return {
      success: true,
      claimed: result.claimed,
      balance: result.newBalance,
      state: updatedState,
    };
  });

  // Upgrade / Buy next video card
  fastify.post('/upgrade', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const result = upgradeMiningFarm(user.id);
    if (!result.success) {
      return reply.status(400).send({ error: result.error || 'Не удалось улучшить ферму' });
    }

    const updatedState = getMiningState(user.id);

    return {
      success: true,
      newLevel: result.newLevel,
      balance: result.newBalance,
      state: updatedState,
    };
  });
};
