import { FastifyPluginAsync } from 'fastify';
import { authenticateRequest } from '../auth.js';
import { getUserPurchasedSkins, buySkin, equipSkin, getUserById } from '../db.js';
import { SKINS_CATALOG } from '../skinsConfig.js';

export const shopRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all skins, ownership status, and equipped status
  fastify.get('/items', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const owned = getUserPurchasedSkins(user.id);
    const activeCoin = user.active_coin_skin || 'default';
    const activePlane = user.active_plane_skin || 'default';

    const items = SKINS_CATALOG.map((skin) => ({
      ...skin,
      isOwned: skin.cost === 0 || owned.includes(skin.id),
      isEquipped: skin.type === 'coin' ? activeCoin === skin.id : activePlane === skin.id,
    }));

    return {
      success: true,
      items,
      activeCoinSkin: activeCoin,
      activePlaneSkin: activePlane,
    };
  });

  // Buy a skin
  fastify.post('/buy', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { skinId, type } = (req.body as { skinId?: string; type?: 'coin' | 'plane' }) || {};
    if (!skinId || !type || (type !== 'coin' && type !== 'plane')) {
      return reply.status(400).send({ error: 'Неверные параметры запроса' });
    }

    const result = buySkin(user.id, skinId, type);
    if (!result.success) {
      return reply.status(400).send({ error: result.error || 'Не удалось купить скин' });
    }

    const freshUser = getUserById(user.id)!;
    return {
      success: true,
      balance: freshUser.balance,
      activeCoinSkin: freshUser.active_coin_skin || 'default',
      activePlaneSkin: freshUser.active_plane_skin || 'default',
    };
  });

  // Equip a purchased skin
  fastify.post('/equip', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { skinId, type } = (req.body as { skinId?: string; type?: 'coin' | 'plane' }) || {};
    if (!skinId || !type || (type !== 'coin' && type !== 'plane')) {
      return reply.status(400).send({ error: 'Неверные параметры запроса' });
    }

    const result = equipSkin(user.id, skinId, type);
    if (!result.success) {
      return reply.status(400).send({ error: result.error || 'Не удалось надеть скин' });
    }

    const freshUser = getUserById(user.id)!;
    return {
      success: true,
      activeCoinSkin: freshUser.active_coin_skin || 'default',
      activePlaneSkin: freshUser.active_plane_skin || 'default',
    };
  });
};
