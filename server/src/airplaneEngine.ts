import {
  generateServerSeed,
  hashServerSeed,
  calculateRandomGameResult,
} from './provablyFair.js';
import {
  getUserById,
  updateUserBalance,
  incrementUserNonce,
  addGameHistory,
} from './db.js';

export interface FlightObstacle {
  id: string;
  type: 'ring' | 'rocket';
  timestampMs: number; // relative to flight start (e.g. 2500ms)
  multiplierFactor: number; // 1.5 for ring, 1/1.5 = 0.6667 for rocket
  position: { x: number; y: number; z: number }; // 3D coordinates for client
}

export interface AirplaneRound {
  roundId: string;
  userId: number;
  bet: number;
  status: 'WAITING' | 'BET_LOCKED' | 'TAKEOFF' | 'FLIGHT' | 'LANDING' | 'RESULT';
  createdAt: number;
  flightStartAt: number;
  flightDurationMs: number; // 8000ms
  obstacles: FlightObstacle[];
  initialMultiplier: number;
  preLandingMultiplier: number;
  finalMultiplier: number;
  landingSuccess: boolean;
  payout: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  hmac: string;
}

class AirplaneEngine {
  private activeRounds: Map<string, AirplaneRound> = new Map();

  public startRound(userId: number, bet: number): AirplaneRound {
    const user = getUserById(userId);
    if (!user) throw new Error('Пользователь не найден');

    const cleanBet = Math.max(5.0, Math.round(Number(bet || 5.0) * 1000) / 1000);
    if (user.balance < cleanBet) {
      throw new Error('Недостаточно токенов на балансе');
    }

    // Deduct bet from server balance
    updateUserBalance(userId, -cleanBet);

    // Provably fair generation
    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    const nonce = incrementUserNonce(userId);
    const clientSeed = user.client_seed;

    // Use random point from HMAC to determine scenario
    const fairRes = calculateRandomGameResult(serverSeed, clientSeed, nonce);
    const roll = fairRes.rollPoint; // 0..999999

    // Landing success: ~72% chance of safe landing
    const landingSuccess = roll % 100 < 72;

    // Generate 4 flight events (mix of rings and rockets)
    // Ring increases multiplier by 1.5
    // Rocket divides multiplier by 1.5, floor at 1.00
    let currentMultiplier = 1.0;
    const obstacles: FlightObstacle[] = [];

    // Obstacle 1 at ~2.5s (mostly ring)
    const isRing1 = roll % 10 < 8;
    if (isRing1) {
      currentMultiplier = Math.round(currentMultiplier * 1.5 * 100) / 100;
      obstacles.push({
        id: 'obs_1',
        type: 'ring',
        timestampMs: 2500,
        multiplierFactor: 1.5,
        position: { x: 0, y: 12, z: -120 },
      });
    } else {
      currentMultiplier = Math.max(1.0, Math.round((currentMultiplier / 1.5) * 100) / 100);
      obstacles.push({
        id: 'obs_1',
        type: 'rocket',
        timestampMs: 2500,
        multiplierFactor: 0.6667,
        position: { x: -3, y: 10, z: -120 },
      });
    }

    // Obstacle 2 at ~4.0s (ring or rocket)
    const isRing2 = Math.floor(roll / 10) % 10 < 6;
    if (isRing2) {
      currentMultiplier = Math.round(currentMultiplier * 1.5 * 100) / 100;
      obstacles.push({
        id: 'obs_2',
        type: 'ring',
        timestampMs: 4000,
        multiplierFactor: 1.5,
        position: { x: 4, y: 16, z: -230 },
      });
    } else {
      currentMultiplier = Math.max(1.0, Math.round((currentMultiplier / 1.5) * 100) / 100);
      obstacles.push({
        id: 'obs_2',
        type: 'rocket',
        timestampMs: 4000,
        multiplierFactor: 0.6667,
        position: { x: 3, y: 15, z: -230 },
      });
    }

    // Obstacle 3 at ~5.5s (ring)
    const isRing3 = Math.floor(roll / 100) % 10 < 7;
    if (isRing3) {
      currentMultiplier = Math.round(currentMultiplier * 1.5 * 100) / 100;
      obstacles.push({
        id: 'obs_3',
        type: 'ring',
        timestampMs: 5500,
        multiplierFactor: 1.5,
        position: { x: -2, y: 14, z: -340 },
      });
    } else {
      currentMultiplier = Math.max(1.0, Math.round((currentMultiplier / 1.5) * 100) / 100);
      obstacles.push({
        id: 'obs_3',
        type: 'rocket',
        timestampMs: 5500,
        multiplierFactor: 0.6667,
        position: { x: -1, y: 12, z: -340 },
      });
    }

    const preLandingMultiplier = currentMultiplier;
    const finalMultiplier = landingSuccess ? preLandingMultiplier : 0;
    const payout = Math.round(cleanBet * finalMultiplier * 1000) / 1000;

    const roundId = `plane_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const now = Date.now();

    const round: AirplaneRound = {
      roundId,
      userId,
      bet: cleanBet,
      status: 'TAKEOFF',
      createdAt: now,
      flightStartAt: now,
      flightDurationMs: 8000,
      obstacles,
      initialMultiplier: 1.0,
      preLandingMultiplier,
      finalMultiplier,
      landingSuccess,
      payout,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      hmac: fairRes.hmac,
    };

    this.activeRounds.set(roundId, round);

    // Auto-clean old rounds after 5 minutes
    setTimeout(() => {
      this.activeRounds.delete(roundId);
    }, 5 * 60 * 1000);

    return round;
  }

  public claimRound(userId: number, roundId: string): {
    round: AirplaneRound;
    balance: number;
  } {
    const round = this.activeRounds.get(roundId);
    if (!round) {
      throw new Error('Раунд не найден или уже завершён');
    }
    if (round.userId !== userId) {
      throw new Error('Вы не являетесь владельцем этого раунда');
    }
    if (round.status === 'RESULT') {
      throw new Error('Раунд уже выплачен');
    }

    // Set state to RESULT
    round.status = 'RESULT';

    // Credit payout if win
    if (round.payout > 0) {
      updateUserBalance(userId, round.payout);
    }

    // Save history
    addGameHistory(
      userId,
      'airplane',
      round.bet,
      round.finalMultiplier,
      round.payout,
      round.serverSeed,
      round.serverSeedHash,
      round.clientSeed,
      round.nonce,
      {
        landingSuccess: round.landingSuccess,
        preLandingMultiplier: round.preLandingMultiplier,
        obstaclesCount: round.obstacles.length,
      }
    );

    const user = getUserById(userId)!;
    this.activeRounds.delete(roundId);

    return { round, balance: user.balance };
  }

  public getRound(roundId: string): AirplaneRound | undefined {
    return this.activeRounds.get(roundId);
  }
}

export const airplaneEngine = new AirplaneEngine();
