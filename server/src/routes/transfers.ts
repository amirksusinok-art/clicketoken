import { FastifyInstance } from 'fastify';
import { authenticateRequest } from '../auth.js';
import {
  getUserByUsername,
  getUserById,
  executeTransfer,
  getUserTransfers,
} from '../db.js';

export async function transfersRoutes(fastify: FastifyInstance) {
  // Send tokens to another user by @username
  fastify.post('/send', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const { toUsername, amount } = (req.body as {
      toUsername?: string;
      amount?: number;
    }) || {};

    if (!toUsername || !toUsername.trim()) {
      return reply.status(400).send({ error: 'Укажите username получателя' });
    }

    const transferAmount = Math.round(Number(amount || 0) * 1000) / 1000;
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return reply.status(400).send({ error: 'Укажите корректную сумму перевода' });
    }

    if (user.balance < transferAmount) {
      return reply.status(400).send({ error: 'Недостаточно токенов на балансе' });
    }

    const cleanUsername = toUsername.replace(/^@/, '').trim();
    const recipient = getUserByUsername(cleanUsername);

    if (!recipient) {
      return reply.status(404).send({
        error: `Пользователь @${cleanUsername} не найден. Получатель должен хотя бы один раз запустить игру.`,
      });
    }

    if (recipient.id === user.id) {
      return reply.status(400).send({ error: 'Нельзя переводить токены самому себе' });
    }

    const result = executeTransfer(user.id, recipient.id, transferAmount);
    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    const updatedSender = getUserById(user.id)!;
    return {
      success: true,
      message: `Успешно отправлено ${transferAmount.toFixed(3)} Токенов пользователю @${cleanUsername}`,
      balance: updatedSender.balance,
      transfer: result.transfer,
    };
  });

  // Get user transfer history
  fastify.get('/history', async (req, reply) => {
    const user = await authenticateRequest(req, reply);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const history = getUserTransfers(user.id, 25);
    return { history };
  });
}
