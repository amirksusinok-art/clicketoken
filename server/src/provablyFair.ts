import crypto from 'node:crypto';

export interface ProvablyFairResult {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export function generateServerSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashServerSeed(serverSeed: string): string {
  return crypto.createHash('sha256').update(serverSeed).digest('hex');
}

export function generateHmac(serverSeed: string, clientSeed: string, nonce: number): string {
  return crypto
    .createHmac('sha256', serverSeed)
    .update(`${clientSeed}:${nonce}`)
    .digest('hex');
}

// 1. Hi-Lo (Больше / Меньше): generates a number from 0 to 999999
export function calculateHiLoResult(serverSeed: string, clientSeed: string, nonce: number): {
  roll: number;
  hmac: string;
} {
  const hmac = generateHmac(serverSeed, clientSeed, nonce);
  // Take first 8 chars (32 bits) and modulo 1,000,000
  const sub = hmac.substring(0, 8);
  const num = parseInt(sub, 16);
  const roll = num % 1000000;
  return { roll, hmac };
}

// 2. Random game: probabilities
// ×0 — 35%, ×0.5 — 25%, ×1 — 20%, ×1.5 — 10%, ×2 — 6%, ×3 — 3%, ×5 — 1%
export interface RandomMultiplier {
  multiplier: number;
  weight: number; // in basis points (100 = 1%)
}

export const RANDOM_TIERS: RandomMultiplier[] = [
  { multiplier: 0, weight: 3500 },    // 35%
  { multiplier: 0.5, weight: 2500 },  // 25%
  { multiplier: 1.0, weight: 2000 },  // 20%
  { multiplier: 1.5, weight: 1000 },  // 10%
  { multiplier: 2.0, weight: 600 },   // 6%
  { multiplier: 3.0, weight: 300 },   // 3%
  { multiplier: 5.0, weight: 100 },   // 1%
];

export function calculateRandomGameResult(serverSeed: string, clientSeed: string, nonce: number): {
  multiplier: number;
  rollPoint: number;
  hmac: string;
} {
  const hmac = generateHmac(serverSeed, clientSeed, nonce);
  const sub = hmac.substring(0, 8);
  const num = parseInt(sub, 16);
  const rollPoint = num % 10000; // 0 to 9999

  let accumulated = 0;
  let multiplier = 0;
  for (const tier of RANDOM_TIERS) {
    accumulated += tier.weight;
    if (rollPoint < accumulated) {
      multiplier = tier.multiplier;
      break;
    }
  }

  return { multiplier, rollPoint, hmac };
}

// 3. Airplane game: 3-4 obstacles (rings 60%, rockets 40%), runway landing 75%
export interface AirplaneEvent {
  type: 'ring' | 'rocket';
  multiplierDelta: number;
}

export interface AirplaneFlightResult {
  events: AirplaneEvent[];
  initialMultiplier: number;
  preLandingMultiplier: number;
  finalMultiplier: number;
  landingSuccess: boolean;
  hmac: string;
}

export function calculateAirplaneResult(serverSeed: string, clientSeed: string, nonce: number): AirplaneFlightResult {
  const hmac = generateHmac(serverSeed, clientSeed, nonce);
  
  // Decide number of events: 3 or 4 based on char 0
  const eventCount = (parseInt(hmac[0], 16) % 2) === 0 ? 3 : 4;
  const events: AirplaneEvent[] = [];
  let currentMultiplier = 1.0;

  for (let i = 0; i < eventCount; i++) {
    // 2 hex characters for each obstacle (0-255)
    const val = parseInt(hmac.substring(2 + i * 2, 4 + i * 2), 16) % 100;
    // 60% ring (multiplier * 1.5), 40% rocket (multiplier / 1.5, min 1.00x)
    if (val < 60) {
      currentMultiplier = Math.round(currentMultiplier * 1.5 * 100) / 100;
      events.push({ type: 'ring', multiplierDelta: 1.5 });
    } else {
      currentMultiplier = Math.max(1.0, Math.round((currentMultiplier / 1.5) * 100) / 100);
      events.push({ type: 'rocket', multiplierDelta: -1.5 });
    }
  }

  const preLandingMultiplier = currentMultiplier;

  // Landing success: next 2 hex characters % 100 < 75 (75% success)
  const landingVal = parseInt(hmac.substring(12, 14), 16) % 100;
  const landingSuccess = landingVal < 75;
  const finalMultiplier = landingSuccess ? preLandingMultiplier : 0;

  return {
    events,
    initialMultiplier: 1.0,
    preLandingMultiplier,
    finalMultiplier,
    landingSuccess,
    hmac,
  };
}

// 4. Crash game: standard Provably Fair crash multiplier
export function calculateCrashPoint(serverSeed: string, clientSeed: string, nonce: number): {
  crashPoint: number;
  hmac: string;
} {
  const hmac = generateHmac(serverSeed, clientSeed, nonce);
  
  // 52 bits of randomness
  const h = parseInt(hmac.substring(0, 13), 16);
  const e = Math.pow(2, 52);

  // 3% instant house crash
  if (h % 33 === 0) {
    return { crashPoint: 1.00, hmac };
  }

  const rawPoint = Math.floor((100 * e - h) / (e - h)) / 100;
  // Cap at 1000x for sanity
  const crashPoint = Math.min(1000.00, Math.max(1.00, Math.round(rawPoint * 100) / 100));

  return { crashPoint, hmac };
}

// 5. Plinko Game: Payout tables and path generator
export const PLINKO_PAYOUTS: Record<number, Record<'low' | 'medium' | 'high', number[]>> = {
  8: {
    low: [5, 1.8, 0.8, 0.5, 0.42, 0.5, 0.8, 1.8, 5],
    medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  },
  9: {
    low: [5.6, 2, 1.1, 0.7, 0.45, 0.45, 0.7, 1.1, 2, 5.6],
    medium: [18, 4, 1.7, 0.9, 0.4, 0.4, 0.9, 1.7, 4, 18],
    high: [43, 7, 2, 0.6, 0.2, 0.2, 0.6, 2, 7, 43],
  },
  10: {
    low: [8.9, 3, 1.4, 0.9, 0.5, 0.4, 0.5, 0.9, 1.4, 3, 8.9],
    medium: [22, 5, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 5, 22],
    high: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76],
  },
  11: {
    low: [12, 4, 1.8, 1.1, 0.6, 0.4, 0.4, 0.6, 1.1, 1.8, 4, 12],
    medium: [30, 8, 3, 1.4, 0.7, 0.4, 0.4, 0.7, 1.4, 3, 8, 30],
    high: [120, 14, 4, 1.2, 0.4, 0.2, 0.2, 0.4, 1.2, 4, 14, 120],
  },
  12: {
    low: [16, 6, 2, 1.2, 0.7, 0.5, 0.4, 0.5, 0.7, 1.2, 2, 6, 16],
    medium: [42, 11, 4, 1.7, 0.9, 0.5, 0.3, 0.5, 0.9, 1.7, 4, 11, 42],
    high: [170, 24, 6, 1.7, 0.6, 0.3, 0.2, 0.3, 0.6, 1.7, 6, 24, 170],
  },
  13: {
    low: [22, 8, 2.5, 1.4, 0.8, 0.6, 0.45, 0.45, 0.6, 0.8, 1.4, 2.5, 8, 22],
    medium: [60, 16, 5, 2, 1.1, 0.6, 0.4, 0.4, 0.6, 1.1, 2, 5, 16, 60],
    high: [260, 37, 10, 2.5, 0.8, 0.4, 0.2, 0.2, 0.4, 0.8, 2.5, 10, 37, 260],
  },
  14: {
    low: [30, 10, 3, 1.6, 1, 0.7, 0.5, 0.4, 0.5, 0.7, 1, 1.6, 3, 10, 30],
    medium: [85, 22, 7, 2.5, 1.3, 0.7, 0.4, 0.3, 0.4, 0.7, 1.3, 2.5, 7, 22, 85],
    high: [420, 56, 15, 3.5, 1, 0.5, 0.3, 0.2, 0.3, 0.5, 1, 3.5, 15, 56, 420],
  },
  15: {
    low: [45, 15, 4, 2, 1.2, 0.8, 0.6, 0.45, 0.45, 0.6, 0.8, 1.2, 2, 4, 15, 45],
    medium: [130, 32, 10, 3, 1.5, 0.9, 0.5, 0.3, 0.3, 0.5, 0.9, 1.5, 3, 10, 32, 130],
    high: [620, 83, 25, 5, 1.5, 0.6, 0.3, 0.2, 0.2, 0.3, 0.6, 1.5, 5, 25, 83, 620],
  },
  16: {
    low: [60, 20, 5, 2.5, 1.5, 1, 0.7, 0.5, 0.4, 0.5, 0.7, 1, 1.5, 2.5, 5, 20, 60],
    medium: [200, 45, 15, 4, 2, 1.1, 0.6, 0.4, 0.3, 0.4, 0.6, 1.1, 2, 4, 15, 45, 200],
    high: [1000, 130, 40, 8, 2, 0.8, 0.4, 0.2, 0.2, 0.2, 0.4, 0.8, 2, 8, 40, 130, 1000],
  },
};

export function calculatePlinkoResult(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  rows: number = 8,
  risk: 'low' | 'medium' | 'high' = 'low'
): {
  path: number[];
  bucketIndex: number;
  multiplier: number;
  hmac: string;
} {
  const safeRows = Math.max(8, Math.min(16, Math.floor(rows)));
  const hmac = generateHmac(serverSeed, clientSeed, nonce);
  const path: number[] = [];

  for (let i = 0; i < safeRows; i++) {
    const byte = parseInt(hmac.substring(i * 2, i * 2 + 2), 16);
    path.push(byte % 2);
  }

  const bucketIndex = path.reduce((a, b) => a + b, 0);
  const table = PLINKO_PAYOUTS[safeRows]?.[risk] || PLINKO_PAYOUTS[8].low;
  const multiplier = table[bucketIndex] ?? 0.5;

  return { path, bucketIndex, multiplier, hmac };
}

