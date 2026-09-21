import {
  generateServerSeed,
  hashServerSeed,
  calculateCrashPoint,
} from './provablyFair.js';
import {
  getUserById,
  updateUserBalance,
  addGameHistory,
  getGameHistory,
} from './db.js';

export type CrashState = 'BETTING' | 'RUNNING' | 'CRASHED';

export interface CrashBet {
  userId: number;
  username: string;
  bet: number;
  cashedOut: boolean;
  cashedOutMultiplier?: number;
  cashedOutPayout?: number;
}

export interface CrashHistoryItem {
  crashPoint: number;
  serverSeedHash: string;
  serverSeed: string;
  timestamp: number;
}

class MultiplayerCrashEngine {
  public state: CrashState = 'BETTING';
  public roundId: number = 1;
  public serverSeed: string = '';
  public serverSeedHash: string = '';
  public clientSeed: string = 'crash_public_seed';
  public nonce: number = 1;
  public targetCrashPoint: number = 1.0;
  
  public currentMultiplier: number = 1.0;
  public startTime: number = 0;
  public bettingTimeLeft: number = 5.0; // seconds
  
  public currentBets: Map<number, CrashBet> = new Map();
  public history: CrashHistoryItem[] = [];

  private listeners: Set<(event: any) => void> = new Set();
  private intervalTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.prepareNewRound();
    this.startLoop();
  }

  public addListener(listener: (event: any) => void) {
    this.listeners.add(listener);
    // Send immediate current state
    listener(this.getStateSnapshot());
    return () => this.listeners.delete(listener);
  }

  private broadcast(data: any) {
    for (const listener of this.listeners) {
      try {
        listener(data);
      } catch (err) {
        // ignore listener errors
      }
    }
  }

  private prepareNewRound() {
    this.state = 'BETTING';
    this.roundId++;
    this.currentBets.clear();
    this.currentMultiplier = 1.0;
    this.bettingTimeLeft = 5.0;
    
    this.serverSeed = generateServerSeed();
    this.serverSeedHash = hashServerSeed(this.serverSeed);
    this.nonce = this.roundId;

    const res = calculateCrashPoint(this.serverSeed, this.clientSeed, this.nonce);
    this.targetCrashPoint = res.crashPoint;
  }

  private startLoop() {
    const tickRate = 50; // 20 times per second for silky smooth multiplier updates
    this.intervalTimer = setInterval(() => {
      this.tick(tickRate / 1000);
    }, tickRate);
  }

  private tick(dt: number) {
    if (this.state === 'BETTING') {
      this.bettingTimeLeft -= dt;
      if (this.bettingTimeLeft <= 0) {
        // Start running
        this.state = 'RUNNING';
        this.startTime = Date.now();
        this.currentMultiplier = 1.0;
        this.broadcast({
          type: 'round_started',
          ...this.getStateSnapshot(),
        });
      } else {
        this.broadcast({
          type: 'betting_tick',
          bettingTimeLeft: Math.max(0, Math.round(this.bettingTimeLeft * 10) / 10),
        });
      }
    } else if (this.state === 'RUNNING') {
      const elapsed = (Date.now() - this.startTime) / 1000;
      // Exponential curve: speed increases gradually
      // e^(0.06 * t) takes ~11s to reach 2.0x, ~18s to reach 3.0x, etc.
      const calculated = Math.pow(Math.E, 0.065 * elapsed);
      this.currentMultiplier = Math.round(calculated * 100) / 100;

      if (this.currentMultiplier >= this.targetCrashPoint) {
        // CRASHED!
        this.currentMultiplier = this.targetCrashPoint;
        this.onCrash();
      } else {
        this.broadcast({
          type: 'multiplier_tick',
          multiplier: this.currentMultiplier,
        });
      }
    }
  }

  private onCrash() {
    this.state = 'CRASHED';

    // Record game history for all bets
    for (const [userId, bet] of this.currentBets.entries()) {
      const payout = bet.cashedOut ? (bet.cashedOutPayout || 0) : 0;
      const mult = bet.cashedOut ? (bet.cashedOutMultiplier || 0) : 0;

      addGameHistory(
        userId,
        'crash',
        bet.bet,
        mult,
        payout,
        this.serverSeed,
        this.serverSeedHash,
        this.clientSeed,
        this.nonce,
        {
          targetCrashPoint: this.targetCrashPoint,
          cashedOut: bet.cashedOut,
          roundId: this.roundId,
        }
      );
    }

    // Add to history list
    this.history.unshift({
      crashPoint: this.targetCrashPoint,
      serverSeedHash: this.serverSeedHash,
      serverSeed: this.serverSeed,
      timestamp: Date.now(),
    });
    if (this.history.length > 20) this.history.pop();

    this.broadcast({
      type: 'crashed',
      crashPoint: this.targetCrashPoint,
      ...this.getStateSnapshot(),
    });

    // Wait 4 seconds then restart
    setTimeout(() => {
      this.prepareNewRound();
      this.broadcast({
        type: 'new_round',
        ...this.getStateSnapshot(),
      });
    }, 4000);
  }

  public placeBet(userId: number, username: string, amount: number): { success: boolean; error?: string } {
    if (this.state !== 'BETTING') {
      return { success: false, error: 'Ставки принимаются только до старта раунда' };
    }
    if (amount < 5.0) {
      return { success: false, error: 'Минимальная ставка: 5 Токенов' };
    }

    const user = getUserById(userId);
    if (!user || user.balance < amount) {
      return { success: false, error: 'Недостаточно токенов на балансе' };
    }

    if (this.currentBets.has(userId)) {
      return { success: false, error: 'Вы уже сделали ставку в этом раунде' };
    }

    // Deduct bet from balance
    updateUserBalance(userId, -amount);

    const bet: CrashBet = {
      userId,
      username,
      bet: amount,
      cashedOut: false,
    };
    this.currentBets.set(userId, bet);

    this.broadcast({
      type: 'bet_placed',
      bet,
      betsCount: this.currentBets.size,
    });

    return { success: true };
  }

  public cashOut(userId: number): { success: boolean; payout?: number; multiplier?: number; error?: string } {
    if (this.state !== 'RUNNING') {
      return { success: false, error: 'Раунд не запущен или уже завершён' };
    }

    const bet = this.currentBets.get(userId);
    if (!bet) {
      return { success: false, error: 'У вас нет активной ставки в этом раунде' };
    }
    if (bet.cashedOut) {
      return { success: false, error: 'Вы уже забрали выигрыш' };
    }

    const mult = this.currentMultiplier;
    const payout = Math.round(bet.bet * mult * 1000) / 1000;

    bet.cashedOut = true;
    bet.cashedOutMultiplier = mult;
    bet.cashedOutPayout = payout;

    // Credit payout to balance
    updateUserBalance(userId, payout);

    this.broadcast({
      type: 'cashed_out',
      userId,
      multiplier: mult,
      payout,
    });

    return { success: true, payout, multiplier: mult };
  }

  public getStateSnapshot() {
    return {
      roundId: this.roundId,
      state: this.state,
      currentMultiplier: this.currentMultiplier,
      targetCrashPoint: this.state === 'CRASHED' ? this.targetCrashPoint : undefined,
      bettingTimeLeft: Math.max(0, Math.round(this.bettingTimeLeft * 10) / 10),
      serverSeedHash: this.serverSeedHash,
      serverSeed: this.state === 'CRASHED' ? this.serverSeed : undefined,
      clientSeed: this.clientSeed,
      nonce: this.nonce,
      bets: Array.from(this.currentBets.values()),
      history: this.history.slice(0, 10),
    };
  }
}

export const crashEngine = new MultiplayerCrashEngine();
