import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

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
    earn_per_click REAL DEFAULT 0.001,
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
`);

try {
  db.exec(`ALTER TABLE users ADD COLUMN hide_public_balance INTEGER DEFAULT 0;`);
} catch {
  // column already exists
}

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
  username?: string | null
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

  db.prepare(`
    INSERT INTO users (id, username, username_lower, first_name, balance, earn_per_click, upgrade_level, client_seed, nonce, created_at, last_click_at)
    VALUES (?, ?, ?, ?, 0.000, 0.001, 1, 'client_seed_' || ?, 0, ?, ?)
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

