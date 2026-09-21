import React, { useState } from 'react';
import { Disc3 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { BetControls } from './BetControls.js';
import { apiRequest } from '../../lib/api.js';
import { formatTokens } from '../../lib/formatters.js';
import { soundManager } from '../../lib/sound.js';
import { useTelegram } from '../../hooks/useTelegram.js';

interface MiniRouletteGameProps {
  balance: number;
  onBalanceUpdate: (newBalance: number) => void;
}

type BetType = 'red' | 'black' | 'even' | 'odd' | 'number';

// 13 pockets: 0 (Green), 1-6 (Red), 7-12 (Black)
const POCKETS = [
  { num: 0, color: 'green' },
  { num: 1, color: 'red' },
  { num: 7, color: 'black' },
  { num: 2, color: 'red' },
  { num: 8, color: 'black' },
  { num: 3, color: 'red' },
  { num: 9, color: 'black' },
  { num: 4, color: 'red' },
  { num: 10, color: 'black' },
  { num: 5, color: 'red' },
  { num: 11, color: 'black' },
  { num: 6, color: 'red' },
  { num: 12, color: 'black' },
];

export const MiniRouletteGame: React.FC<MiniRouletteGameProps> = ({ balance, onBalanceUpdate }) => {
  const [bet, setBet] = useState(1.0);
  const [betType, setBetType] = useState<BetType>('red');
  const [targetNumber, setTargetNumber] = useState<number>(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winningPocket, setWinningPocket] = useState<{ num: number; color: string } | null>(null);
  const [isWin, setIsWin] = useState<boolean | null>(null);
  const [payout, setPayout] = useState(0);
  const [trackOffset, setTrackOffset] = useState(0);
  const [history, setHistory] = useState<{ num: number; color: string; isWin: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { hapticImpact, hapticNotification } = useTelegram();

  // Item width in pixels for tape scroll
  const ITEM_WIDTH = 64;

  const handleSpin = async () => {
    if (isSpinning || balance < bet) return;

    try {
      setIsSpinning(true);
      setError(null);
      setIsWin(null);
      hapticImpact('heavy');
      soundManager.playClick();

      // Optimistic balance update
      onBalanceUpdate(balance - bet);

      const res = await apiRequest<{
        success: boolean;
        winningNumber: number;
        color: 'green' | 'red' | 'black';
        isWin: boolean;
        multiplier: number;
        payout: number;
        balance: number;
      }>('/api/games/roulette/play', {
        method: 'POST',
        body: JSON.stringify({
          bet,
          betType,
          targetNumber: betType === 'number' ? targetNumber : undefined,
        }),
      });

      if (!res.success) {
        throw new Error('Ошибка сервера');
      }

      // Find index of winning pocket in repeated array
      const targetIndex = POCKETS.findIndex((p) => p.num === res.winningNumber);
      // Advance by 4 to 6 full cycles (52 to 78 items) + targetIndex to create smooth long scroll
      const fullCycles = 5 * POCKETS.length;
      const targetOffsetIndex = fullCycles + targetIndex;
      const jitter = (Math.random() - 0.5) * 16; // Slight random landing inside pocket
      const finalOffset = targetOffsetIndex * ITEM_WIDTH + jitter;

      setTrackOffset(finalOffset);

      // Sound clicks while spinning
      let clickCount = 0;
      const clickTimer = setInterval(() => {
        clickCount++;
        soundManager.playPop();
        hapticImpact('light');
        if (clickCount > 15) clearInterval(clickTimer);
      }, 100);

      setTimeout(() => {
        clearInterval(clickTimer);
        setWinningPocket({ num: res.winningNumber, color: res.color });
        setIsWin(res.isWin);
        setPayout(res.payout);
        onBalanceUpdate(res.balance);
        setIsSpinning(false);

        setHistory((prev) => [
          { num: res.winningNumber, color: res.color, isWin: res.isWin },
          ...prev.slice(0, 9),
        ]);

        if (res.isWin) {
          hapticNotification('success');
          soundManager.playVictoryFanfare();
          confetti({
            particleCount: 60,
            spread: 70,
            origin: { y: 0.6 },
          });
        } else {
          hapticNotification('error');
          soundManager.playWhoosh();
        }
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Ошибка запуска рулетки');
      setIsSpinning(false);
      hapticNotification('error');
    }
  };

  // Repeated list for endless tape effect (10 cycles = 130 items)
  const tapeList = Array.from({ length: 12 }, () => POCKETS).flat();

  return (
    <div className="space-y-4 select-none">
      {/* Tape Roulette Display */}
      <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-b from-[#070d1a] via-[#0b162b] to-[#040812] flex flex-col items-center justify-center shadow-xl">
        {/* Pointer indicator */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none">
          <div className="w-0 h-0 border-l-[9px] border-l-transparent border-r-[9px] border-r-transparent border-t-[14px] border-t-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
        </div>
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none">
          <div className="w-0 h-0 border-l-[9px] border-l-transparent border-r-[9px] border-r-transparent border-b-[14px] border-b-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
        </div>

        {/* Center Target Glass Beam */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-16 border-x-2 border-amber-400/50 bg-amber-400/10 z-10 pointer-events-none shadow-[0_0_20px_rgba(251,191,36,0.2)]" />

        {/* Moving Tape */}
        <div className="w-full overflow-hidden flex items-center py-4">
          <div
            className="flex items-center"
            style={{
              transform: `translateX(calc(50% - 32px - ${trackOffset}px))`,
              transition: isSpinning ? 'transform 2.5s cubic-bezier(0.12, 0.8, 0.2, 1)' : 'none',
            }}
          >
            {tapeList.map((pocket, idx) => (
              <div
                key={idx}
                style={{ width: `${ITEM_WIDTH}px` }}
                className="flex-shrink-0 flex flex-col items-center justify-center p-1"
              >
                <div
                  className={`w-13 h-14 rounded-xl flex flex-col items-center justify-center border font-mono font-black text-lg transition-all shadow-md ${
                    pocket.color === 'green'
                      ? 'bg-emerald-600/30 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                      : pocket.color === 'red'
                      ? 'bg-rose-600/30 border-rose-400 text-rose-200 shadow-[0_0_10px_rgba(244,63,94,0.3)]'
                      : 'bg-slate-800/60 border-slate-500 text-slate-200 shadow-[0_0_10px_rgba(0,0,0,0.5)]'
                  }`}
                >
                  <span>{pocket.num}</span>
                  <span className="text-[8px] uppercase tracking-wider font-sans font-bold -mt-0.5 opacity-75">
                    {pocket.color === 'green' ? 'ZERO' : pocket.color === 'red' ? 'RED' : 'BLACK'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Result Status Banner */}
        <div className="h-5 flex items-center justify-center z-20">
          {isWin !== null && !isSpinning && winningPocket && (
            <div
              className={`text-[11px] font-black px-3 py-0.5 rounded-full border animate-pulse ${
                isWin
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                  : 'bg-rose-500/20 border-rose-400 text-rose-300'
              }`}
            >
              {isWin ? `ВЫИГРЫШ: +${formatTokens(payout)} Т` : `ВЫПАЛО: ${winningPocket.num}`}
            </div>
          )}
        </div>
      </div>

      {/* History Ribbon */}
      {history.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 px-1">
          <span className="text-[10px] uppercase font-bold text-slate-500 flex-shrink-0">История:</span>
          {history.map((h, i) => (
            <span
              key={i}
              className={`text-[11px] font-mono font-black px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                h.color === 'green'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                  : h.color === 'red'
                  ? 'bg-rose-500/10 border-rose-500/40 text-rose-300'
                  : 'bg-slate-700/30 border-slate-500 text-slate-300'
              }`}
            >
              {h.num}
            </span>
          ))}
        </div>
      )}

      {/* Main Bet Categories */}
      <div className="grid grid-cols-3 gap-2">
        {/* Red */}
        <button
          onClick={() => {
            if (!isSpinning) {
              setBetType('red');
              hapticImpact('light');
            }
          }}
          disabled={isSpinning}
          className={`py-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
            betType === 'red'
              ? 'bg-rose-600/30 border-rose-400 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.4)] ring-1 ring-rose-400'
              : 'bg-slate-900/60 border-white/10 text-slate-400 hover:border-white/20'
          }`}
        >
          <div className="w-3 h-3 rounded-full bg-rose-500 mb-1 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
          <div className="text-xs font-black">КРАСНОЕ (1-6)</div>
          <div className="text-[10px] text-emerald-400 font-mono font-bold">×2.00</div>
        </button>

        {/* Zero */}
        <button
          onClick={() => {
            if (!isSpinning) {
              setBetType('number');
              setTargetNumber(0);
              hapticImpact('light');
            }
          }}
          disabled={isSpinning}
          className={`py-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
            betType === 'number' && targetNumber === 0
              ? 'bg-emerald-600/30 border-emerald-400 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.4)] ring-1 ring-emerald-400'
              : 'bg-slate-900/60 border-white/10 text-slate-400 hover:border-white/20'
          }`}
        >
          <div className="w-3 h-3 rounded-full bg-emerald-500 mb-1 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <div className="text-xs font-black">ЗЕРО (0)</div>
          <div className="text-[10px] text-emerald-400 font-mono font-bold">×12.00</div>
        </button>

        {/* Black */}
        <button
          onClick={() => {
            if (!isSpinning) {
              setBetType('black');
              hapticImpact('light');
            }
          }}
          disabled={isSpinning}
          className={`py-2.5 rounded-xl border flex flex-col items-center justify-center transition-all ${
            betType === 'black'
              ? 'bg-slate-800/80 border-slate-400 text-slate-200 shadow-[0_0_15px_rgba(255,255,255,0.2)] ring-1 ring-slate-400'
              : 'bg-slate-900/60 border-white/10 text-slate-400 hover:border-white/20'
          }`}
        >
          <div className="w-3 h-3 rounded-full bg-slate-400 mb-1" />
          <div className="text-xs font-black">ЧЁРНОЕ (7-12)</div>
          <div className="text-[10px] text-emerald-400 font-mono font-bold">×2.00</div>
        </button>
      </div>

      {/* Secondary Bet Categories (Even / Odd) */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            if (!isSpinning) {
              setBetType('even');
              hapticImpact('light');
            }
          }}
          disabled={isSpinning}
          className={`py-2 rounded-xl border text-center transition-all ${
            betType === 'even'
              ? 'bg-sky-500/20 border-sky-400 text-sky-300 ring-1 ring-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.3)]'
              : 'bg-slate-900/40 border-white/5 text-slate-400 hover:border-white/10'
          }`}
        >
          <span className="text-xs font-bold">ЧЁТНОЕ</span>
          <span className="text-[10px] text-emerald-400 font-mono ml-2 font-bold">×2.00</span>
        </button>

        <button
          onClick={() => {
            if (!isSpinning) {
              setBetType('odd');
              hapticImpact('light');
            }
          }}
          disabled={isSpinning}
          className={`py-2 rounded-xl border text-center transition-all ${
            betType === 'odd'
              ? 'bg-indigo-500/20 border-indigo-400 text-indigo-300 ring-1 ring-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.3)]'
              : 'bg-slate-900/40 border-white/5 text-slate-400 hover:border-white/10'
          }`}
        >
          <span className="text-xs font-bold">НЕЧЁТНОЕ</span>
          <span className="text-[10px] text-emerald-400 font-mono ml-2 font-bold">×2.00</span>
        </button>
      </div>

      {/* Number Picker Row (0-12) */}
      <div className="space-y-1">
        <div className="text-[10px] uppercase font-bold text-slate-400 px-1 flex justify-between">
          <span>Ставка на точное число:</span>
          <span className="text-emerald-400 font-mono">КУШ: ×12.00</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {[0, 1, 2, 3, 4, 5, 6].map((num) => (
            <button
              key={num}
              onClick={() => {
                if (!isSpinning) {
                  setBetType('number');
                  setTargetNumber(num);
                  hapticImpact('light');
                }
              }}
              disabled={isSpinning}
              className={`py-1.5 rounded-lg border text-center font-mono font-bold text-xs transition-all ${
                betType === 'number' && targetNumber === num
                  ? 'bg-amber-400 border-amber-300 text-black shadow-[0_0_10px_rgba(251,191,36,0.6)] font-black scale-105'
                  : num === 0
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:border-emerald-400'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300 hover:border-rose-400'
              }`}
            >
              {num}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-6 gap-1">
          {[7, 8, 9, 10, 11, 12].map((num) => (
            <button
              key={num}
              onClick={() => {
                if (!isSpinning) {
                  setBetType('number');
                  setTargetNumber(num);
                  hapticImpact('light');
                }
              }}
              disabled={isSpinning}
              className={`py-1.5 rounded-lg border text-center font-mono font-bold text-xs transition-all ${
                betType === 'number' && targetNumber === num
                  ? 'bg-amber-400 border-amber-300 text-black shadow-[0_0_10px_rgba(251,191,36,0.6)] font-black scale-105'
                  : 'bg-slate-800/40 border-slate-600/40 text-slate-300 hover:border-slate-400'
              }`}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {/* Bet Controls */}
      <BetControls bet={bet} onBetChange={setBet} balance={balance} disabled={isSpinning} />

      {error && (
        <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs text-center">
          {error}
        </div>
      )}

      {/* Spin Button */}
      <button
        onClick={handleSpin}
        disabled={isSpinning || balance < bet}
        className={`w-full py-3.5 rounded-xl font-bold uppercase tracking-wider text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${
          isSpinning
            ? 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
            : balance < bet
            ? 'bg-rose-900/40 text-rose-300 border border-rose-500/30 cursor-not-allowed'
            : 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-black font-black shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-[0.98]'
        }`}
      >
        <Disc3 className={`w-4 h-4 ${isSpinning ? 'animate-spin' : ''}`} />
        {isSpinning ? 'РУЛЕТКА КРУТИТСЯ...' : `КРУТИТЬ РУЛЕТКУ (${bet} Т)`}
      </button>
    </div>
  );
};
