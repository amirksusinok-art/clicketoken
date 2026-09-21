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
  generateHmac,
} from './provablyFair.js';
import { notifyReferralEarning } from './bot.js';

export interface ScratchTier {
  id: string;
  name: string;
  cost: number;
  maxPrize: number;
  color: string;
  description: string;
}

export const SCRATCH_TIERS: ScratchTier[] = [
  {
    id: 'bronze',
    name: 'Lucky Start',
    cost: 1.0,
    maxPrize: 50.0,
    color: '#d97706',
    description: 'Лёгкий старт с частыми победами',
  },
  {
    id: 'silver',
    name: 'Cyber Silver',
    cost: 5.0,
    maxPrize: 500.0,
    color: '#38bdf8',
    description: 'Серебряный билет со сбалансированным риском',
  },
  {
    id: 'gold',
    name: 'Golden ASIC',
    cost: 25.0,
    maxPrize: 5000.0,
    color: '#f59e0b',
    description: 'Золотая фольга и внушительные куши',
  },
  {
    id: 'quantum',
    name: 'Quantum VIP',
    cost: 100.0,
    maxPrize: 50000.0,
    color: '#a855f7',
    description: 'Элитный джекпот-билет для крупных игроков',
  },
];

export type ScratchSymbolType =
  | 'gpu'
  | 'energy'
  | 'platinum'
  | 'token'
  | 'diamond'
  | 'quantum'
  | 'ticket';

export interface ScratchSymbolInfo {
  id: ScratchSymbolType;
  label: string;
  icon: string;
  multiplier: number;
}

export const SCRATCH_SYMBOLS: Record<ScratchSymbolType, ScratchSymbolInfo> = {
  gpu: { id: 'gpu', label: 'GPU 1060', icon: '⚡', multiplier: 1.0 },
  energy: { id: 'energy', label: 'Энергия', icon: '🔥', multiplier: 1.5 },
  platinum: { id: 'platinum', label: 'Слиток', icon: '🥈', multiplier: 2.5 },
  token: { id: 'token', label: 'Токен', icon: '🪙', multiplier: 3.0 },
  diamond: { id: 'diamond', label: 'Алмаз', icon: '💎', multiplier: 4.0 },
  quantum: { id: 'quantum', label: 'Квантум', icon: '🪐', multiplier: 10.0 },
  ticket: { id: 'ticket', label: 'Фри-тикет', icon: '🎟️', multiplier: 1.0 },
};

export type BonusType = 'x1' | 'x2' | 'x5' | 'plus_5' | 'plus_10';

export interface ScratchCardResult {
  ticketId: string;
  tier: ScratchTier;
  grid: ScratchSymbolType[]; // 9 items
  bonusBox: {
    type: BonusType;
    label: string;
    multiplier: number;
    extraTokens: number;
  };
  matchedSymbol: ScratchSymbolType | null;
  basePayout: number;
  finalPayout: number;
  multiplier: number;
  isWin: boolean;
  balance: number;
  provablyFair: {
    serverSeed: string;
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
}

export class ScratchEngine {
  public getCatalog(): ScratchTier[] {
    return SCRATCH_TIERS;
  }

  public buyTicket(userId: number, tierId: string): ScratchCardResult {
    const user = getUserById(userId);
    if (!user) throw new Error('Пользователь не найден');

    const tier = SCRATCH_TIERS.find((t) => t.id === tierId) || SCRATCH_TIERS[0];
    if (user.balance < tier.cost) {
      throw new Error(`Недостаточно средств. Стоимость билета: ${tier.cost} Т`);
    }

    // Deduct cost
    updateUserBalance(userId, -tier.cost);

    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);
    const clientSeed = user.client_seed || 'client';
    const nonce = user.nonce || 0;

    const hmac = generateHmac(serverSeed, clientSeed, nonce);

    // Probability roll for win (RTP ~96%)
    // 0..9999
    const winRoll = parseInt(hmac.substring(0, 4), 16) % 10000;

    // Outcome selection:
    // 60% loss (no 3 identical symbols)
    // 16% -> gpu (1x)
    // 10% -> energy (1.5x)
    // 6%  -> platinum (2.5x)
    // 4%  -> token (3.0x)
    // 2.5% -> diamond (4.0x)
    // 1.0% -> quantum (10.0x jackpot)
    // 0.5% -> ticket (free ticket refund 1x)
    let winningSymbol: ScratchSymbolType | null = null;
    if (winRoll < 1600) {
      winningSymbol = 'gpu';
    } else if (winRoll < 2600) {
      winningSymbol = 'energy';
    } else if (winRoll < 3200) {
      winningSymbol = 'platinum';
    } else if (winRoll < 3600) {
      winningSymbol = 'token';
    } else if (winRoll < 3850) {
      winningSymbol = 'diamond';
    } else if (winRoll < 3950) {
      winningSymbol = 'quantum';
    } else if (winRoll < 4000) {
      winningSymbol = 'ticket';
    } else {
      winningSymbol = null; // No win
    }

