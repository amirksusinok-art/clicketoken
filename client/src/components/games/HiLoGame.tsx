import React, { useState } from 'react';
import { ArrowDown, ArrowUp, History } from 'lucide-react';
import confetti from 'canvas-confetti';
import { BetControls } from './BetControls.js';
import { apiRequest } from '../../lib/api.js';
import { formatTokens } from '../../lib/formatters.js';
import { useTelegram } from '../../hooks/useTelegram.js';

interface HiLoGameProps {
  balance: number;
  onBalanceUpdate: (newBalance: number) => void;
}

export const HiLoGame: React.FC<HiLoGameProps> = ({ balance, onBalanceUpdate }) => {
  const [bet, setBet] = useState(5.0);
  const [chance, setChance] = useState(50.0);
  const [isRolling, setIsRolling] = useState(false);
  const [displayNumber, setDisplayNumber] = useState('000000');
  const [isWin, setIsWin] = useState<boolean | null>(null);
  const [payout, setPayout] = useState(0);
  const [history, setHistory] = useState<{ roll: number; win: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { hapticImpact, hapticNotification } = useTelegram();

  // House edge 1%
  const multiplier = Math.round((99 / chance) * 100) / 100;
  // N = floor(1000000 * P / 100)
  const n = Math.floor((1000000 * chance) / 100);
  const lessRangeMax = Math.max(0, n - 1);
  const moreRangeMin = 1000000 - n;

  const handleRoll = async (choice: 'less' | 'more') => {
    if (isRolling || balance < bet) return;

    try {
      setIsRolling(true);
      setError(null);
      setIsWin(null);
      hapticImpact('medium');

      // Deduct bet locally
      onBalanceUpdate(balance - bet);

      // Roll numbers animation
      const rollInterval = setInterval(() => {
        const rand = Math.floor(Math.random() * 1000000);
        setDisplayNumber(String(rand).padStart(6, '0'));
        hapticImpact('light');
      }, 50);

      const res = await apiRequest<{
        success: boolean;
        roll: number;
        isWin: boolean;
        multiplier: number;
        payout: number;
        balance: number;
      }>('/api/games/hilo/play', {
        method: 'POST',
        body: JSON.stringify({
          bet,
          chance,
          choice,
        }),
      });

      // Stop roll after 900ms and reveal result
      setTimeout(() => {
        clearInterval(rollInterval);
        setDisplayNumber(String(res.roll).padStart(6, '0'));
        setIsWin(res.isWin);
        setPayout(res.payout);
        setIsRolling(false);
        onBalanceUpdate(res.balance);

        if (res.isWin) {
          hapticNotification('success');
          confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
        } else {
          hapticNotification('error');
        }

        setHistory((prev) => [
          { roll: res.roll, win: res.isWin },
          ...prev.slice(0, 9),
        ]);
      }, 900);
    } catch (err: any) {
      hapticNotification('error');
      setError(err.message || 'Ошибка игры');
      setIsRolling(false);
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
          <span className="text-[11px] text-slate-600">Сделайте первый бросок</span>
        ) : (
          history.map((h, i) => (
            <span
              key={i}
              className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold shrink-0 ${
                h.win
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/15 text-red-400 border border-red-500/30'
              }`}
            >
              {String(h.roll).padStart(6, '0')}
            </span>
          ))
        )}
      </div>

      {/* Main Digital Scoreboard */}
      <div
        className={`w-full py-8 rounded-2xl border flex flex-col items-center justify-center transition-all duration-300 ${
          isWin === true
            ? 'bg-emerald-950/40 border-emerald-500/40 shadow-xl shadow-emerald-500/10'
            : isWin === false
            ? 'bg-red-950/40 border-red-500/40 shadow-xl shadow-red-500/10'
            : 'bg-slate-900/90 border-white/10'
        }`}
      >
        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">
          Число раунда (0–999999)
        </span>
        <div
          className={`text-5xl sm:text-6xl font-black font-mono tracking-widest transition-colors ${
            isWin === true
              ? 'text-emerald-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.6)]'
              : isWin === false
              ? 'text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]'
              : 'text-white'
          }`}
        >
          {displayNumber}
        </div>

        {isWin !== null && !isRolling && (
          <div className="mt-2 text-xs font-bold font-mono">
            {isWin ? (
              <span className="text-emerald-400">
                ПОБЕДА! +{formatTokens(payout)} Токенов ({multiplier.toFixed(2)}x)
              </span>
            ) : (
              <span className="text-red-400">ПОРАЖЕНИЕ (0 Токенов)</span>
            )}
          </div>
        )}
      </div>

      {/* Multiplier & Chance Info Strip */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 flex flex-col">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Множитель</span>
          <span className="text-lg font-black text-amber-300 font-mono">
            {multiplier.toFixed(2)}x
          </span>
          <span className="text-[10px] text-slate-500">Комиссия сервера: 1%</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 flex flex-col">
          <span className="text-[10px] uppercase font-semibold text-slate-400">Шанс победы</span>
          <span className="text-lg font-black text-sky-400 font-mono">
            {chance.toFixed(2)}%
          </span>
          <span className="text-[10px] text-slate-500">
            {Math.floor((1000000 * chance) / 100).toLocaleString('ru-RU')} исходов
          </span>
        </div>
      </div>

      {/* Chance Slider (1.00% to 95.00%) */}
      <div className="space-y-1.5 p-3 rounded-xl bg-slate-900/40 border border-white/5">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span className="font-semibold">Регулировка шанса</span>
          <span className="font-mono text-sky-400 font-bold">{chance.toFixed(1)}%</span>
        </div>
        <input
          type="range"
          min="1"
          max="95"
          step="0.5"
          disabled={isRolling}
          value={chance}
          onChange={(e) => setChance(parseFloat(e.target.value))}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
        />
        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>1%</span>
          <span>50%</span>
          <span>95%</span>
        </div>
      </div>

      {error && (
        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
          {error}
        </div>
      )}

      {/* Action Buttons: Меньше & Больше */}
      <div className="grid grid-cols-2 gap-3">
        {/* Button Меньше */}
        <button
          onClick={() => handleRoll('less')}
          disabled={isRolling || balance < bet}
          className={`py-3.5 px-4 rounded-2xl font-bold text-xs sm:text-sm transition flex flex-col items-center justify-center gap-1 shadow-lg ${
            isRolling || balance < bet
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
              : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-sky-600/20 active:scale-98 cursor-pointer'
          }`}
        >
          <div className="flex items-center gap-1.5 text-sm font-black">
            <ArrowDown className="w-4 h-4" />
            МЕНЬШЕ
          </div>
          <div className="text-[10px] opacity-80 font-mono">
            0 – {lessRangeMax}
          </div>
        </button>

        {/* Button Больше */}
        <button
          onClick={() => handleRoll('more')}
          disabled={isRolling || balance < bet}
          className={`py-3.5 px-4 rounded-2xl font-bold text-xs sm:text-sm transition flex flex-col items-center justify-center gap-1 shadow-lg ${
            isRolling || balance < bet
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/20 active:scale-98 cursor-pointer'
          }`}
        >
          <div className="flex items-center gap-1.5 text-sm font-black">
            <ArrowUp className="w-4 h-4" />
            БОЛЬШЕ
          </div>
          <div className="text-[10px] opacity-80 font-mono">
            {moreRangeMin} – 999999
          </div>
        </button>
      </div>

      {/* Bet Controls */}
      <BetControls bet={bet} onBetChange={setBet} balance={balance} disabled={isRolling} />
    </div>
  );
};
