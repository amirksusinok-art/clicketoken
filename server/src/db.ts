import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { VIDEO_CARDS, getCardByLevel } from './farmingConfig.js';
import { SKINS_CATALOG, getSkinById } from './skinsConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '../data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'clicketoken.db');
export const db = new DatabaseSync(dbPath);

// Enable WAL mode for high performance
db.exec(`PRAGMA journal_mode = WAL;`);
db.exec(`PRAGMA synchronous = NORMAL;`);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT,
    username_lower TEXT,
    first_name TEXT,
    balance REAL DEFAULT 0.000,
    earn_per_click REAL DEFAULT 0.00001,
    upgrade_level INTEGER DEFAULT 1,
    client_seed TEXT DEFAULT 'default_client_seed',
    nonce INTEGER DEFAULT 0,
    created_at INTEGER,
    last_click_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(username_lower);

  CREATE TABLE IF NOT EXISTS transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL,
    from_username TEXT,
    to_user_id INTEGER NOT NULL,
    to_username TEXT,
    amount REAL NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_transfers_from ON transfers(from_user_id);
  CREATE INDEX IF NOT EXISTS idx_transfers_to ON transfers(to_user_id);

  CREATE TABLE IF NOT EXISTS game_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    game_type TEXT NOT NULL,
    bet REAL NOT NULL,
    multiplier REAL NOT NULL,
    payout REAL NOT NULL,
    server_seed TEXT NOT NULL,
    server_seed_hash TEXT NOT NULL,
    client_seed TEXT NOT NULL,
    nonce INTEGER NOT NULL,
    details TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_game_history_game ON game_history(game_type, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_game_history_user ON game_history(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    friend_user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(user_id, friend_user_id)
  );

  CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id);

  CREATE TABLE IF NOT EXISTS favorite_games (
    user_id INTEGER NOT NULL,
    game_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY(user_id, game_id)
  );

  CREATE TABLE IF NOT EXISTS referrals (
    referrer_id INTEGER NOT NULL,
    referred_id INTEGER NOT NULL PRIMARY KEY,
    bonus_paid REAL NOT NULL,
    earned_from_clicks REAL DEFAULT 0,
    earned_from_games REAL DEFAULT 0,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

  CREATE TABLE IF NOT EXISTS user_skins (
    user_id INTEGER NOT NULL,
    skin_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY(user_id, skin_id)
  );

  CREATE TABLE IF NOT EXISTS staking_deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    term_days INTEGER NOT NULL,
    interest_percent REAL NOT NULL,
    start_time INTEGER NOT NULL,
    end_time INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_staking_user ON staking_deposits(user_id, status);
`);

// Dynamic safe migrations
const safeAddCol = (colSql: string) => {
  try {
    db.exec(colSql);
  } catch {}
};

safeAddCol(`ALTER TABLE users ADD COLUMN hide_public_balance INTEGER DEFAULT 0;`);
safeAddCol(`ALTER TABLE users ADD COLUMN mining_level INTEGER DEFAULT 0;`);
safeAddCol(`ALTER TABLE users ADD COLUMN last_farm_claim_at INTEGER DEFAULT 0;`);
safeAddCol(`ALTER TABLE users ADD COLUMN referral_unclaimed REAL DEFAULT 0;`);
safeAddCol(`ALTER TABLE users ADD COLUMN referred_by INTEGER DEFAULT NULL;`);
safeAddCol(`ALTER TABLE users ADD COLUMN active_coin_skin TEXT DEFAULT 'default';`);
safeAddCol(`ALTER TABLE users ADD COLUMN active_plane_skin TEXT DEFAULT 'default';`);
safeAddCol(`ALTER TABLE users ADD COLUMN last_storage_notified_at INTEGER DEFAULT 0;`);
safeAddCol(`ALTER TABLE users ADD COLUMN daily_streak INTEGER DEFAULT 0;`);
safeAddCol(`ALTER TABLE users ADD COLUMN last_daily_claim_at INTEGER DEFAULT 0;`);

export interface UserRow {
  id: number;
  username: string | null;
  username_lower: string | null;
  first_name: string;
  balance: number;
  earn_per_click: number;
  upgrade_level: number;
  client_seed: string;
  nonce: number;
  hide_public_balance?: number;
  mining_level?: number;
  last_farm_claim_at?: number;
  referral_unclaimed?: number;
  referred_by?: number | null;
  active_coin_skin?: string;
  active_plane_skin?: string;
  last_storage_notified_at?: number;
  daily_streak?: number;
  last_daily_claim_at?: number;
  created_at: number;
  last_click_at: number;
}

export interface TransferRow {
  id: number;
  from_user_id: number;
  from_username: string | null;
  to_user_id: number;
  to_username: string | null;
  amount: number;
  created_at: number;
}

export interface GameHistoryRow {
  id: number;
  user_id: number;
  game_type: string;
  bet: number;
  multiplier: number;
  payout: number;
  server_seed: string;
  server_seed_hash: string;
  client_seed: string;
  nonce: number;
  details: string;
  created_at: number;
}

// User methods
export function findOrCreateUser(
  id: number,
  first_name: string,
  username?: string | null,
  referrerId?: number,
  isPremium?: boolean
): UserRow {
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow | undefined;
  const now = Date.now();
  const username_lower = username ? username.toLowerCase() : null;

  if (existing) {
    // Update username/name if changed
    if (existing.username !== (username || null) || existing.first_name !== first_name) {
      db.prepare(
        'UPDATE users SET username = ?, username_lower = ?, first_name = ? WHERE id = ?'
      ).run(username || null, username_lower, first_name, id);
      existing.username = username || null;
      existing.username_lower = username_lower;
      existing.first_name = first_name;
    }
    return existing;
  }

  // Handle referral bonus if valid referrer
  if (referrerId && referrerId !== id) {
    const referrer = getUserById(referrerId);
    if (referrer) {
      const bonus = isPremium ? 5.0 : 1.0;
      db.prepare(`
        INSERT INTO users (id, username, username_lower, first_name, balance, earn_per_click, upgrade_level, client_seed, nonce, referred_by, created_at, last_click_at)
        VALUES (?, ?, ?, ?, ?, 0.00001, 1, 'client_seed_' || ?, 0, ?, ?, ?)
      `).run(id, username || null, username_lower, first_name, bonus, id, referrerId, now, now);

      // Reward referrer immediately with welcome bonus
      db.prepare('UPDATE users SET balance = ROUND(balance + ?, 4) WHERE id = ?').run(bonus, referrerId);

      // Record in referrals table
      db.prepare(`
        INSERT INTO referrals (referrer_id, referred_id, bonus_paid, earned_from_clicks, earned_from_games, created_at)
        VALUES (?, ?, ?, 0, 0, ?)
      `).run(referrerId, id, bonus, now);

      return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow;
    }
  }

  db.prepare(`
    INSERT INTO users (id, username, username_lower, first_name, balance, earn_per_click, upgrade_level, client_seed, nonce, created_at, last_click_at)
    VALUES (?, ?, ?, ?, 0.000, 0.00001, 1, 'client_seed_' || ?, 0, ?, ?)
  `).run(id, username || null, username_lower, first_name, id, now, now);

  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow;
}

export function getUserById(id: number): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as unknown as UserRow | undefined;
}

export function getUserByUsername(username: string): UserRow | undefined {
  const clean = username.replace(/^@/, '').trim().toLowerCase();
  return db.prepare('SELECT * FROM users WHERE username_lower = ?').get(clean) as unknown as UserRow | undefined;
}

export function updateUserBalance(id: number, delta: number): UserRow {
  db.prepare('UPDATE users SET balance = ROUND(balance + ?, 4) WHERE id = ?').run(delta, id);
  return getUserById(id)!;
}

export function recordClicksBatch(
  id: number,
  clicksCount: number,
  earnedAmount: number
): UserRow {
  const now = Date.now();
  db.prepare(`
    UPDATE users 
    SET balance = ROUND(balance + ?, 4),
        last_click_at = ?
    WHERE id = ?
  `).run(earnedAmount, now, id);
  return getUserById(id)!;
}

export function upgradeUser(
  id: number,
  newLevel: number,
  newEarnPerClick: number,
  cost: number
): UserRow {
  db.prepare(`
    UPDATE users 
    SET balance = ROUND(balance - ?, 4),
        upgrade_level = ?,
        earn_per_click = ?
    WHERE id = ? AND balance >= ?
  `).run(cost, newLevel, newEarnPerClick, id, cost);
  return getUserById(id)!;
}

export function updateUserSeed(id: number, client_seed: string): UserRow {
  db.prepare('UPDATE users SET client_seed = ? WHERE id = ?').run(client_seed, id);
  return getUserById(id)!;
}

export function incrementUserNonce(id: number): number {
  db.prepare('UPDATE users SET nonce = nonce + 1 WHERE id = ?').run(id);
  const user = getUserById(id);
  return user ? user.nonce : 1;
}

// Transfer methods
export function executeTransfer(
  fromId: number,
  toId: number,
  amount: number
): { success: boolean; error?: string; transfer?: TransferRow } {
  if (fromId === toId) {
    return { success: false, error: 'Нельзя перевести токены самому себе' };
  }
  if (amount <= 0) {
    return { success: false, error: 'Сумма должна быть больше 0' };
  }

  const sender = getUserById(fromId);
  const receiver = getUserById(toId);

  if (!sender) return { success: false, error: 'Отправитель не найден' };
  if (!receiver) return { success: false, error: 'Получатель не найден' };
  if (sender.balance < amount) {
    return { success: false, error: 'Недостаточно токенов на балансе' };
  }

  const now = Date.now();

  // Execute transfer atomically
  db.exec('BEGIN IMMEDIATE TRANSACTION;');
  try {
    db.prepare('UPDATE users SET balance = ROUND(balance - ?, 4) WHERE id = ?').run(amount, fromId);
    db.prepare('UPDATE users SET balance = ROUND(balance + ?, 4) WHERE id = ?').run(amount, toId);
    
    db.prepare(`
      INSERT INTO transfers (from_user_id, from_username, to_user_id, to_username, amount, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      fromId,
      sender.username || sender.first_name,
      toId,
      receiver.username || receiver.first_name,
      amount,
      now
    );

    db.exec('COMMIT;');
  } catch (err: any) {
    db.exec('ROLLBACK;');
    return { success: false, error: err.message || 'Ошибка транзакции' };
  }

  const transfer = db.prepare(
    'SELECT * FROM transfers WHERE from_user_id = ? AND created_at = ? ORDER BY id DESC LIMIT 1'
  ).get(fromId, now) as unknown as TransferRow;

  return { success: true, transfer };
}

