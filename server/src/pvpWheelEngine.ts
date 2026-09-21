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
import { notifyPvpWin } from './bot.js';

export interface PvpPlayer {
  userId: number;
  username: string;
  avatarLetter: string;
  isBot: boolean;
  selectedSector?: number; // e.g. 0, 0.5, 1, 1.5, 2, 3, 5
  confirmed: boolean;
}

export interface PvpMatch {
  matchId: string;
  bet: number;
  pot: number;
  commission: number; // 10%
  payout: number; // pot * 0.9
  player1: PvpPlayer;
  player2: PvpPlayer;
  status: 'SELECTING' | 'SPINNING' | 'FINISHED' | 'CANCELLED';
  createdAt: number;
  countdownEndsAt: number; // 15 seconds
  serverSeed?: string;
  serverSeedHash?: string;
  winningSector?: number;
  winnerId?: number | null;
  respinsCount: number;
  tieBreak: boolean;
}

const BOT_NAMES = [
  'crypto_samurai',
  'ton_tiger',
  'cyber_pepe',
  'misha_ton',
  'alex_trader',
  'bull_master',
  'hodl_whale',
  'lucky_strike',
];

const SECTORS = [0, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0];

class PvpWheelManager {
  private activeMatches: Map<string, PvpMatch> = new Map();
  private waitingQueue: Map<number, { userId: number; username: string; bet: number; timestamp: number }> = new Map();

  // Find or create match
  public findMatch(userId: number, username: string, bet: number): PvpMatch {
    const user = getUserById(userId);
    if (!user || user.balance < bet) {
      throw new Error('Недостаточно токенов на балансе');
    }
    if (bet < 5.0) {
      throw new Error('Минимальная ставка: 5 Токенов');
    }

    // Deduct bet from user
    updateUserBalance(userId, -bet);

    // Look for real opponent in queue with same bet
    for (const [waitingId, item] of this.waitingQueue.entries()) {
      if (waitingId !== userId && item.bet === bet) {
        this.waitingQueue.delete(waitingId);
        return this.createMatch(
          { userId, username, isBot: false, avatarLetter: username[0]?.toUpperCase() || 'P', confirmed: false },
          { userId: item.userId, username: item.username, isBot: false, avatarLetter: item.username[0]?.toUpperCase() || 'P', confirmed: false },
          bet
        );
      }
    }

    // No real player immediately available: match with a realistic simulated player
    const randomBotName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const botOpponent: PvpPlayer = {
      userId: 900000 + Math.floor(Math.random() * 10000),
      username: randomBotName,
      avatarLetter: randomBotName[0].toUpperCase(),
      isBot: true,
      confirmed: true,
      // Bot picks a favorite popular sector: 1.5, 2, 3, or 5
      selectedSector: [1.0, 1.5, 2.0, 3.0, 5.0][Math.floor(Math.random() * 5)],
    };

    const realPlayer: PvpPlayer = {
      userId,
      username,
      avatarLetter: username[0]?.toUpperCase() || 'P',
      isBot: false,
      confirmed: false,
    };

    return this.createMatch(realPlayer, botOpponent, bet);
  }

