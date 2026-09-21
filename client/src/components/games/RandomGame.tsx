import React, { useState } from 'react';
import { Sparkles, History } from 'lucide-react';
import confetti from 'canvas-confetti';
import { BetControls } from './BetControls.js';
import { apiRequest } from '../../lib/api.js';
import { formatTokens } from '../../lib/formatters.js';
import { soundManager } from '../../lib/sound.js';
import { useTelegram } from '../../hooks/useTelegram.js';

interface RandomGameProps {
  balance: number;
  onBalanceUpdate: (newBalance: number) => void;
}

const TIERS = [
  { mult: 0, chance: '35%', color: 'border-red-500/30 text-red-400 bg-red-950/20' },
  { mult: 0.5, chance: '25%', color: 'border-amber-500/30 text-amber-400 bg-amber-950/20' },
  { mult: 1.0, chance: '20%', color: 'border-slate-500/30 text-slate-200 bg-slate-800/30' },
  { mult: 1.5, chance: '10%', color: 'border-sky-500/30 text-sky-400 bg-sky-950/20' },
  { mult: 2.0, chance: '6%', color: 'border-indigo-500/30 text-indigo-400 bg-indigo-950/20' },
  { mult: 3.0, chance: '3%', color: 'border-purple-500/30 text-purple-400 bg-purple-950/20' },
  { mult: 5.0, chance: '1%', color: 'border-yellow-500/40 text-yellow-300 bg-yellow-950/30 font-black' },
];

export const RandomGame: React.FC<RandomGameProps> = ({ balance, onBalanceUpdate }) => {
  const [bet, setBet] = useState(5.0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [lastMultiplier, setLastMultiplier] = useState<number | null>(null);
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { hapticImpact, hapticNotification } = useTelegram();

  const handlePlay = async () => {
    if (isSpinning || balance < bet) return;

    try {
      setIsSpinning(true);
      setError(null);
      setLastMultiplier(null);
      setLastPayout(null);
      hapticImpact('medium');

      // Deduct bet from local view
      onBalanceUpdate(balance - bet);

      const res = await apiRequest<{
        success: boolean;
        multiplier: number;
        payout: number;
        isWin: boolean;
        balance: number;
      }>('/api/games/random/play', {
        method: 'POST',
        body: JSON.stringify({ bet }),
      });

      // Quick shuffle animation through all cards (~1.2 seconds)
      let step = 0;
      const targetIndex = TIERS.findIndex((t) => t.mult === res.multiplier);
      const totalSteps = 16 + (targetIndex >= 0 ? targetIndex : 0);

      const interval = setInterval(() => {
        setHighlightedIndex(step % TIERS.length);
        hapticImpact('light');
        soundManager.playWheelTick();
        step++;

        if (step >= totalSteps) {
          clearInterval(interval);
          setHighlightedIndex(targetIndex);
          setLastMultiplier(res.multiplier);
          setLastPayout(res.payout);
          setIsSpinning(false);
          onBalanceUpdate(res.balance);

          if (res.multiplier >= 1.5) {
            hapticNotification('success');
            soundManager.playVictoryFanfare();
            confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
          } else if (res.multiplier === 0) {
            hapticNotification('error');
          } else {
            hapticNotification('warning');
          }

          setHistory((prev) => [res.multiplier, ...prev.slice(0, 9)]);
        }
      }, 70);
    } catch (err: any) {
      hapticNotification('error');
      setError(err.message || 'Ошибка запуска игры');
      setIsSpinning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* History */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
        <span className="text-[10px] text-slate-500 uppercase font-bold shrink-0 flex items-center gap-1">
          <History className="w-3 h-3" />
          История:
        </span>
        {history.length === 0 ? (
          <span className="text-[11px] text-slate-600">Сделайте первое вращение</span>
        ) : (
          history.map((m, i) => (
            <span
              key={i}
              className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold shrink-0 ${
                m >= 1.5
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : m === 1.0
                  ? 'bg-slate-800 text-slate-300'
                  : m === 0.5
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-red-500/15 text-red-400'
              }`}
            >
              ×{m}
            </span>
          ))
        )}
      </div>

      {/* Probability Cards Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span className="font-semibold">Таблица множителей</span>
          <span className="text-[11px] text-slate-500">Сумма шансов: 100%</span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {TIERS.map((tier, idx) => {
            const isTarget = highlightedIndex === idx;
            return (
              <div
                key={tier.mult}
                className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all transform ${
                  tier.color
                } ${
                  isTarget
                    ? 'ring-2 ring-white scale-105 shadow-xl shadow-sky-500/30'
                    : 'opacity-80'
                } ${idx === 6 ? 'col-span-2' : ''}`}
              >
                <div className="text-base sm:text-lg font-black font-mono">
                  ×{tier.mult}
                </div>
                <div className="text-[10px] font-semibold opacity-75">
                  {tier.chance}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Result Card */}
      {lastMultiplier !== null && (
        <div
          className={`p-4 rounded-xl border text-center animate-in zoom-in-95 duration-200 ${
            lastMultiplier >= 1.0
              ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
              : lastMultiplier === 0.5
              ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
              : 'bg-red-950/30 border-red-500/30 text-red-400'
          }`}
        >
          <div className="text-xs uppercase tracking-wider font-bold opacity-80">
            {lastMultiplier >= 1.0 ? 'Выигрыш!' : lastMultiplier === 0.5 ? 'Возврат половины' : 'Не повезло'}
          </div>
          <div className="text-2xl font-black font-mono mt-0.5">
            ×{lastMultiplier} → {formatTokens(lastPayout || 0)} Токенов
          </div>
        </div>
      )}

      {error && (
        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
          {error}
        </div>
      )}

      {/* Action Button */}
      <button
        onClick={handlePlay}
        disabled={isSpinning || balance < bet}
        className={`w-full py-4 px-6 rounded-2xl font-black text-base transition flex items-center justify-center gap-2 shadow-xl ${
          isSpinning
            ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
            : balance >= bet
            ? 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white shadow-purple-500/25 active:scale-98 cursor-pointer'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
        }`}
      >
        <Sparkles className="w-5 h-5" />
        {isSpinning
          ? 'Определение исхода...'
          : balance < bet
          ? 'Недостаточно токенов'
          : `Крутить RANDOM (${formatTokens(bet)} Т)`}
      </button>

      {/* Bet Controls */}
      <BetControls bet={bet} onBetChange={setBet} balance={balance} disabled={isSpinning} />
    </div>
  );
};
