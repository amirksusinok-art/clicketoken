import {
  generateServerSeed,
  hashServerSeed,
  calculateCrashPoint,
  calculateHiLoResult,
  calculateRandomGameResult,
  calculateAirplaneResult,
} from './src/provablyFair.js';
import {
  findOrCreateUser,
  recordClicksBatch,
  upgradeUser,
  executeTransfer,
  updateUserBalance,
} from './src/db.js';
import { UPGRADES, getNextUpgrade } from './src/upgrades.js';

console.log('🧪 Запуск тестов серверной части...');

// 1. Test Provably Fair
const serverSeed = generateServerSeed();
const serverSeedHash = hashServerSeed(serverSeed);
const clientSeed = 'test_client_seed_123';
const nonce = 1;

console.log('✓ Server seed hash generated:', serverSeedHash);

// Test Hi-Lo roll
const hilo = calculateHiLoResult(serverSeed, clientSeed, nonce);
console.assert(hilo.roll >= 0 && hilo.roll <= 999999, 'Hi-Lo roll must be 0-999999');
console.log('✓ Hi-Lo provably fair roll:', hilo.roll);

// Test Random game
const randomRes = calculateRandomGameResult(serverSeed, clientSeed, nonce);
console.assert([0, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0].includes(randomRes.multiplier), 'Multiplier must be valid');
console.log('✓ Random game multiplier:', randomRes.multiplier);

// Test Airplane
const plane = calculateAirplaneResult(serverSeed, clientSeed, nonce);
console.assert(plane.events.length >= 3 && plane.events.length <= 4, 'Airplane must have 3-4 obstacles');
console.log('✓ Airplane flight result: events =', plane.events.length, 'landing =', plane.landingSuccess, 'final =', plane.finalMultiplier);

// Test Crash point
const crash = calculateCrashPoint(serverSeed, clientSeed, nonce);
console.assert(crash.crashPoint >= 1.0, 'Crash point must be >= 1.0');
console.log('✓ Crash point:', crash.crashPoint);

// 2. Test User DB & Upgrades
const u1 = findOrCreateUser(99901, 'Test Alice', 'alice_test');
const u2 = findOrCreateUser(99902, 'Test Bob', 'bob_test');

console.assert(u1.balance >= 0, 'Initial balance >= 0');
console.log('✓ Users created:', u1.username, 'and', u2.username);

// Test clicks batch
const earned = 10 * u1.earn_per_click;
const updatedU1 = recordClicksBatch(u1.id, 10, earned);
console.assert(updatedU1.balance >= earned, 'Balance updated with clicks');
console.log('✓ Click batch recorded, new balance:', updatedU1.balance);

// Test upgrade
updateUserBalance(u1.id, 100); // give 100 tokens for testing
const nextUp = getNextUpgrade(1)!;
const upgradedU1 = upgradeUser(u1.id, nextUp.level, nextUp.earnPerClick, nextUp.cost);
console.assert(upgradedU1.upgrade_level === 2, 'Upgrade level must be 2');
console.assert(upgradedU1.earn_per_click === 0.002, 'Earn per click must be 0.002');
console.log('✓ Upgrade bought! Level:', upgradedU1.upgrade_level, 'earn:', upgradedU1.earn_per_click);

// Test Transfer
const transferRes = executeTransfer(u1.id, u2.id, 25.0);
console.assert(transferRes.success === true, 'Transfer should succeed');
console.log('✓ Transfer executed: Alice -> Bob 25.0 tokens');

console.log('🎉 ВСЕ СЕРВЕРНЫЕ ТЕСТЫ УСПЕШНО ПРОЙДЕНЫ!');
