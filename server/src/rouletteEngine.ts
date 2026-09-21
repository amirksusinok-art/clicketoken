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
  calculateRouletteResult,
  RouletteBetType,
} from './provablyFair.js';
import { notifyReferralEarning } from './bot.js';

export class RouletteEngine {
  private readonly MIN_BET = 0.01;

  public play(
    userId: number,
    betAmount: number,
    betType: RouletteBetType,
    targetNumber?: number
  ): {
    success: boolean;
    winningNumber: number;
    color: 'green' | 'red' | 'black';
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

    const validTypes: RouletteBetType[] = ['red', 'black', 'even', 'odd', 'number'];
    if (!validTypes.includes(betType)) {
      throw new Error('Некорректный тип ставки');
    }

    if (betType === 'number') {
      if (
        targetNumber === undefined ||
        targetNumber === null ||
        isNaN(targetNumber) ||
        targetNumber < 0 ||
        targetNumber > 12
      ) {
        throw new Error('Выберите число от 0 до 12');
      }
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

    const result = calculateRouletteResult(
      serverSeed,
      clientSeed,
      nonce,
      betType,
      targetNumber
    );

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
      'roulette',
      cleanBet,
      result.multiplier,
      payout,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      {
        betType,
        targetNumber,
        winningNumber: result.winningNumber,
        color: result.color,
        isWin: result.isWin,
      }
    );

    incrementUserNonce(userId);

    const updatedUser = getUserById(userId)!;

    return {
      success: true,
      winningNumber: result.winningNumber,
      color: result.color,
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

export const rouletteEngine = new RouletteEngine();
