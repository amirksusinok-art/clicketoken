import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { BetControls } from './BetControls.js';
import { apiRequest } from '../../lib/api.js';
import { formatTokens } from '../../lib/formatters.js';
import { soundManager } from '../../lib/sound.js';
import { useTelegram } from '../../hooks/useTelegram.js';

interface CoinFlipGameProps {
  balance: number;
  onBalanceUpdate: (newBalance: number) => void;
}

export const CoinFlipGame: React.FC<CoinFlipGameProps> = ({ balance, onBalanceUpdate }) => {
  const [bet, setBet] = useState(1.0);
  const [choice, setChoice] = useState<'heads' | 'tails'>('heads');
  const [isFlipping, setIsFlipping] = useState(false);
  const [isWin, setIsWin] = useState<boolean | null>(null);
  const [payout, setPayout] = useState(0);
  const [rotations, setRotations] = useState(0);
  const [history, setHistory] = useState<{ outcome: 'heads' | 'tails'; isWin: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { hapticImpact, hapticNotification } = useTelegram();

  const handleFlip = async () => {
    if (isFlipping || balance < bet) return;

    try {
      setIsFlipping(true);
      setError(null);
      setIsWin(null);
      hapticImpact('heavy');
      soundManager.playClick();

      // Optimistic balance update
      onBalanceUpdate(balance - bet);

      // Spin sound effect loop simulation
      const flipSoundInterval = setInterval(() => {
        soundManager.playPop();
      }, 150);

      const res = await apiRequest<{
        success: boolean;
        outcome: 'heads' | 'tails';
        isWin: boolean;
        multiplier: number;
        payout: number;
        balance: number;
      }>('/api/games/coinflip/play', {
        method: 'POST',
        body: JSON.stringify({ bet, choice }),
      });

      if (!res.success) {
        clearInterval(flipSoundInterval);
        throw new Error('Ошибка сервера');
      }

      // Calculate new rotation: add 5-8 full spins (1800 - 2880 deg) + final face
      const extraSpins = (5 + Math.floor(Math.random() * 3)) * 360;
      const targetFaceAngle = res.outcome === 'heads' ? 0 : 180;
      // Make sure rotations keep moving forward
      const currentFullSpins = Math.ceil(rotations / 360) * 360;
      const nextAngle = currentFullSpins + extraSpins + targetFaceAngle;

      setRotations(nextAngle);

      setTimeout(() => {
        clearInterval(flipSoundInterval);
        setIsWin(res.isWin);
        setPayout(res.payout);
        onBalanceUpdate(res.balance);
        setIsFlipping(false);

        setHistory((prev) => [{ outcome: res.outcome, isWin: res.isWin }, ...prev.slice(0, 9)]);

        if (res.isWin) {
          hapticNotification('success');
          soundManager.playSuccess();
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.6 },
          });
        } else {
          hapticNotification('error');
          soundManager.playWhoosh();
        }
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Ошибка запуска игры');
      setIsFlipping(false);
      hapticNotification('error');
    }
  };

  return (
    <div className="space-y-4 select-none">
      {/* 3D Coin Arena */}
      <div className="relative w-full h-56 rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-b from-[#0a1020] via-[#0d1830] to-[#060a14] flex flex-col items-center justify-center p-4 shadow-xl">
        {/* Glow backdrop */}
        <div
          className={`absolute inset-0 transition-opacity duration-700 pointer-events-none ${
            isWin === true
              ? 'bg-emerald-500/20 opacity-100'
              : isWin === false
              ? 'bg-rose-500/15 opacity-100'
              : 'opacity-0'
          }`}
        />

        {/* Coin Perspective Container */}
        <div className="relative w-36 h-36 [perspective:1000px]">
          <div
            className="w-full h-full relative [transform-style:preserve-3d]"
            style={{
              transform: `rotateY(${rotations}deg)`,
              transition: isFlipping ? 'transform 1.5s cubic-bezier(0.15, 0.9, 0.25, 1)' : 'none',
            }}
          >
            {/* Heads (Орёл) - Front Face */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-600 border-4 border-amber-200 shadow-[0_0_25px_rgba(245,158,11,0.6),inset_0_0_15px_rgba(255,255,255,0.4)] flex flex-col items-center justify-center [backface-visibility:hidden]">
              <div className="w-28 h-28 rounded-full border-2 border-dashed border-amber-900/30 flex flex-col items-center justify-center bg-amber-400/20">
                <span className="text-4xl drop-shadow-md">🪙</span>
                <span className="text-[11px] font-black tracking-widest text-amber-950 uppercase mt-0.5">ОРЁЛ</span>
              </div>
            </div>

            {/* Tails (Решка) - Back Face */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-600 border-4 border-cyan-200 shadow-[0_0_25px_rgba(6,182,212,0.6),inset_0_0_15px_rgba(255,255,255,0.4)] flex flex-col items-center justify-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <div className="w-28 h-28 rounded-full border-2 border-dashed border-cyan-950/30 flex flex-col items-center justify-center bg-cyan-400/20">
                <span className="text-4xl drop-shadow-md">⚡</span>
                <span className="text-[11px] font-black tracking-widest text-cyan-950 uppercase mt-0.5">РЕШКА</span>
              </div>
            </div>
          </div>
        </div>

        {/* Result Announcement Badge */}
        <div className="h-6 mt-3 flex items-center justify-center">
          {isWin !== null && !isFlipping && (
            <div
              className={`text-xs font-bold px-3 py-1 rounded-full border animate-bounce ${
                isWin
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                  : 'bg-rose-500/20 border-rose-400 text-rose-300'
              }`}
            >
              {isWin ? `ПОБЕДА! +${formatTokens(payout)} Т` : 'НЕ УГАДАЛИ'}
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
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                h.outcome === 'heads'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-300'
                  : 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300'
              }`}
            >
              {h.outcome === 'heads' ? '🪙 Орёл' : '⚡ Решка'}
            </span>
          ))}
        </div>
      )}

      {/* Side Selector (Heads or Tails) */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => {
            if (!isFlipping) {
              setChoice('heads');
              hapticImpact('light');
            }
          }}
          disabled={isFlipping}
          className={`py-3 px-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
            choice === 'heads'
              ? 'bg-gradient-to-b from-amber-500/25 to-amber-600/10 border-amber-400 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)] ring-1 ring-amber-400'
              : 'bg-slate-900/60 border-white/10 text-slate-400 hover:border-white/20'
          }`}
        >
          <div className="text-2xl mb-1">🪙</div>
          <div className="text-xs font-black uppercase">ОРЁЛ</div>
          <div className="text-[10px] text-emerald-400 font-mono font-bold mt-0.5">МНОЖИТЕЛЬ ×1.96</div>
        </button>

        <button
          onClick={() => {
            if (!isFlipping) {
              setChoice('tails');
              hapticImpact('light');
            }
          }}
          disabled={isFlipping}
          className={`py-3 px-3 rounded-xl border flex flex-col items-center justify-center transition-all ${
            choice === 'tails'
              ? 'bg-gradient-to-b from-cyan-500/25 to-blue-600/10 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)] ring-1 ring-cyan-400'
              : 'bg-slate-900/60 border-white/10 text-slate-400 hover:border-white/20'
          }`}
        >
          <div className="text-2xl mb-1">⚡</div>
          <div className="text-xs font-black uppercase">РЕШКА</div>
          <div className="text-[10px] text-emerald-400 font-mono font-bold mt-0.5">МНОЖИТЕЛЬ ×1.96</div>
        </button>
      </div>

      {/* Bet Controls */}
      <BetControls bet={bet} onBetChange={setBet} balance={balance} disabled={isFlipping} />

      {error && (
        <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs text-center">
          {error}
        </div>
      )}

      {/* Flip Button */}
      <button
        onClick={handleFlip}
        disabled={isFlipping || balance < bet}
        className={`w-full py-3.5 rounded-xl font-bold uppercase tracking-wider text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${
          isFlipping
            ? 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
            : balance < bet
            ? 'bg-rose-900/40 text-rose-300 border border-rose-500/30 cursor-not-allowed'
            : 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black shadow-[0_0_20px_rgba(245,158,11,0.4)] active:scale-[0.98]'
        }`}
      >
        <Sparkles className="w-4 h-4" />
        {isFlipping ? 'МОНЕТА В ПОЛЁТЕ...' : `БРОСИТЬ МОНЕТУ (${bet} Т)`}
      </button>
    </div>
  );
};
