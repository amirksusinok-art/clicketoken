import { FastifyPluginAsync } from 'fastify';
import { authenticateRequest } from '../auth.js';
import { getReferralsInfo, claimReferralEarnings } from '../db.js';

export const referralsRoutes: FastifyPluginAsync = async (fastify) => {
  // Get user's referral info, safe balance, friends list, and top inviters
  fastify.get('/info', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const info = getReferralsInfo(user.id);
    const botUsername = process.env.BOT_USERNAME || 'clicketoken_bot';

    // Telegram referral link format
    const referralLink = `https://t.me/${botUsername}?start=ref_${user.id}`;

    return {
      success: true,
      referralLink,
      info,
    };
  });

  // Claim tokens from the referral safe to main balance
  fastify.post('/claim', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const result = claimReferralEarnings(user.id);
    const updatedInfo = getReferralsInfo(user.id);

    return {
      success: true,
      claimed: result.claimed,
      balance: result.newBalance,
      info: updatedInfo,
    };
  });
};
