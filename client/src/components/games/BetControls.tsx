import React from 'react';
import { formatTokens } from '../../lib/formatters.js';

interface BetControlsProps {
  bet: number;
  onBetChange: (newBet: number) => void;
  balance: number;
  disabled?: boolean;
}

export const BetControls: React.FC<BetControlsProps> = ({
  bet,
  onBetChange,
  balance,
  disabled = false,
}) => {
  const minBet = 0.01;

  const handleSetBet = (val: number) => {
    if (disabled) return;
    const clamped = Math.max(minBet, Math.min(balance, Math.round(val * 100000) / 100000));
    onBetChange(clamped);
  };

  const handleDivide = () => {
    if (disabled) return;
    const halved = Math.max(minBet, Math.round((bet / 2) * 100000) / 100000);
    onBetChange(halved);
  };

  const handleMultiply = () => {
    if (disabled) return;
    const doubled = Math.min(balance, Math.round(bet * 2 * 100000) / 100000);
    onBetChange(Math.max(minBet, doubled));
  };

  const handleMax = () => {
    if (disabled) return;
    onBetChange(Math.max(minBet, Math.round(balance * 100000) / 100000));
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-semibold">Размер ставки (мин. 0.01 Т)</span>
        <span className="font-mono">
          Баланс: <strong className="text-sky-400">{formatTokens(balance)}</strong> Т
        </span>
      </div>

      {/* Bet input with /2 and x2 buttons */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <input
            type="number"
            min={minBet}
            max={balance}
            step="0.01"
            disabled={disabled}
            value={bet || ''}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              onBetChange(isNaN(v) ? 0 : v);
            }}
            className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono font-bold focus:outline-none focus:border-sky-500 disabled:opacity-50 transition"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
            ТОКЕН
          </span>
        </div>

        <button
          type="button"
          disabled={disabled || bet <= minBet}
          onClick={handleDivide}
          className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono font-bold transition disabled:opacity-40 cursor-pointer"
        >
          /2
        </button>
        <button
          type="button"
          disabled={disabled || bet * 2 > balance}
          onClick={handleMultiply}
          className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono font-bold transition disabled:opacity-40 cursor-pointer"
        >
          ×2
        </button>
        <button
          type="button"
          disabled={disabled || balance < minBet}
          onClick={handleMax}
          className="px-3 py-2.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 rounded-xl text-xs font-mono font-bold transition disabled:opacity-40 cursor-pointer"
        >
          MAX
        </button>
      </div>

      {/* Quick selection pills: 0.01 / 0.05 / 0.1 / 0.5 / 1 / 5 */}
      <div className="flex gap-1.5">
        {[0.01, 0.05, 0.1, 0.5, 1, 5].map((val) => (
          <button
            key={val}
            type="button"
            disabled={disabled || balance < val}
            onClick={() => handleSetBet(val)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
              bet === val
                ? 'bg-sky-500 text-black shadow-md shadow-sky-500/20'
                : 'bg-slate-900/80 text-slate-300 border border-white/5 hover:bg-slate-800 disabled:opacity-30'
            }`}
          >
            {val}
          </button>
        ))}
      </div>
    </div>
  );
};
