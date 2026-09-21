import crypto from 'node:crypto';
import { FastifyRequest, FastifyReply } from 'fastify';
import { findOrCreateUser, getUserById, UserRow } from './db.js';

export interface AuthenticatedUser {
  user: UserRow;
  isDev: boolean;
}

export function validateTelegramInitData(initData: string, botToken: string): { valid: boolean; user?: any } {
  if (!initData || !botToken) return { valid: false };

  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return { valid: false };

    params.delete('hash');

    // Sort parameters alphabetically
    const keys = Array.from(params.keys()).sort();
    const dataCheckString = keys.map((k) => `${k}=${params.get(k)}`).join('\n');

    // secret_key = HMAC_SHA256("WebAppData", botToken)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (calculatedHash !== hash) {
      return { valid: false };
    }

    const userDataStr = params.get('user');
    const user = userDataStr ? JSON.parse(userDataStr) : null;
    return { valid: true, user };
  } catch (err) {
    return { valid: false };
  }
}

export async function authenticateRequest(
  req: FastifyRequest,
  reply: FastifyReply
): Promise<UserRow | null> {
  const botToken = process.env.BOT_TOKEN || '';
  const initData = req.headers['x-telegram-init-data'] as string | undefined;
  const devUserIdHeader = req.headers['x-dev-user-id'] as string | undefined;

  // 1. Check for real Telegram WebApp authentication
  if (initData && botToken) {
    const { valid, user } = validateTelegramInitData(initData, botToken);
    if (valid && user && user.id) {
      const params = new URLSearchParams(initData);
      const startParam = params.get('start_param') || (req.headers['x-referral-code'] as string);
      let referrerId: number | undefined;
      if (startParam && typeof startParam === 'string' && startParam.startsWith('ref_')) {
        const parsed = parseInt(startParam.replace('ref_', ''), 10);
        if (!isNaN(parsed)) referrerId = parsed;
      }
      const isPremium = !!user.is_premium;

      const dbUser = findOrCreateUser(
        user.id,
        user.first_name || 'Telegram User',
        user.username || null,
        referrerId,
        isPremium
      );
      return dbUser;
    }
  }

  // 2. Dev / Mock mode for testing in desktop browser
  const devId = devUserIdHeader ? parseInt(devUserIdHeader, 10) : 10001;
  const devName = devId === 10001 ? 'Player 1 (Alpha)' : `Player ${devId}`;
  const devUsername = devId === 10001 ? 'player_one' : `player_${devId}`;

  const refHeader = req.headers['x-referral-code'] as string | undefined;
  let devRefId: number | undefined;
  if (refHeader && refHeader.startsWith('ref_')) {
    const parsed = parseInt(refHeader.replace('ref_', ''), 10);
    if (!isNaN(parsed)) devRefId = parsed;
  }

  const devUser = findOrCreateUser(devId, devName, devUsername, devRefId, false);
  return devUser;
}
