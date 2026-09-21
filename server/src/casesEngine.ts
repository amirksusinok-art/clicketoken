import {
  getUserById,
  updateUserBalance,
  addGameHistory,
  incrementUserNonce,
  grantSkin,
  addReferralEarning,
} from './db.js';
import { generateServerSeed, hashServerSeed } from './provablyFair.js';
import { notifyReferralEarning } from './bot.js';
import crypto from 'crypto';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface CaseItem {
  id: string;
  name: string;
  type: 'tokens' | 'boost' | 'skin';
  amount?: number;
  skinId?: string;
  skinType?: 'coin' | 'plane';
  rarity: Rarity;
  icon: string;
  weight: number; // probability weight
}

export interface CaseTier {
  id: string;
  name: string;
  cost: number;
  description: string;
  badge: string;
  color: string;
  items: CaseItem[];
}

export const CASES_CATALOG: CaseTier[] = [
  {
    id: 'starter',
    name: 'Стартовый Кейс',
    cost: 0.05,
    description: 'Идеален для новичков. Дроп до x10 от цены!',
    badge: 'СТАРТ',
    color: 'from-amber-600 to-yellow-400',
    items: [
      { id: 's_tok_004', name: '0.04000 Токенов', type: 'tokens', amount: 0.04, rarity: 'common', icon: '🪙', weight: 36 },
      { id: 's_tok_005', name: '0.05000 Токенов', type: 'tokens', amount: 0.05, rarity: 'common', icon: '🪙', weight: 30 },
      { id: 's_tok_007', name: '0.07500 Токенов', type: 'tokens', amount: 0.075, rarity: 'uncommon', icon: '💰', weight: 16 },
      { id: 's_tok_010', name: '0.10000 Токенов (x2)', type: 'tokens', amount: 0.10, rarity: 'rare', icon: '💎', weight: 9 },
      { id: 's_boost_1', name: '⚡ Буст фермы +0.15 Т', type: 'boost', amount: 0.15, rarity: 'epic', icon: '⚡', weight: 5 },
      { id: 's_tok_050', name: '0.50000 Токенов (x10 ДЖЕКПОТ)', type: 'tokens', amount: 0.50, rarity: 'legendary', icon: '🔥', weight: 2 },
      { id: 's_skin_cyber', name: 'Скин «Cyberpunk»', type: 'skin', skinId: 'cyberpunk', skinType: 'coin', rarity: 'legendary', icon: '🎨', weight: 2 },
    ],
  },
  {
    id: 'neon',
    name: 'Неоновый Кейс',
    cost: 0.50,
    description: 'Для активных игроков. Увеличенный шанс на x2 и x5!',
    badge: 'POPULAR',
    color: 'from-cyan-500 to-blue-600',
    items: [
      { id: 'n_tok_040', name: '0.40000 Токенов', type: 'tokens', amount: 0.40, rarity: 'common', icon: '🪙', weight: 35 },
      { id: 'n_tok_050', name: '0.50000 Токенов', type: 'tokens', amount: 0.50, rarity: 'common', icon: '🪙', weight: 29 },
      { id: 'n_tok_075', name: '0.75000 Токенов', type: 'tokens', amount: 0.75, rarity: 'uncommon', icon: '💰', weight: 17 },
      { id: 'n_tok_100', name: '1.00000 Токен (x2)', type: 'tokens', amount: 1.00, rarity: 'rare', icon: '💎', weight: 10 },
      { id: 'n_boost_2', name: '⚡ Мега-буст фермы +1.50 Т', type: 'boost', amount: 1.50, rarity: 'epic', icon: '⚡', weight: 5 },
      { id: 'n_tok_500', name: '5.00000 Токенов (x10 ДЖЕКПОТ)', type: 'tokens', amount: 5.00, rarity: 'legendary', icon: '🔥', weight: 2 },
      { id: 'n_skin_btc', name: 'Скин «Bitcoin»', type: 'skin', skinId: 'bitcoin', skinType: 'coin', rarity: 'legendary', icon: '₿', weight: 2 },
    ],
  },
  {
    id: 'cyberpunk',
    name: 'Киберпанк Кейс',
    cost: 5.00,
    description: 'VIP-кейс хайроллера. Максимальный куш 50.00 Т!',
    badge: 'VIP HOT',
    color: 'from-purple-600 via-fuchsia-500 to-pink-500',
    items: [
      { id: 'c_tok_400', name: '4.00000 Токенов', type: 'tokens', amount: 4.00, rarity: 'common', icon: '🪙', weight: 35 },
      { id: 'c_tok_500', name: '5.00000 Токенов', type: 'tokens', amount: 5.00, rarity: 'common', icon: '🪙', weight: 29 },
      { id: 'c_tok_750', name: '7.50000 Токенов', type: 'tokens', amount: 7.50, rarity: 'uncommon', icon: '💰', weight: 17 },
      { id: 'c_tok_1000', name: '10.0000 Токенов (x2)', type: 'tokens', amount: 10.00, rarity: 'rare', icon: '💎', weight: 10 },
      { id: 'c_boost_3', name: '⚡ Турбо-буст фермы +15.0 Т', type: 'boost', amount: 15.0, rarity: 'epic', icon: '⚡', weight: 5 },
      { id: 'c_tok_5000', name: '50.0000 Токенов (x10 ДЖЕКПОТ)', type: 'tokens', amount: 50.00, rarity: 'legendary', icon: '🔥', weight: 2 },
      { id: 'c_skin_dragon', name: 'Скин «Dragon»', type: 'skin', skinId: 'dragon', skinType: 'coin', rarity: 'legendary', icon: '🐉', weight: 2 },
    ],
  },
];