export function getUserTransfers(userId: number, limit = 20): TransferRow[] {
  return db.prepare(`
    SELECT * FROM transfers 
    WHERE from_user_id = ? OR to_user_id = ?
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(userId, userId, limit) as unknown as TransferRow[];
}

// Game history methods
export function addGameHistory(
  userId: number,
  gameType: string,
  bet: number,
  multiplier: number,
  payout: number,
  serverSeed: string,
  serverSeedHash: string,
  clientSeed: string,
  nonce: number,
  details: Record<string, any>
): GameHistoryRow {
  const now = Date.now();
  db.prepare(`
    INSERT INTO game_history 
    (user_id, game_type, bet, multiplier, payout, server_seed, server_seed_hash, client_seed, nonce, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    gameType,
    bet,
    multiplier,
    payout,
    serverSeed,
    serverSeedHash,
    clientSeed,
    nonce,
    JSON.stringify(details),
    now
  );

  return db.prepare('SELECT * FROM game_history WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId) as unknown as GameHistoryRow;
}

export function getGameHistory(gameType?: string, limit = 15): GameHistoryRow[] {
  if (gameType) {
    return db.prepare(`
      SELECT * FROM game_history 
      WHERE game_type = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(gameType, limit) as unknown as GameHistoryRow[];
  }
  return db.prepare(`
    SELECT * FROM game_history 
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(limit) as unknown as GameHistoryRow[];
}

// Friends methods
export interface FriendUser {
  id: number;
  username: string | null;
  first_name: string;
  balance: number;
  earn_per_click: number;
  hide_public_balance: number;
  added_at: number;
}

export function getFriends(userId: number): FriendUser[] {
  return db.prepare(`
    SELECT 
      u.id, 
      u.username, 
      u.first_name, 
      u.balance, 
      u.earn_per_click, 
      COALESCE(u.hide_public_balance, 0) as hide_public_balance,
      f.created_at as added_at
    FROM friends f
    JOIN users u ON u.id = f.friend_user_id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).all(userId) as unknown as FriendUser[];
}

export function addFriend(userId: number, friendUserId: number): boolean {
  if (userId === friendUserId) return false;
  const exists = db.prepare('SELECT id FROM friends WHERE user_id = ? AND friend_user_id = ?').get(userId, friendUserId);
  if (exists) return true;
  db.prepare('INSERT INTO friends (user_id, friend_user_id, created_at) VALUES (?, ?, ?)').run(userId, friendUserId, Date.now());
  return true;
}

export function removeFriend(userId: number, friendUserId: number): boolean {
  db.prepare('DELETE FROM friends WHERE user_id = ? AND friend_user_id = ?').run(userId, friendUserId);
  return true;
}

export function isFriend(userId: number, friendUserId: number): boolean {
  const row = db.prepare('SELECT id FROM friends WHERE user_id = ? AND friend_user_id = ?').get(userId, friendUserId);
  return !!row;
}

export function searchUsersByUsername(query: string, currentUserId: number, limit = 10): FriendUser[] {
  const clean = query.trim().replace(/^@/, '').toLowerCase();
  if (!clean) return [];
  return db.prepare(`
    SELECT 
      u.id, 
      u.username, 
      u.first_name, 
      u.balance, 
      u.earn_per_click, 
      COALESCE(u.hide_public_balance, 0) as hide_public_balance,
      0 as added_at
    FROM users u
    WHERE (u.username_lower LIKE ? OR LOWER(u.first_name) LIKE ?)
      AND u.id != ?
    LIMIT ?
  `).all(`%${clean}%`, `%${clean}%`, currentUserId, limit) as unknown as FriendUser[];
}

export function getUserPublicStats(userId: number): {
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: number;
} {
  const rows = db.prepare(`
    SELECT multiplier, payout 
    FROM game_history 
    WHERE user_id = ?
  `).all(userId) as { multiplier: number; payout: number }[];

  const totalMatches = rows.length;
  let wins = 0;
  for (const r of rows) {
    if (r.payout > 0 || r.multiplier >= 1.0) {
      wins++;
    }
  }
  const losses = totalMatches - wins;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  return { totalMatches, wins, losses, winRate };
}

export function updateUserPrivacy(userId: number, hideBalance: boolean) {
  db.prepare('UPDATE users SET hide_public_balance = ? WHERE id = ?').run(hideBalance ? 1 : 0, userId);
}

// Favorite games methods
export function getFavoriteGames(userId: number): string[] {
  const rows = db.prepare('SELECT game_id FROM favorite_games WHERE user_id = ? ORDER BY created_at ASC').all(userId) as { game_id: string }[];
  return rows.map((r) => r.game_id);
}

export function toggleFavoriteGame(userId: number, gameId: string): string[] {
  const exists = db.prepare('SELECT game_id FROM favorite_games WHERE user_id = ? AND game_id = ?').get(userId, gameId);
  if (exists) {
    db.prepare('DELETE FROM favorite_games WHERE user_id = ? AND game_id = ?').run(userId, gameId);
  } else {
    db.prepare('INSERT INTO favorite_games (user_id, game_id, created_at) VALUES (?, ?, ?)').run(userId, gameId, Date.now());
  }
  return getFavoriteGames(userId);
}

// ----------------------------------------------------
// Farming (Mining Farm & Video Cards)
// ----------------------------------------------------

export function getMiningState(userId: number) {
  const user = getUserById(userId);
  if (!user) return null;

  const currentLevel = user.mining_level || 0;
  const currentCard = getCardByLevel(currentLevel);
  const nextCard = getCardByLevel(currentLevel + 1);

  if (!currentCard) {
    return {
      miningLevel: 0,
      currentCard: null,
      nextCard: getCardByLevel(1) || null,
      accumulated: 0,
      maxStorageTokens: 0,
      storageFullPercent: 0,
      storageTimeLeftSec: 0,
      lastClaimAt: user.last_farm_claim_at || 0,
    };
  }

  const now = Date.now();
  const lastClaim = user.last_farm_claim_at || now;
  const elapsedMs = Math.max(0, now - lastClaim);
  const maxStorageMs = currentCard.storageHours * 3600 * 1000;
  const effectiveMs = Math.min(elapsedMs, maxStorageMs);

  const accumulated = Math.round((effectiveMs / (3600 * 1000)) * currentCard.earnPerHour * 10000) / 10000;
  const maxStorageTokens = Math.round(currentCard.storageHours * currentCard.earnPerHour * 10000) / 10000;
  const storageFullPercent = Math.min(100, Math.round((effectiveMs / maxStorageMs) * 100));
  const storageTimeLeftSec = Math.max(0, Math.round((maxStorageMs - effectiveMs) / 1000));

  return {
    miningLevel: currentLevel,
    currentCard,
    nextCard: nextCard || null,
    accumulated,
    maxStorageTokens,
    storageFullPercent,
    storageTimeLeftSec,
    lastClaimAt: lastClaim,
  };
}

export function claimMiningReward(userId: number): { claimed: number; newBalance: number } {
  const state = getMiningState(userId);
  if (!state || state.accumulated <= 0) {
    const user = getUserById(userId);
    return { claimed: 0, newBalance: user ? user.balance : 0 };
  }

  const claimed = state.accumulated;
  const now = Date.now();
  db.prepare(`
    UPDATE users 
    SET balance = ROUND(balance + ?, 4),
        last_farm_claim_at = ?
    WHERE id = ?
  `).run(claimed, now, userId);

  const updatedUser = getUserById(userId)!;
  return { claimed, newBalance: updatedUser.balance };
}

export function upgradeMiningFarm(userId: number): { success: boolean; newLevel: number; newBalance: number; error?: string } {
  const user = getUserById(userId);
  if (!user) return { success: false, newLevel: 0, newBalance: 0, error: 'Пользователь не найден' };

  const currentLevel = user.mining_level || 0;
  const nextCard = getCardByLevel(currentLevel + 1);
  if (!nextCard) {
    return { success: false, newLevel: currentLevel, newBalance: user.balance, error: 'Достигнут максимальный уровень фермы' };
  }

  if (user.balance < nextCard.cost) {
    return { success: false, newLevel: currentLevel, newBalance: user.balance, error: 'Недостаточно токенов для покупки' };
  }

  // Claim any existing accumulated profit first
  const existingState = getMiningState(userId);
  const pendingProfit = existingState ? existingState.accumulated : 0;

  const now = Date.now();
  db.prepare(`
    UPDATE users 
    SET balance = ROUND(balance - ? + ?, 4),
        mining_level = ?,
        last_farm_claim_at = ?
    WHERE id = ?
  `).run(nextCard.cost, pendingProfit, nextCard.level, now, userId);

  const updatedUser = getUserById(userId)!;
  return { success: true, newLevel: nextCard.level, newBalance: updatedUser.balance };
}

export function checkFullFarmsAndNotify(notifyCallback: (userId: number) => void) {
  const users = db.prepare(`
    SELECT id, mining_level, last_farm_claim_at, created_at, COALESCE(last_storage_notified_at, 0) as last_storage_notified_at
    FROM users
    WHERE mining_level >= 0
  `).all() as { id: number; mining_level: number; last_farm_claim_at: number; created_at: number; last_storage_notified_at: number }[];

  const now = Date.now();
  for (const u of users) {
    const card = getCardByLevel(u.mining_level || 1) || VIDEO_CARDS[0];
    const storageDurationMs = card.storageHours * 3600 * 1000;
    const lastClaim = u.last_farm_claim_at || u.created_at || now;
    const isFull = (now - lastClaim) >= storageDurationMs;

    if (isFull && u.last_storage_notified_at < lastClaim) {
      db.prepare('UPDATE users SET last_storage_notified_at = ? WHERE id = ?').run(now, u.id);
      notifyCallback(u.id);
    }
  }
}

// ----------------------------------------------------
// Referrals 2.0
// ----------------------------------------------------

export function addReferralEarning(
  referredId: number,
  amountEarned: number,
  type: 'click' | 'game'
): { referrerId: number; bonus: number; friendName: string } | null {
  if (amountEarned <= 0) return null;
  const user = getUserById(referredId);
  if (!user || !user.referred_by) return null;

  const referrerId = user.referred_by;
  const rate = type === 'click' ? 0.10 : 0.05;
  const bonus = Math.round(amountEarned * rate * 10000) / 10000;
  if (bonus <= 0) return null;

  // Credit to referrer safe
  db.prepare('UPDATE users SET referral_unclaimed = ROUND(COALESCE(referral_unclaimed, 0) + ?, 4) WHERE id = ?').run(bonus, referrerId);

  // Update referrals table tracking
  if (type === 'click') {
    db.prepare('UPDATE referrals SET earned_from_clicks = ROUND(earned_from_clicks + ?, 4) WHERE referrer_id = ? AND referred_id = ?').run(bonus, referrerId, referredId);
  } else {
    db.prepare('UPDATE referrals SET earned_from_games = ROUND(earned_from_games + ?, 4) WHERE referrer_id = ? AND referred_id = ?').run(bonus, referrerId, referredId);
  }

  const friendName = user.username ? `@${user.username}` : (user.first_name || 'друг');
  return { referrerId, bonus, friendName };
}

export function claimReferralEarnings(userId: number): { claimed: number; newBalance: number } {
  const user = getUserById(userId);
  if (!user) return { claimed: 0, newBalance: 0 };

  const unclaimed = user.referral_unclaimed || 0;
  if (unclaimed <= 0) return { claimed: 0, newBalance: user.balance };

  db.prepare(`
    UPDATE users 
    SET balance = ROUND(balance + ?, 4),
        referral_unclaimed = 0
    WHERE id = ?
  `).run(unclaimed, userId);

  const updatedUser = getUserById(userId)!;
  return { claimed: unclaimed, newBalance: updatedUser.balance };
}

export interface ReferralFriendItem {
  id: number;
  username: string | null;
  first_name: string;
  bonusPaid: number;
  earnedTotal: number;
  createdAt: number;
}

export function getReferralsInfo(userId: number) {
  const user = getUserById(userId);
  if (!user) return null;

  const unclaimed = user.referral_unclaimed || 0;

  const rows = db.prepare(`
    SELECT 
      r.referred_id as id,
      u.username,
      u.first_name,
      r.bonus_paid as bonusPaid,
      ROUND(r.earned_from_clicks + r.earned_from_games, 4) as earnedTotal,
      r.created_at as createdAt
    FROM referrals r
    JOIN users u ON u.id = r.referred_id
    WHERE r.referrer_id = ?
    ORDER BY r.created_at DESC
  `).all(userId) as unknown as ReferralFriendItem[];

  let totalEarned = 0;
  for (const r of rows) {
    totalEarned += (r.earnedTotal || 0) + (r.bonusPaid || 0);
  }

  // Top 10 inviters overall
  const topInviters = db.prepare(`
    SELECT 
      u.id,
      u.username,
      u.first_name,
      COUNT(r.referred_id) as friendsCount,
      ROUND(SUM(r.bonus_paid + r.earned_from_clicks + r.earned_from_games), 4) as totalEarned
    FROM referrals r
    JOIN users u ON u.id = r.referrer_id
    GROUP BY r.referrer_id
    ORDER BY friendsCount DESC, totalEarned DESC
    LIMIT 10
  `).all() as any[];

  return {
    unclaimedBalance: unclaimed,
    totalEarned: Math.round(totalEarned * 10000) / 10000,
    friendsCount: rows.length,
    friends: rows,
    topInviters,
  };
}

// ----------------------------------------------------
// Skins Shop
// ----------------------------------------------------

export function getUserPurchasedSkins(userId: number): string[] {
  const rows = db.prepare('SELECT skin_id FROM user_skins WHERE user_id = ?').all(userId) as { skin_id: string }[];
  return ['default', ...rows.map((r) => r.skin_id)];
}

export function buySkin(userId: number, skinId: string, skinType: 'coin' | 'plane'): { success: boolean; error?: string; newBalance?: number } {
  const skin = getSkinById(skinId, skinType);
  if (!skin) return { success: false, error: 'Скин не найден' };

  const user = getUserById(userId);
  if (!user) return { success: false, error: 'User not found' };

  if (skin.cost === 0) {
    return { success: true, newBalance: user.balance };
  }

  const owned = getUserPurchasedSkins(userId);
  if (owned.includes(skinId)) {
    return { success: false, error: 'Скин уже куплен' };
  }

  if (user.balance < skin.cost) {
    return { success: false, error: 'Недостаточно токенов' };
  }

  const now = Date.now();
  db.prepare('UPDATE users SET balance = ROUND(balance - ?, 4) WHERE id = ?').run(skin.cost, userId);
  db.prepare('INSERT INTO user_skins (user_id, skin_id, created_at) VALUES (?, ?, ?)').run(userId, skinId, now);

  // Equip automatically
  if (skinType === 'coin') {
    db.prepare('UPDATE users SET active_coin_skin = ? WHERE id = ?').run(skinId, userId);
  } else {
    db.prepare('UPDATE users SET active_plane_skin = ? WHERE id = ?').run(skinId, userId);
  }

  const updatedUser = getUserById(userId)!;
  return { success: true, newBalance: updatedUser.balance };
}

export function equipSkin(userId: number, skinId: string, skinType: 'coin' | 'plane'): { success: boolean; error?: string } {
  const owned = getUserPurchasedSkins(userId);
  if (!owned.includes(skinId)) {
    return { success: false, error: 'Вы не владеете этим скином' };
  }

  if (skinType === 'coin') {
    db.prepare('UPDATE users SET active_coin_skin = ? WHERE id = ?').run(skinId, userId);
  } else {
    db.prepare('UPDATE users SET active_plane_skin = ? WHERE id = ?').run(skinId, userId);
  }

  return { success: true };
}

export function grantSkin(userId: number, skinId: string, skinType: 'coin' | 'plane'): boolean {
  const owned = getUserPurchasedSkins(userId);
  if (!owned.includes(skinId)) {
    db.prepare('INSERT INTO user_skins (user_id, skin_id, created_at) VALUES (?, ?, ?)').run(userId, skinId, Date.now());
  }
  if (skinType === 'coin') {
    db.prepare('UPDATE users SET active_coin_skin = ? WHERE id = ?').run(skinId, userId);
  } else {
    db.prepare('UPDATE users SET active_plane_skin = ? WHERE id = ?').run(skinId, userId);
  }
  return true;
}

// ----------------------------------------------------
// Staking Vault
// ----------------------------------------------------

export interface StakingDepositRow {
  id: number;
  user_id: number;
  amount: number;
  term_days: number;
  interest_percent: number;
  start_time: number;
  end_time: number;
  status: 'active' | 'completed' | 'early_withdrawn';
  created_at: number;
}

export const STAKING_PLANS: Record<number, number> = {
  7: 5,    // 7 days -> +5%
  14: 12,  // 14 days -> +12%
  30: 30,  // 30 days -> +30%
};

export function createStakingDeposit(userId: number, amount: number, termDays: number) {
  const roundedAmount = Math.round(amount * 10000) / 10000;
  if (isNaN(roundedAmount) || roundedAmount < 1.0) {
    return { success: false, error: 'Минимальный депозит: 1.0 T' };
  }

  const interestPercent = STAKING_PLANS[termDays];
  if (!interestPercent) {
    return { success: false, error: 'Недопустимый срок депозита (доступно: 7, 14, 30 дней)' };
  }

  const user = getUserById(userId);
  if (!user) return { success: false, error: 'Пользователь не найден' };

  if (user.balance < roundedAmount) {
    return { success: false, error: 'Недостаточно средств на балансе' };
  }

  const now = Date.now();
  const endTime = now + termDays * 24 * 60 * 60 * 1000;

  // Deduct balance
  db.prepare('UPDATE users SET balance = ROUND(balance - ?, 4) WHERE id = ?').run(roundedAmount, userId);

  // Create deposit record
  const result = db.prepare(`
    INSERT INTO staking_deposits (user_id, amount, term_days, interest_percent, start_time, end_time, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
  `).run(userId, roundedAmount, termDays, interestPercent, now, endTime, now);

  const updatedUser = getUserById(userId)!;
  return {
    success: true,
    depositId: Number(result.lastInsertRowid),
    newBalance: updatedUser.balance,
  };
}

export function getUserStakingDeposits(userId: number) {
  const deposits = db.prepare(`
    SELECT * FROM staking_deposits
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId) as unknown as StakingDepositRow[];

  const now = Date.now();
  return deposits.map((d) => {
    const profit = Math.round((d.amount * (d.interest_percent / 100)) * 10000) / 10000;
    const isMatured = now >= d.end_time;
    const remainingMs = Math.max(0, d.end_time - now);
    return {
      ...d,
      profit,
      totalPayout: Math.round((d.amount + profit) * 10000) / 10000,
      isMatured,
      remainingMs,
    };
  });
}

export function claimStakingDeposit(userId: number, depositId: number) {
  const deposit = db.prepare(`
    SELECT * FROM staking_deposits WHERE id = ? AND user_id = ?
  `).get(depositId, userId) as unknown as StakingDepositRow | undefined;

  if (!deposit) {
    return { success: false, error: 'Депозит не найден' };
  }

  if (deposit.status !== 'active') {
    return { success: false, error: 'Депозит уже закрыт' };
  }

  const now = Date.now();
  if (now < deposit.end_time) {
    return { success: false, error: 'Срок депозита ещё не истёк' };
  }

  const profit = Math.round((deposit.amount * (deposit.interest_percent / 100)) * 10000) / 10000;
  const totalPayout = Math.round((deposit.amount + profit) * 10000) / 10000;

  db.prepare(`UPDATE staking_deposits SET status = 'completed' WHERE id = ?`).run(depositId);
  db.prepare(`UPDATE users SET balance = ROUND(balance + ?, 4) WHERE id = ?`).run(totalPayout, userId);

  const updatedUser = getUserById(userId)!;
  return {
    success: true,
    payout: totalPayout,
    profit,
    newBalance: updatedUser.balance,
  };
}

export function withdrawStakingDepositEarly(userId: number, depositId: number) {
  const deposit = db.prepare(`
    SELECT * FROM staking_deposits WHERE id = ? AND user_id = ?
  `).get(depositId, userId) as unknown as StakingDepositRow | undefined;

  if (!deposit) {
    return { success: false, error: 'Депозит не найден' };
  }

  if (deposit.status !== 'active') {
    return { success: false, error: 'Депозит уже закрыт' };
  }

  // Early withdrawal: return principal only, 0% profit
  db.prepare(`UPDATE staking_deposits SET status = 'early_withdrawn' WHERE id = ?`).run(depositId);
  db.prepare(`UPDATE users SET balance = ROUND(balance + ?, 4) WHERE id = ?`).run(deposit.amount, userId);

  const updatedUser = getUserById(userId)!;
  return {
    success: true,
    returnedPrincipal: deposit.amount,
    newBalance: updatedUser.balance,
  };
}

// ----------------------------------------------------
// Daily Streak Rewards (7 Days)
// ----------------------------------------------------

export const DAILY_STREAK_REWARDS = [0.1, 0.25, 0.5, 1.0, 2.0, 3.5, 5.0];

export function getDailyStreakState(userId: number) {
  const user = getUserById(userId);
  if (!user) return null;

  const now = Date.now();
  const lastClaim = user.last_daily_claim_at || 0;
  const currentStreak = user.daily_streak || 0;

  // Window: can claim after 20 hours. If more than 48 hours passed, streak resets to 0.
  const elapsed = now - lastClaim;
  const CLAIM_COOLDOWN_MS = 20 * 60 * 60 * 1000; // 20 hours
  const STREAK_RESET_MS = 48 * 60 * 60 * 1000;    // 48 hours

  let effectiveStreak = currentStreak;
  let canClaim = false;
  let remainingMs = 0;

  if (lastClaim === 0) {
    canClaim = true;
    effectiveStreak = 0;
  } else if (elapsed > STREAK_RESET_MS) {
    // Streak broken
    effectiveStreak = 0;
    canClaim = true;
  } else if (elapsed >= CLAIM_COOLDOWN_MS) {
    canClaim = true;
  } else {
    canClaim = false;
    remainingMs = CLAIM_COOLDOWN_MS - elapsed;
  }

  // Next reward index (1 to 7)
  const nextRewardDay = (effectiveStreak % 7) + 1;

  return {
    streak: effectiveStreak,
    canClaim,
    remainingMs,
    nextRewardDay,
    nextRewardAmount: DAILY_STREAK_REWARDS[nextRewardDay - 1],
    rewards: DAILY_STREAK_REWARDS,
  };
}

export function claimDailyReward(userId: number) {
  const state = getDailyStreakState(userId);
  if (!state) return { success: false, error: 'Пользователь не найден' };

  if (!state.canClaim) {
    const hours = Math.ceil(state.remainingMs / (1000 * 60 * 60));
    return { success: false, error: `Награда будет доступна через ${hours} ч.` };
  }

  const rewardAmount = state.nextRewardAmount;
  const newStreak = state.streak + 1;
  const now = Date.now();

  db.prepare(`
    UPDATE users
    SET balance = ROUND(balance + ?, 4),
        daily_streak = ?,
        last_daily_claim_at = ?
    WHERE id = ?
  `).run(rewardAmount, newStreak, now, userId);

  const updatedUser = getUserById(userId)!;
  return {
    success: true,
    rewardAmount,
    newStreak,
    newBalance: updatedUser.balance,
    dayClaimed: state.nextRewardDay,
  };
}

// ----------------------------------------------------
// Admin Operations (Exclusive for ID 5394575689)
// ----------------------------------------------------

export const ADMIN_TELEGRAM_ID = 5394575689;

export function isAdminUser(userId: number): boolean {
  return userId === ADMIN_TELEGRAM_ID;
}

export function findUserByQuery(query: string | number): UserRow | null {
  const clean = String(query).trim().replace(/^@/, '');
  if (!clean) return null;

  const numericId = Number(clean);
  if (!isNaN(numericId) && numericId > 0) {
    const byId = db.prepare('SELECT * FROM users WHERE id = ?').get(numericId) as unknown as UserRow | undefined;
    if (byId) return byId;
  }

  const byUsername = db.prepare('SELECT * FROM users WHERE username_lower = ?').get(clean.toLowerCase()) as unknown as UserRow | undefined;
  return byUsername || null;
}

export function adminAddBalance(targetUserId: number, amount: number) {
  const user = getUserById(targetUserId);
  if (!user) return { success: false, error: 'Пользователь не найден' };

  const rounded = Math.round(amount * 10000) / 10000;
  db.prepare('UPDATE users SET balance = ROUND(balance + ?, 4) WHERE id = ?').run(rounded, targetUserId);
  const updated = getUserById(targetUserId)!;
  return { success: true, user: updated };
}

export function adminSetBalance(targetUserId: number, newBalance: number) {
  const user = getUserById(targetUserId);
  if (!user) return { success: false, error: 'Пользователь не найден' };

  const rounded = Math.max(0, Math.round(newBalance * 10000) / 10000);
  db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(rounded, targetUserId);
  const updated = getUserById(targetUserId)!;
  return { success: true, user: updated };
}

export function adminGetStats() {
  const usersCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any)?.c || 0;
  const totalBalance = (db.prepare('SELECT SUM(balance) as s FROM users').get() as any)?.s || 0;
  
  const activeStaking = (db.prepare(`
    SELECT COUNT(*) as count, SUM(amount) as volume
    FROM staking_deposits
    WHERE status = 'active'
  `).get() as any) || { count: 0, volume: 0 };

  const gamesCount = (db.prepare('SELECT COUNT(*) as c FROM game_history').get() as any)?.c || 0;
  const transfersCount = (db.prepare('SELECT COUNT(*) as c FROM transfers').get() as any)?.c || 0;

  return {
    totalUsers: usersCount,
    totalBalance: Math.round(totalBalance * 10000) / 10000,
    activeStakingDeposits: activeStaking.count || 0,
    activeStakingVolume: Math.round((activeStaking.volume || 0) * 10000) / 10000,
    totalGamesPlayed: gamesCount,
    totalTransfers: transfersCount,
  };
}
