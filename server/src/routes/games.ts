import { FastifyInstance } from 'fastify';
import { authenticateRequest } from '../auth.js';
import { crashEngine } from '../crashEngine.js';
import { pvpWheelManager } from '../pvpWheelEngine.js';
import { penaltyEngine } from '../penaltyEngine.js';
import { casesEngine } from '../casesEngine.js';
import { coinFlipEngine } from '../coinflipEngine.js';
import { rouletteEngine } from '../rouletteEngine.js';
import {
  generateServerSeed,
  hashServerSeed,
  calculateHiLoResult,
  calculateRandomGameResult,
  calculatePlinkoResult,
} from '../provablyFair.js';
import {
  getUserById,
  updateUserBalance,
  incrementUserNonce,
  addGameHistory,
  getGameHistory,
  getFavoriteGames,
  toggleFavoriteGame,
  addReferralEarning,
} from '../db.js';
import { notifyReferralEarning } from '../bot.js';

export async function gamesRoutes(fastify: FastifyInstance) {
  // 1. Crash Multiplayer
  fastify.get('/crash/state', async () => {
    return crashEngine.getStateSnapshot();
  });

  fastify.post('/crash/bet', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { amount } = (req.body as { amount?: number }) || {};
    const betAmount = Math.round(Number(amount || 0) * 1000) / 1000;

    const res = crashEngine.placeBet(
      user.id,
      user.username ? `@${user.username}` : user.first_name,
      betAmount
    );

    if (!res.success) {
      return reply.status(400).send({ error: res.error });
    }

    const updated = getUserById(user.id)!;
    return { success: true, balance: updated.balance };
  });

  fastify.post('/crash/cashout', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const res = crashEngine.cashOut(user.id);
    if (!res.success) {
      return reply.status(400).send({ error: res.error });
    }

    const updated = getUserById(user.id)!;
    return {
      success: true,
      multiplier: res.multiplier,
      payout: res.payout,
      balance: updated.balance,
    };
  });

  // Server-Sent Events (SSE) stream for real-time multiplayer updates
  fastify.get('/crash/events', (req, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.setHeader('Access-Control-Allow-Origin', '*');

    // Send initial ping
    reply.raw.write(`data: ${JSON.stringify({ type: 'init', ...crashEngine.getStateSnapshot() })}\n\n`);

    const unsubscribe = crashEngine.addListener((event) => {
      try {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (err) {
        unsubscribe();
      }
    });

    req.raw.on('close', () => {
      unsubscribe();
    });
  });

  // 2. Penalty Shootout Game (Пенальти)
  fastify.post('/penalty/start-round', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { bet } = (req.body as { bet?: number }) || {};
    try {
      const round = penaltyEngine.startRound(user.id, Number(bet || 0.01));
      const freshUser = getUserById(user.id)!;
      return {
        success: true,
        round: {
          roundId: round.roundId,
          bet: round.bet,
          currentStep: round.currentStep,
          maxSteps: round.maxSteps,
          multipliers: round.multipliers,
          history: round.history,
          isFinished: round.isFinished,
          serverSeedHash: round.serverSeedHash,
        },
        balance: freshUser.balance,
      };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Ошибка старта пенальти' });
    }
  });

  fastify.post('/penalty/shoot', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { roundId, targetZone } = (req.body as { roundId?: string; targetZone?: number }) || {};
    if (!roundId || targetZone === undefined) {
      return reply.status(400).send({ error: 'Укажите roundId и targetZone' });
    }

    try {
      const res = penaltyEngine.shoot(roundId, user.id, Number(targetZone));
      return res;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Ошибка удара' });
    }
  });

  fastify.post('/penalty/cashout', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { roundId } = (req.body as { roundId?: string }) || {};
    if (!roundId) {
      return reply.status(400).send({ error: 'Укажите roundId' });
    }

    try {
      const res = penaltyEngine.cashOut(roundId, user.id);
      return res;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Ошибка вывода' });
    }
  });

  // CoinFlip Game (Орёл или Решка)
  fastify.post('/coinflip/play', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { bet, choice } = (req.body as { bet?: number; choice?: 'heads' | 'tails' }) || {};
    try {
      const res = coinFlipEngine.play(user.id, Number(bet || 0), choice as any);
      return res;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Ошибка игры в CoinFlip' });
    }
  });

  // Mini Roulette Game (12 секторов + Зеро)
  fastify.post('/roulette/play', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { bet, betType, targetNumber } =
      (req.body as {
        bet?: number;
        betType?: any;
        targetNumber?: number;
      }) || {};

    try {
      const res = rouletteEngine.play(
        user.id,
        Number(bet || 0),
        betType,
        targetNumber !== undefined ? Number(targetNumber) : undefined
      );
      return res;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Ошибка игры в Рулетку' });
    }
  });

  // 3. Mystery Cases Game (Кейсы / Лутбоксы)
  fastify.get('/cases/catalog', async () => {
    return { success: true, cases: casesEngine.getCatalog() };
  });

  fastify.post('/cases/open', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { caseId } = (req.body as { caseId?: string }) || {};
    if (!caseId) {
      return reply.status(400).send({ error: 'Укажите caseId' });
    }

    try {
      const result = casesEngine.openCase(user.id, caseId);
      return result;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Ошибка открытия кейса' });
    }
  });

  // 3. Random Game (Колесо вероятностей)
  fastify.post('/random/play', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { bet } = (req.body as { bet?: number }) || {};
    const betAmount = Math.round(Number(bet || 0) * 1000) / 1000;

    if (betAmount < 5.0) {
      return reply.status(400).send({ error: 'Минимальная ставка: 5 Токенов' });
    }
    if (user.balance < betAmount) {
      return reply.status(400).send({ error: 'Недостаточно токенов на балансе' });
    }

    // Deduct bet
    updateUserBalance(user.id, -betAmount);

    // Provably Fair generation
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    const nonce = incrementUserNonce(user.id);
    const clientSeed = user.client_seed;

    const { multiplier, rollPoint, hmac } = calculateRandomGameResult(serverSeed, clientSeed, nonce);
    const payout = Math.round(betAmount * multiplier * 1000) / 1000;

    if (payout > 0) {
      updateUserBalance(user.id, payout);
      if (payout > betAmount) {
        const refRes = addReferralEarning(user.id, payout - betAmount, 'game');
        if (refRes) notifyReferralEarning(refRes.referrerId, refRes.friendName, refRes.bonus);
      }
    }

    addGameHistory(
      user.id,
      'random',
      betAmount,
      multiplier,
      payout,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      { rollPoint }
    );

    const updatedUser = getUserById(user.id)!;
    return {
      success: true,
      multiplier,
      rollPoint,
      payout,
      isWin: payout > 0,
      balance: updatedUser.balance,
      provablyFair: {
        serverSeed,
        serverSeedHash,
        clientSeed,
        nonce,
        hmac,
      },
    };
  });

  // 4. Hi-Lo Game (Больше / Меньше)
  fastify.post('/hilo/play', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { bet, chance, choice } = (req.body as {
      bet?: number;
      chance?: number;
      choice?: 'less' | 'more';
    }) || {};

    const betAmount = Math.round(Number(bet || 0) * 1000) / 1000;
    const winChance = Math.min(95.0, Math.max(1.0, Number(chance || 50.0)));
    const targetChoice = choice === 'more' ? 'more' : 'less';

    if (betAmount < 5.0) {
      return reply.status(400).send({ error: 'Минимальная ставка: 5 Токенов' });
    }
    if (user.balance < betAmount) {
      return reply.status(400).send({ error: 'Недостаточно токенов на балансе' });
    }

    // Formula: multiplier = (100 - houseEdge) / P
    const houseEdge = 1.0;
    const multiplier = Math.round(((100 - houseEdge) / winChance) * 10000) / 10000;

    // Deduct bet
    updateUserBalance(user.id, -betAmount);

    // Provably Fair generation
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    const nonce = incrementUserNonce(user.id);
    const clientSeed = user.client_seed;

    const { roll, hmac } = calculateHiLoResult(serverSeed, clientSeed, nonce);

    // Range calculation:
    // N = floor(1000000 * P / 100)
    const n = Math.floor((1000000 * winChance) / 100);
    let isWin = false;

    if (targetChoice === 'less') {
      // 0 to n - 1
      isWin = roll < n;
    } else {
      // (1000000 - n) to 999999
      isWin = roll >= (1000000 - n);
    }

    const payout = isWin ? Math.round(betAmount * multiplier * 1000) / 1000 : 0;

    if (payout > 0) {
      updateUserBalance(user.id, payout);
      if (payout > betAmount) {
        const refRes = addReferralEarning(user.id, payout - betAmount, 'game');
        if (refRes) notifyReferralEarning(refRes.referrerId, refRes.friendName, refRes.bonus);
      }
    }

    addGameHistory(
      user.id,
      'hilo',
      betAmount,
      isWin ? multiplier : 0,
      payout,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      {
        roll,
        winChance,
        choice: targetChoice,
        winRangeLimit: targetChoice === 'less' ? n - 1 : 1000000 - n,
      }
    );

    const updatedUser = getUserById(user.id)!;
    return {
      success: true,
      roll,
      isWin,
      multiplier: isWin ? multiplier : 0,
      payout,
      balance: updatedUser.balance,
      provablyFair: {
        serverSeed,
        serverSeedHash,
        clientSeed,
        nonce,
        hmac,
      },
    };
  });

  // 5. Plinko Game (Плинко)
  fastify.post('/plinko/play', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { bet, rows, risk } = (req.body as {
      bet?: number;
      rows?: number;
      risk?: 'low' | 'medium' | 'high';
    }) || {};

    const betAmount = Math.round(Number(bet || 0) * 1000) / 1000;
    const rowCount = Math.max(8, Math.min(16, Number(rows || 8)));
    const riskLevel = risk === 'medium' || risk === 'high' ? risk : 'low';

    if (betAmount < 5.0) {
      return reply.status(400).send({ error: 'Минимальная ставка: 5 Токенов' });
    }
    if (user.balance < betAmount) {
      return reply.status(400).send({ error: 'Недостаточно токенов на балансе' });
    }

    // Deduct bet
    updateUserBalance(user.id, -betAmount);

    // Provably Fair generation
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    const nonce = incrementUserNonce(user.id);
    const clientSeed = user.client_seed;

    const plinkoRes = calculatePlinkoResult(serverSeed, clientSeed, nonce, rowCount, riskLevel);
    const payout = Math.round(betAmount * plinkoRes.multiplier * 1000) / 1000;

    if (payout > 0) {
      updateUserBalance(user.id, payout);
      if (payout > betAmount) {
        const refRes = addReferralEarning(user.id, payout - betAmount, 'game');
        if (refRes) notifyReferralEarning(refRes.referrerId, refRes.friendName, refRes.bonus);
      }
    }

    addGameHistory(
      user.id,
      'plinko',
      betAmount,
      plinkoRes.multiplier,
      payout,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      {
        rows: rowCount,
        risk: riskLevel,
        bucketIndex: plinkoRes.bucketIndex,
        path: plinkoRes.path,
      }
    );

    const updatedUser = getUserById(user.id)!;
    return {
      success: true,
      path: plinkoRes.path,
      bucketIndex: plinkoRes.bucketIndex,
      multiplier: plinkoRes.multiplier,
      payout,
      isWin: plinkoRes.multiplier >= 1.0,
      balance: updatedUser.balance,
      provablyFair: {
        serverSeed,
        serverSeedHash,
        clientSeed,
        nonce,
        hmac: plinkoRes.hmac,
      },
    };
  });

  // 6. PvP Wheel 1v1 Game (Колесо против игрока)
  fastify.post('/pvp-wheel/find-match', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { bet } = (req.body as { bet?: number }) || {};
    const betAmount = Math.max(5.0, Math.round(Number(bet || 5.0) * 1000) / 1000);

    try {
      const match = pvpWheelManager.findMatch(
        user.id,
        user.username || user.first_name || 'Игрок',
        betAmount
      );
      const updatedUser = getUserById(user.id)!;
      return { success: true, match, balance: updatedUser.balance };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Ошибка поиска матча' });
    }
  });

  fastify.post('/pvp-wheel/select-sector', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { matchId, sector } = (req.body as { matchId?: string; sector?: number }) || {};
    if (!matchId || sector === undefined) {
      return reply.status(400).send({ error: 'Укажите matchId и выбранный сектор' });
    }

    try {
      const match = pvpWheelManager.selectSector(matchId, user.id, Number(sector));
      if (match.winnerId && match.winnerId === user.id && match.payout > match.bet) {
        const refRes = addReferralEarning(user.id, match.payout - match.bet, 'game');
        if (refRes) notifyReferralEarning(refRes.referrerId, refRes.friendName, refRes.bonus);
      }
      const updatedUser = getUserById(user.id)!;
      return { success: true, match, balance: updatedUser.balance };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Ошибка выбора сектора' });
    }
  });

  fastify.get('/pvp-wheel/match/:matchId', async (req, reply) => {
    const { matchId } = req.params as { matchId: string };
    const match = pvpWheelManager.getMatch(matchId);
    if (!match) return reply.status(404).send({ error: 'Матч не найден' });
    return { success: true, match };
  });

  // History endpoint
  fastify.get('/history', async (req) => {
    const query = req.query as { gameType?: string; limit?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 15;
    const history = getGameHistory(query.gameType, limit);
    return { history };
  });

  // Favorite Games
  fastify.get('/favorites', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const favorites = getFavoriteGames(user.id);
    return { success: true, favorites };
  });

  fastify.post('/favorites/toggle', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { gameId } = (req.body as { gameId?: string }) || {};
    if (!gameId) return reply.status(400).send({ error: 'Укажите gameId' });

    const favorites = toggleFavoriteGame(user.id, gameId);
    return { success: true, favorites };
  });

  // Friend PvP Challenge
  fastify.post('/pvp-wheel/create-friend-challenge', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { bet, friendUserId } = (req.body as { bet?: number; friendUserId?: number }) || {};
    const betAmount = Math.max(5.0, Math.round(Number(bet || 5.0) * 1000) / 1000);

    try {
      const match = pvpWheelManager.findMatch(
        user.id,
        user.username || user.first_name || 'Игрок',
        betAmount
      );
      const updatedUser = getUserById(user.id)!;
      return {
        success: true,
        match,
        balance: updatedUser.balance,
        challengeCode: match.matchId,
        inviteText: `⚔️ Я вызываю тебя на PvP-дуэль в Колесо 1v1 на ${betAmount} Токенов! Заходи:`,
      };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message || 'Ошибка создания вызова' });
    }
  });
}