export class CasesEngine {
  public getCatalog(): CaseTier[] {
    return CASES_CATALOG;
  }

  public openCase(userId: number, caseId: string): {
    success: boolean;
    winningItem: CaseItem;
    rouletteItems: CaseItem[];
    winnerIndex: number;
    balance: number;
    serverSeedHash: string;
  } {
    const user = getUserById(userId);
    if (!user) throw new Error('Пользователь не найден');

    const caseTier = CASES_CATALOG.find((c) => c.id === caseId);
    if (!caseTier) throw new Error('Кейс не найден');

    if (user.balance < caseTier.cost) {
      throw new Error(`Недостаточно средств. Цена кейса: ${caseTier.cost} Т`);
    }

    // Deduct cost
    updateUserBalance(userId, -caseTier.cost);

    // Referral commission
    const refRes = addReferralEarning(userId, caseTier.cost, 'game');
    if (refRes) {
      notifyReferralEarning(refRes.referrerId, refRes.friendName, refRes.bonus);
    }

    const serverSeed = generateServerSeed();
    const serverSeedHash = hashServerSeed(serverSeed);

    // Provably fair weighted random choice
    const totalWeight = caseTier.items.reduce((sum, item) => sum + item.weight, 0);
    const hash = crypto.createHash('sha256').update(`${serverSeed}:${userId}:${Date.now()}`).digest('hex');
    const randomVal = (parseInt(hash.substring(0, 8), 16) % 100000) / 100000;
    let target = randomVal * totalWeight;

    let winningItem = caseTier.items[0];
    for (const item of caseTier.items) {
      if (target < item.weight) {
        winningItem = item;
        break;
      }
      target -= item.weight;
    }

    // Deliver reward to player
    if (winningItem.type === 'tokens' || winningItem.type === 'boost') {
      const reward = winningItem.amount || 0;
      if (reward > 0) {
        updateUserBalance(userId, reward);
      }
    } else if (winningItem.type === 'skin' && winningItem.skinId && winningItem.skinType) {
      grantSkin(userId, winningItem.skinId, winningItem.skinType);
    }

    const updatedUser = getUserById(userId)!;
    const finalPayout = winningItem.amount || (winningItem.type === 'skin' ? caseTier.cost * 2 : 0);
    const mult = Math.round((finalPayout / caseTier.cost) * 100) / 100;

    addGameHistory(
      userId,
      'cases',
      caseTier.cost,
      mult,
      finalPayout,
      serverSeed,
      serverSeedHash,
      updatedUser.client_seed || 'client',
      updatedUser.nonce || 0,
      { caseId, winningItem }
    );
    incrementUserNonce(userId);

    // Build 38 items strip for the client roulette ribbon, placing winner at index 28
    const winnerIndex = 28;
    const rouletteItems: CaseItem[] = [];
    for (let i = 0; i < 38; i++) {
      if (i === winnerIndex) {
        rouletteItems.push(winningItem);
      } else {
        const randItem = caseTier.items[Math.floor(Math.random() * caseTier.items.length)];
        rouletteItems.push(randItem);
      }
    }

    return {
      success: true,
      winningItem,
      rouletteItems,
      winnerIndex,
      balance: updatedUser.balance,
      serverSeedHash,
    };
  }
}

export const casesEngine = new CasesEngine();
