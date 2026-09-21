import {
  getUserById,
  updateUserBalance,
  addGameHistory,
  incrementUserNonce,
  addReferralEarning,
} from './db.js';
import {
  generateServerSeed,
  hashServerSeed,
  calculateCoinFlipResult,
} from './provablyFair.js';
import { notifyReferralEarning } from './bot.js';

export class CoinFlipEngine {
  private readonly MIN_BET = 0.01;

  public play(
    userId: number,
    betAmount: number,
    choice: 'heads' | 'tails'
  ): {
    success: boolean;
    outcome: 'heads' | 'tails';
    isWin: boolean;
    multiplier: number;
    payout: number;
    balance: number;
    serverSeed: string;
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  } {
    const user = getUserById(userId);
    if (!user) throw new Error('Пользователь не найден');

    if (choice !== 'heads' && choice !== 'tails') {
      throw new Error('Выберите сторону: heads (Орёл) или tails (Решка)');
    }

    const cleanBet = Math.round(Number(betAmount) * 100000) / 100000;
    if (cleanBet < this.MIN_BET) {
      throw new Error(`Минимальная ставка: ${this.MIN_BET} Т`);
    }
    if (user.balance < cleanBet) {
      throw new Error('Недостаточно средств на балансе');
    }

    // Deduct bet
    updateUserBalance(userId, -cleanBet);

    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    const clientSeed = user.client_seed || 'client';
    const nonce = user.nonce || 0;

    const result = calculateCoinFlipResult(serverSeed, clientSeed, nonce, choice);
    const payout = result.isWin
      ? Math.round(cleanBet * result.multiplier * 100000) / 100000
      : 0;

    if (payout > 0) {
      updateUserBalance(userId, payout);
    }

    // Referral commission from bet
    const refRes = addReferralEarning(userId, cleanBet, 'game');
    if (refRes) {
      notifyReferralEarning(refRes.referrerId, refRes.friendName, refRes.bonus);
    }

    // Add game history
    addGameHistory(
      userId,
      'coinflip',
      cleanBet,
      result.multiplier,
      payout,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      { choice, outcome: result.outcome, isWin: result.isWin }
    );

    incrementUserNonce(userId);

    const updatedUser = getUserById(userId)!;

    return {
      success: true,
      outcome: result.outcome,
      isWin: result.isWin,
      multiplier: result.multiplier,
      payout,
      balance: updatedUser.balance,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
    };
  }
}

export const coinFlipEngine = new CoinFlipEngine();
