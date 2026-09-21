import { FastifyInstance } from 'fastify';
import { authenticateRequest } from '../auth.js';
import {
  getUserById,
  recordClicksBatch,
  upgradeUser,
  updateUserSeed,
  incrementUserNonce,
  getFriends,
  addFriend,
  removeFriend,
  isFriend,
  searchUsersByUsername,
  getUserPublicStats,
  updateUserPrivacy,
  addReferralEarning,
} from '../db.js';
import { UPGRADES, getNextUpgrade } from '../upgrades.js';
import { notifyReferralEarning } from '../bot.js';

// Buffer to throttle referral notifications so we don't hit Telegram rate limits
const refNotifyBuffer = new Map<number, { friendName: string; accrued: number; lastSent: number }>();

function queueReferralClickNotification(referrerId: number, friendName: string, bonus: number) {
  const now = Date.now();
  const entry = refNotifyBuffer.get(referrerId) || { friendName, accrued: 0, lastSent: 0 };
  entry.accrued += bonus;
  entry.friendName = friendName;

  if (now - entry.lastSent > 45_000 && entry.accrued >= 0.005) {
    notifyReferralEarning(referrerId, entry.friendName, entry.accrued);
    entry.lastSent = now;
    entry.accrued = 0;
  }
  refNotifyBuffer.set(referrerId, entry);
}

export async function userRoutes(fastify: FastifyInstance) {
  // Get current user profile
  fastify.get('/me', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const nextUpgrade = getNextUpgrade(user.upgrade_level);
    return {
      user: {
        id: user.id,
        username: user.username,
        first_name: user.first_name,
        balance: user.balance,
        earn_per_click: user.earn_per_click,
        upgrade_level: user.upgrade_level,
        client_seed: user.client_seed,
        nonce: user.nonce,
        hide_public_balance: user.hide_public_balance || 0,
        mining_level: user.mining_level || 0,
        referral_unclaimed: user.referral_unclaimed || 0,
        active_coin_skin: user.active_coin_skin || 'default',
        active_plane_skin: user.active_plane_skin || 'default',
      },
      nextUpgrade,
      upgrades: UPGRADES,
    };
  });

  // Batch click synchronization
  fastify.post('/click-batch', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { clicks, deltaMs } = (req.body as { clicks?: number; deltaMs?: number }) || {};
    const clicksCount = Math.max(0, Math.floor(clicks || 0));

    if (clicksCount <= 0) {
      return { success: true, balance: user.balance };
    }

    // Anti-cheat verification: max 25 clicks per second
    const timeDelta = Math.max(200, deltaMs || 1000);
    const maxAllowedClicks = Math.ceil((timeDelta / 1000) * 25) + 5;
    const verifiedClicks = Math.min(clicksCount, maxAllowedClicks);

    const earned = Math.round(verifiedClicks * user.earn_per_click * 10000) / 10000;
    const updatedUser = recordClicksBatch(user.id, verifiedClicks, earned);

    // Credit 10% to referrer if user was invited
    const refResult = addReferralEarning(user.id, earned, 'click');
    if (refResult) {
      queueReferralClickNotification(refResult.referrerId, refResult.friendName, refResult.bonus);
    }

    return {
      success: true,
      balance: updatedUser.balance,
      added: earned,
      verifiedClicks,
    };
  });

  // Buy upgrade
  fastify.post('/upgrade', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const next = getNextUpgrade(user.upgrade_level);
    if (!next) {
      return reply.status(400).send({ error: 'Достигнут максимальный уровень' });
    }

    if (user.balance < next.cost) {
      return reply.status(400).send({ error: 'Недостаточно токенов для улучшения' });
    }

    const updatedUser = upgradeUser(user.id, next.level, next.earnPerClick, next.cost);
    const nextNext = getNextUpgrade(updatedUser.upgrade_level);

    return {
      success: true,
      user: {
        id: updatedUser.id,
        balance: updatedUser.balance,
        earn_per_click: updatedUser.earn_per_click,
        upgrade_level: updatedUser.upgrade_level,
      },
      nextUpgrade: nextNext,
    };
  });

  // Update Provably Fair Client Seed
  fastify.post('/seed', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { clientSeed } = (req.body as { clientSeed?: string }) || {};
    if (!clientSeed || clientSeed.trim().length < 3) {
      return reply.status(400).send({ error: 'Seed должен быть не менее 3 символов' });
    }

    const updatedUser = updateUserSeed(user.id, clientSeed.trim().substring(0, 64));
    return {
      success: true,
      clientSeed: updatedUser.client_seed,
    };
  });

  // Public Profile of another user
  fastify.get('/public-profile/:targetUserId', async (req, reply) => {
    const currentUser = await authenticateRequest(req, reply);
    if (!currentUser) return reply.status(401).send({ error: 'Unauthorized' });

    const { targetUserId } = req.params as { targetUserId: string };
    const tid = parseInt(targetUserId, 10);
    const targetUser = getUserById(tid);
    if (!targetUser) {
      return reply.status(404).send({ error: 'Пользователь не найден' });
    }

    const stats = getUserPublicStats(tid);
    const isFriendWithUser = isFriend(currentUser.id, tid);
    const isBalanceHidden = !!targetUser.hide_public_balance;

    return {
      success: true,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        first_name: targetUser.first_name,
        earn_per_click: targetUser.earn_per_click,
        balance: isBalanceHidden ? null : targetUser.balance,
        isBalanceHidden,
        isFriend: isFriendWithUser,
        stats,
      },
    };
  });

  // Update Privacy (hide/show balance)
  fastify.post('/privacy', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { hideBalance } = (req.body as { hideBalance?: boolean }) || {};
    updateUserPrivacy(user.id, !!hideBalance);
    return { success: true, hideBalance: !!hideBalance };
  });

  // Get Friends list
  fastify.get('/friends', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const friends = getFriends(user.id);
    return { success: true, friends };
  });

  // Search users by username for friends
  fastify.get('/friends/search', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const query = (req.query as { query?: string })?.query || '';
    const results = searchUsersByUsername(query, user.id);
    return { success: true, results };
  });

  // Add friend
  fastify.post('/friends/add', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { friendUserId } = (req.body as { friendUserId?: number }) || {};
    if (!friendUserId) return reply.status(400).send({ error: 'Укажите friendUserId' });

    const added = addFriend(user.id, friendUserId);
    return { success: true, added };
  });

  // Remove friend
  fastify.post('/friends/remove', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { friendUserId } = (req.body as { friendUserId?: number }) || {};
    if (!friendUserId) return reply.status(400).send({ error: 'Укажите friendUserId' });

    removeFriend(user.id, friendUserId);
    return { success: true };
  });
}
