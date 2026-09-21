import {
  getUserById,
  updateUserBalance,
  addGameHistory,
  incrementUserNonce,
  addReferralEarning,
} from './db.js';
import { generateServerSeed, hashServerSeed } from './provablyFair.js';
import { notifyReferralEarning } from './bot.js';
import crypto from 'crypto';

export interface PenaltyShot {
  shotZone: number; // 0..4
  keeperZone: number; // 0..4
  isGoal: boolean;
}

export interface PenaltyRound {
  roundId: string;
  userId: number;
  bet: number;
  currentStep: number; // 0 to 5
  maxSteps: number;
  multipliers: number[];
  history: PenaltyShot[];
  isFinished: boolean;
  status: 'active' | 'won' | 'lost' | 'cashed_out';
  serverSeed: string;
  serverSeedHash: string;
  createdAt: number;
}

export class PenaltyEngine {
  private activeRounds = new Map<string, PenaltyRound>();
  private readonly MULTIPLIERS = [1.92, 3.84, 7.68, 15.36, 30.72];
  private readonly MIN_BET = 0.01;

  public startRound(userId: number, betAmount: number): PenaltyRound {
    const user = getUserById(userId);
    if (!user) throw new Error('Пользователь не найден');

    const cleanBet = Math.round(Number(betAmount) * 100000) / 100000;
    if (cleanBet < this.MIN_BET) {
      throw new Error(`Минимальная ставка: ${this.MIN_BET} Т`);
    }
    if (user.balance < cleanBet) {
      throw new Error('Недостаточно средств на балансе');
    }

    // Deduct bet
    updateUserBalance(userId, -cleanBet);

    const roundId = crypto.randomUUID();
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);

    const round: PenaltyRound = {
      roundId,
      userId,
      bet: cleanBet,
      currentStep: 0,
      maxSteps: 5,
      multipliers: [...this.MULTIPLIERS],
      history: [],
      isFinished: false,
      status: 'active',
      serverSeed,
      serverSeedHash,
      createdAt: Date.now(),
    };

    this.activeRounds.set(roundId, round);

    // Referral commission from bet
    const refRes = addReferralEarning(userId, cleanBet, 'game');
    if (refRes) {
      notifyReferralEarning(refRes.referrerId, refRes.friendName, refRes.bonus);
    }

    return round;
  }

  public shoot(roundId: string, userId: number, targetZone: number): {
    success: boolean;
    isGoal: boolean;
    keeperZone: number;
    currentStep: number;
    multiplier: number;
    potentialPayout: number;
    isFinished: boolean;
    balance: number;
  } {
    const round = this.activeRounds.get(roundId);
    if (!round || round.userId !== userId || round.isFinished) {
      throw new Error('Раунд не найден или уже завершён');
    }

    if (targetZone < 0 || targetZone > 4) {
      throw new Error('Неверный сектор ворот (от 0 до 4)');
    }

    // Provably fair calculation:
    const seedCombo = `${round.serverSeed}:${round.currentStep}:${targetZone}`;
    const hash = crypto.createHash('sha256').update(seedCombo).digest('hex');
    const rollPercent = (parseInt(hash.substring(0, 8), 16) % 10000) / 100; // 0.00 to 99.99

    // Progressive difficulty: Goalkeeper reaction sharpens on each step of the 5-shot series!
    // Step 0 (Shot 1): 40% save chance
    // Step 1 (Shot 2): 48% save chance
    // Step 2 (Shot 3): 58% save chance
    // Step 3 (Shot 4): 68% save chance
    // Step 4 (Shot 5): 75% save chance (Golden Goal Showdown)
    const SAVE_CHANCES = [40.0, 48.0, 58.0, 68.0, 75.0];
    const saveChance = SAVE_CHANCES[Math.min(round.currentStep, SAVE_CHANCES.length - 1)];

    let keeperZone: number;
    let isGoal: boolean;

    if (rollPercent < saveChance) {
      // Goalkeeper saves the shot
      keeperZone = targetZone;
      isGoal = false;
    } else {
      // Goal scored! Keeper dives into one of the other 4 zones
      const otherRoll = parseInt(hash.substring(8, 16), 16);
      const otherZones = [0, 1, 2, 3, 4].filter((z) => z !== targetZone);
      keeperZone = otherZones[otherRoll % otherZones.length];
      isGoal = true;
    }

    round.history.push({
      shotZone: targetZone,
      keeperZone,
      isGoal,
    });

    const user = getUserById(userId)!;
    let userBalance = user.balance;

    if (isGoal) {
      round.currentStep += 1;
      const currentMultiplier = this.MULTIPLIERS[round.currentStep - 1];
      const potentialPayout = Math.round(round.bet * currentMultiplier * 100000) / 100000;

      // Auto-win if all 5 goals scored
      if (round.currentStep === round.maxSteps) {
        round.isFinished = true;
        round.status = 'won';
        updateUserBalance(userId, potentialPayout);
        userBalance = getUserById(userId)!.balance;

        addGameHistory(
          userId,
          'penalty',
          round.bet,
          currentMultiplier,
          potentialPayout,
          round.serverSeed,
          round.serverSeedHash,
          user.client_seed || 'client',
          user.nonce || 0,
          { history: round.history, status: 'won' }
        );
        incrementUserNonce(userId);
      }

      return {
        success: true,
        isGoal: true,
        keeperZone,
        currentStep: round.currentStep,
        multiplier: currentMultiplier,
        potentialPayout,
        isFinished: round.isFinished,
        balance: userBalance,
      };
    } else {
      // Goalkeeper saved it - bet lost
      round.isFinished = true;
      round.status = 'lost';

      addGameHistory(
        userId,
        'penalty',
        round.bet,
        0,
        0,
        round.serverSeed,
        round.serverSeedHash,
        user.client_seed || 'client',
        user.nonce || 0,
        { history: round.history, status: 'lost' }
      );
      incrementUserNonce(userId);

      return {
        success: true,
        isGoal: false,
        keeperZone,
        currentStep: round.currentStep,
        multiplier: 0,
        potentialPayout: 0,
        isFinished: true,
        balance: userBalance,
      };
    }
  }

  public cashOut(roundId: string, userId: number): {
    success: boolean;
    payout: number;
    multiplier: number;
    balance: number;
  } {
    const round = this.activeRounds.get(roundId);
    if (!round || round.userId !== userId || round.isFinished) {
      throw new Error('Раунд не найден или уже завершён');
    }

    if (round.currentStep === 0) {
      throw new Error('Нельзя забрать банк без забитых голов');
    }

    const multiplier = this.MULTIPLIERS[round.currentStep - 1];
    const payout = Math.round(round.bet * multiplier * 100000) / 100000;

    round.isFinished = true;
    round.status = 'cashed_out';

    updateUserBalance(userId, payout);
    const updated = getUserById(userId)!;

    addGameHistory(
      userId,
      'penalty',
      round.bet,
      multiplier,
      payout,
      round.serverSeed,
      round.serverSeedHash,
      updated.client_seed || 'client',
      updated.nonce || 0,
      { history: round.history, status: 'cashed_out' }
    );
    incrementUserNonce(userId);

    return {
      success: true,
      payout,
      multiplier,
      balance: updated.balance,
    };
  }

  public getRound(roundId: string): PenaltyRound | undefined {
    return this.activeRounds.get(roundId);
  }
}

export const penaltyEngine = new PenaltyEngine();