  private createMatch(p1: PvpPlayer, p2: PvpPlayer, bet: number): PvpMatch {
    const matchId = `match_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const pot = bet * 2;
    const payout = Math.round(pot * 0.9 * 1000) / 1000; // 10% commission

    const match: PvpMatch = {
      matchId,
      bet,
      pot,
      commission: 10,
      payout,
      player1: p1,
      player2: p2,
      status: 'SELECTING',
      createdAt: Date.now(),
      countdownEndsAt: Date.now() + 15000,
      respinsCount: 0,
      tieBreak: false,
    };

    this.activeMatches.set(matchId, match);
    return match;
  }

  // Player confirms sector selection
  public selectSector(matchId: string, userId: number, sector: number): PvpMatch {
    const match = this.activeMatches.get(matchId);
    if (!match) {
      throw new Error('Матч не найден');
    }
    if (match.status !== 'SELECTING') {
      throw new Error('Выбор секторов уже завершён');
    }
    if (!SECTORS.includes(sector)) {
      throw new Error('Некорректный сектор');
    }

    if (match.player1.userId === userId) {
      match.player1.selectedSector = sector;
      match.player1.confirmed = true;
    } else if (match.player2.userId === userId) {
      match.player2.selectedSector = sector;
      match.player2.confirmed = true;
    } else {
      throw new Error('Вы не являетесь участником этого матча');
    }

    // If both players have confirmed, resolve outcome
    if (match.player1.confirmed && match.player2.confirmed) {
      this.resolveMatch(match);
    }

    return match;
  }

  private resolveMatch(match: PvpMatch) {
    match.status = 'SPINNING';

    const p1Sector = match.player1.selectedSector!;
    const p2Sector = match.player2.selectedSector!;

    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    let nonce = 1;

    let winningSector = 0;
    let respins = 0;

    // Rule: Keep spinning until it lands on a sector chosen by at least one player
    // (avoiding meaningless round with zero winners per user requirement)
    while (respins < 10) {
      const res = calculateRandomGameResult(serverSeed, 'pvp_wheel_client', nonce);
      winningSector = res.multiplier;

      if (winningSector === p1Sector || winningSector === p2Sector) {
        break;
      }
      nonce++;
      respins++;
    }

    // If still neither after 10 tries, pick one of the chosen sectors deterministically
    if (winningSector !== p1Sector && winningSector !== p2Sector) {
      winningSector = (nonce % 2 === 0) ? p1Sector : p2Sector;
    }

    match.winningSector = winningSector;
    match.respinsCount = respins;
    match.serverSeed = serverSeed;
    match.serverSeedHash = serverSeedHash;

    // Determine winner
    let winnerId: number;
    let isTieBreak = false;

    if (p1Sector === winningSector && p2Sector === winningSector) {
      // Tie-break: both picked the same winning sector -> 50/50 toss
      isTieBreak = true;
      const coin = (parseInt(serverSeed[0], 16) % 2) === 0;
      winnerId = coin ? match.player1.userId : match.player2.userId;
    } else if (p1Sector === winningSector) {
      winnerId = match.player1.userId;
    } else {
      winnerId = match.player2.userId;
    }

    match.winnerId = winnerId;
    match.tieBreak = isTieBreak;
    match.status = 'FINISHED';

    // Credit payout to winner and notify via Telegram push
    if (!match.player1.isBot && match.player1.userId === winnerId) {
      updateUserBalance(match.player1.userId, match.payout);
      notifyPvpWin(match.player1.userId, match.payout);
    } else if (!match.player2.isBot && match.player2.userId === winnerId) {
      updateUserBalance(match.player2.userId, match.payout);
      notifyPvpWin(match.player2.userId, match.payout);
    }

    // Record in history for human player
    const humanPlayer = !match.player1.isBot ? match.player1 : match.player2;
    const opponent = match.player1.isBot ? match.player1 : match.player2;
    const isHumanWinner = winnerId === humanPlayer.userId;

    addGameHistory(
      humanPlayer.userId,
      'pvp_wheel',
      match.bet,
      isHumanWinner ? 1.8 : 0,
      isHumanWinner ? match.payout : 0,
      serverSeed,
      serverSeedHash,
      'pvp_wheel_client',
      nonce,
      {
        opponent: opponent.username,
        playerSector: humanPlayer.selectedSector,
        opponentSector: opponent.selectedSector,
        winningSector,
        tieBreak: isTieBreak,
        payout: isHumanWinner ? match.payout : 0,
        isWin: isHumanWinner,
      }
    );
  }

  public getMatch(matchId: string): PvpMatch | undefined {
    return this.activeMatches.get(matchId);
  }
}

export const pvpWheelManager = new PvpWheelManager();