    // Build 9-cell grid
    const allSymbolKeys: ScratchSymbolType[] = [
      'gpu',
      'energy',
      'platinum',
      'token',
      'diamond',
      'quantum',
      'ticket',
    ];

    const grid: ScratchSymbolType[] = [];

    if (winningSymbol) {
      // Place exactly 3 of the winning symbol
      grid.push(winningSymbol, winningSymbol, winningSymbol);

      // Fill remaining 6 cells without creating any other triple
      let index = 4;
      while (grid.length < 9) {
        const sub = hmac.substring(index, index + 2);
        index = (index + 2) % (hmac.length - 2);
        const randSymbol = allSymbolKeys[parseInt(sub, 16) % allSymbolKeys.length];

        // Ensure no other symbol has >= 3 occurrences
        const count = grid.filter((s) => s === randSymbol).length;
        if (randSymbol !== winningSymbol && count < 2) {
          grid.push(randSymbol);
        } else if (randSymbol === winningSymbol && count < 3) {
          grid.push(randSymbol);
        }
      }
    } else {
      // Losing card: ensure no symbol appears 3 or more times
      let index = 4;
      while (grid.length < 9) {
        const sub = hmac.substring(index, index + 2);
        index = (index + 2) % (hmac.length - 2);
        const randSymbol = allSymbolKeys[parseInt(sub, 16) % allSymbolKeys.length];
        const count = grid.filter((s) => s === randSymbol).length;
        if (count < 2) {
          grid.push(randSymbol);
        }
      }
    }

    // Deterministic shuffle of the 9 cells using hmac
    for (let i = grid.length - 1; i > 0; i--) {
      const sub = hmac.substring(i * 2 + 10, i * 2 + 12);
      const j = parseInt(sub, 16) % (i + 1);
      const temp = grid[i];
      grid[i] = grid[j];
      grid[j] = temp;
    }

    // Bonus Box (Lucky Box)
    const bonusRoll = parseInt(hmac.substring(28, 32), 16) % 100;
    let bonusBox: ScratchCardResult['bonusBox'] = {
      type: 'x1',
      label: '×1',
      multiplier: 1,
      extraTokens: 0,
    };

    if (bonusRoll < 10) {
      bonusBox = { type: 'x5', label: 'БОНУС ×5', multiplier: 5, extraTokens: 0 };
    } else if (bonusRoll < 30) {
      bonusBox = { type: 'x2', label: 'БОНУС ×2', multiplier: 2, extraTokens: 0 };
    } else if (bonusRoll < 40 && winningSymbol) {
      bonusBox = { type: 'plus_10', label: '+10 T', multiplier: 1, extraTokens: 10 };
    }

    // Calculate payouts
    let basePayout = 0;
    let finalPayout = 0;
    let multiplier = 0;
    const isWin = winningSymbol !== null;

    if (winningSymbol) {
      const symbolInfo = SCRATCH_SYMBOLS[winningSymbol];
      basePayout = Math.round(tier.cost * symbolInfo.multiplier * 1000) / 1000;
      finalPayout =
        Math.round((basePayout * bonusBox.multiplier + bonusBox.extraTokens) * 1000) /
        1000;
      multiplier = Math.round((finalPayout / tier.cost) * 100) / 100;

      updateUserBalance(userId, finalPayout);

      // Referral earnings
      if (finalPayout > tier.cost) {
        const refRes = addReferralEarning(userId, finalPayout - tier.cost, 'game');
        if (refRes) {
          notifyReferralEarning(refRes.referrerId, refRes.friendName, refRes.bonus);
        }
      }
    }

    // Record game history
    addGameHistory(
      userId,
      'scratch',
      tier.cost,
      multiplier,
      finalPayout,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce,
      {
        tierId: tier.id,
        matchedSymbol: winningSymbol,
        bonusType: bonusBox.type,
      }
    );

    incrementUserNonce(userId);

    const updatedUser = getUserById(userId)!;

    return {
      ticketId: `t_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      tier,
      grid,
      bonusBox,
      matchedSymbol: winningSymbol,
      basePayout,
      finalPayout,
      multiplier,
      isWin,
      balance: updatedUser.balance,
      provablyFair: {
        serverSeed,
        serverSeedHash,
        clientSeed,
        nonce,
      },
    };
  }
}

export const scratchEngine = new ScratchEngine();
