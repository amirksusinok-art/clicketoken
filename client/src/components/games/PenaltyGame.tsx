import React, { useState } from 'react';
import { Trophy, ShieldAlert, Zap, CheckCircle2, XCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { BetControls } from './BetControls.js';
import { apiRequest } from '../../lib/api.js';
import { formatTokens } from '../../lib/formatters.js';
import { soundManager } from '../../lib/sound.js';
import { useTelegram } from '../../hooks/useTelegram.js';

interface PenaltyGameProps {
  balance: number;
  onBalanceUpdate: (newBalance: number) => void;
}

interface ShotHistory {
  shotZone: number;
  keeperZone: number;
  isGoal: boolean;
}

interface RoundState {
  roundId: string;
  bet: number;
  currentStep: number;
  maxSteps: number;
  multipliers: number[];
  history: ShotHistory[];
  isFinished: boolean;
  serverSeedHash?: string;
}

// 5 Goal Target Zones: 0: TL, 1: TR, 2: Center, 3: BL, 4: BR
const ZONES = [
  { id: 0, label: 'Верх Лево', top: '15%', left: '15%' },
  { id: 1, label: 'Верх Право', top: '15%', left: '85%' },
  { id: 2, label: 'Центр', top: '40%', left: '50%' },
  { id: 3, label: 'Низ Лево', top: '75%', left: '18%' },
  { id: 4, label: 'Низ Право', top: '75%', left: '82%' },
];

export const PenaltyGame: React.FC<PenaltyGameProps> = ({ balance, onBalanceUpdate }) => {
  const [bet, setBet] = useState(0.01);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShooting, setIsShooting] = useState(false);
  const [round, setRound] = useState<RoundState | null>(null);
  const [ballPos, setBallPos] = useState<{ x: number; y: number } | null>(null);
  const [keeperZone, setKeeperZone] = useState<number | null>(null);
  const [lastShotResult, setLastShotResult] = useState<'goal' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { hapticImpact, hapticNotification } = useTelegram();

  const currentMultiplier = round && round.currentStep > 0 ? round.multipliers[round.currentStep - 1] : 1.0;
  const currentPayout = round && round.currentStep > 0 ? Math.round(round.bet * currentMultiplier * 100000) / 100000 : 0;
  const nextMultiplier = round && round.currentStep < round.maxSteps ? round.multipliers[round.currentStep] : 0;

  // Start new penalty session
  const handleStartRound = async () => {
    if (isPlaying || balance < bet) return;

    try {
      setError(null);
      setLastShotResult(null);
      setKeeperZone(null);
      setBallPos(null);
      setIsPlaying(true);
      hapticImpact('medium');

      // Optimistic balance update
      onBalanceUpdate(balance - bet);

      const res = await apiRequest<{
        success: boolean;
        round: RoundState;
        balance: number;
      }>('/api/games/penalty/start-round', {
        method: 'POST',
        body: JSON.stringify({ bet }),
      });

      if (!res.success || !res.round) {
        throw new Error('Не удалось запустить серию пенальти');
      }

      setRound(res.round);
      onBalanceUpdate(res.balance);
    } catch (err: any) {
      hapticNotification('error');
      setError(err.message || 'Ошибка старта игры');
      setIsPlaying(false);
    }
  };

  // Shoot into one of the 5 zones
  const handleShoot = async (targetZone: number) => {
    if (!round || isShooting || round.isFinished) return;

    try {
      setIsShooting(true);
      setError(null);
      hapticImpact('heavy');
      soundManager.playClick();

      // Animate ball moving towards target zone
      const zoneData = ZONES[targetZone];
      setBallPos({
        x: parseFloat(zoneData.left),
        y: parseFloat(zoneData.top),
      });

      const res = await apiRequest<{
        success: boolean;
        isGoal: boolean;
        keeperZone: number;
        currentStep: number;
        multiplier: number;
        potentialPayout: number;
        isFinished: boolean;
        balance: number;
      }>('/api/games/penalty/shoot', {
        method: 'POST',
        body: JSON.stringify({
          roundId: round.roundId,
          targetZone,
        }),
      });

      if (!res.success) {
        throw new Error('Ошибка обработки удара');
      }

      // Keeper dives to his zone
      setKeeperZone(res.keeperZone);

      setTimeout(() => {
        if (res.isGoal) {
          setLastShotResult('goal');
          hapticNotification('success');
          soundManager.playVictoryFanfare();

          if (res.currentStep === round.maxSteps) {
            // Max series win
            confetti({
              particleCount: 80,
              spread: 80,
              origin: { y: 0.6 },
            });
            setIsPlaying(false);
          }
        } else {
          setLastShotResult('save');
          hapticNotification('error');
          soundManager.playRocketHit();
          setIsPlaying(false);
        }

        setRound((prev) =>
          prev
            ? {
                ...prev,
                currentStep: res.currentStep,
                isFinished: res.isFinished,
                history: [
                  ...prev.history,
                  {
                    shotZone: targetZone,
                    keeperZone: res.keeperZone,
                    isGoal: res.isGoal,
                  },
                ],
              }
            : null
        );

        onBalanceUpdate(res.balance);
        setIsShooting(false);
      }, 700);
    } catch (err: any) {
      setIsShooting(false);
      setError(err.message || 'Сбой при ударе');
    }
  };

  // Cash out bank
  const handleCashout = async () => {
    if (!round || isShooting || round.currentStep === 0 || round.isFinished) return;

    try {
      const res = await apiRequest<{
        success: boolean;
        payout: number;
        multiplier: number;
        balance: number;
      }>('/api/games/penalty/cashout', {
        method: 'POST',
        body: JSON.stringify({ roundId: round.roundId }),
      });

      if (res.success) {
        hapticNotification('success');
        soundManager.playVictoryFanfare();
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
        });

        onBalanceUpdate(res.balance);
        setIsPlaying(false);
        setRound((prev) => (prev ? { ...prev, isFinished: true } : null));
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка вывода банка');
    }
  };

  return (
    <div className="space-y-3.5 select-none">
      {/* 5-Shot Series Multiplier Progress Ladder */}
      <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-2.5 backdrop-blur-md">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-2 px-1">
          <span className="flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            СЕРИЯ ИЗ 5 УДАРОВ
          </span>
          <span className="font-mono text-emerald-400">
            {round && round.currentStep > 0 ? `КУШ: ×${currentMultiplier.toFixed(2)}` : 'МАКС: ×30.72'}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {[1.92, 3.84, 7.68, 15.36, 30.72].map((m, idx) => {
            const stepNum = idx + 1;
            const isCompleted = round ? round.currentStep >= stepNum : false;
            const isCurrent = round ? round.currentStep === idx && !round.isFinished : idx === 0 && !isPlaying;

            return (
              <div
                key={idx}
                className={`py-1.5 px-1 rounded-xl text-center border transition-all ${
                  isCompleted
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                    : isCurrent
                    ? 'bg-sky-500/20 border-sky-400 text-sky-300 animate-pulse'
                    : 'bg-slate-950/40 border-white/5 text-slate-500'
                }`}
              >
                <div className="text-[9px] uppercase font-bold text-slate-400">Удар {stepNum}</div>
                <div className="text-xs font-mono font-black mt-0.5">×{m.toFixed(2)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cyber Football Stadium & Interactive Goal */}
      <div className="relative w-full h-72 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-gradient-to-b from-[#060c18] via-[#091326] to-[#040810]">
        {/* Stadium Background Atmosphere */}
        <div className="absolute inset-0 opacity-40 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-600/30 via-transparent to-black" />

        {/* Stadium Floodlights */}
        <div className="absolute top-2 left-4 w-12 h-6 bg-sky-400/20 blur-xl rounded-full pointer-events-none" />
        <div className="absolute top-2 right-4 w-12 h-6 bg-sky-400/20 blur-xl rounded-full pointer-events-none" />

        {/* Football Goal Frame (Neon Cyber Net) */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[84%] h-44 rounded-t-xl border-4 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.45)] bg-black/40 backdrop-blur-[2px]">
          {/* Cyber Net Mesh Pattern */}
          <div
            className="w-full h-full opacity-20"
            style={{
              backgroundImage:
                'linear-gradient(to right, #06b6d4 1px, transparent 1px), linear-gradient(to bottom, #06b6d4 1px, transparent 1px)',
              backgroundSize: '16px 16px',
            }}
          />

          {/* Goalkeeper (Cyborg Keeper) */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 transition-all duration-300 flex flex-col items-center pointer-events-none z-10"
            style={{
              transform:
                keeperZone === 0
                  ? 'translate(-95px, -35px) rotate(-35deg)'
                  : keeperZone === 1
                  ? 'translate(95px, -35px) rotate(35deg)'
                  : keeperZone === 3
                  ? 'translate(-90px, 0px) rotate(-20deg)'
                  : keeperZone === 4
                  ? 'translate(90px, 0px) rotate(20deg)'
                  : 'translate(-50%, 0px)',
            }}
          >
            {/* Robot Goalkeeper Avatar */}
            <div className="relative">
              <div className="w-14 h-24 flex flex-col items-center justify-center text-4xl drop-shadow-[0_0_15px_rgba(245,158,11,0.6)]">
                🤖
              </div>
              <div className="text-[9px] font-mono font-bold text-amber-400 bg-black/80 px-1.5 py-0.5 rounded border border-amber-400/40 -mt-2">
                ВРАТАРЬ
              </div>
            </div>
          </div>

          {/* 5 Clickable Target Zones */}
          {ZONES.map((zone) => {
            const isClickable = isPlaying && !isShooting && (!round || !round.isFinished);

            return (
              <button
                key={zone.id}
                disabled={!isClickable}
                onClick={() => handleShoot(zone.id)}
                style={{ top: zone.top, left: zone.left }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-xl flex items-center justify-center transition-all cursor-pointer z-20 ${
                  isClickable
                    ? 'border-2 border-dashed border-sky-400 bg-sky-500/20 hover:bg-sky-500/40 hover:scale-110 active:scale-95 shadow-[0_0_12px_rgba(56,189,248,0.5)] animate-pulse'
                    : 'border border-white/10 bg-black/30 opacity-40'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-cyan-400/80 border border-white shadow-sm" />
              </button>
            );
          })}
        </div>

        {/* Grass Pitch Ground Line */}
        <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-emerald-950 via-emerald-950/60 to-transparent border-t border-emerald-500/20">
          {/* Penalty Spot Mark */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-4 h-2 rounded-full bg-white/60 shadow-md" />
        </div>

        {/* Animated Flying Ball */}
        <div
          className="absolute z-30 transition-all duration-500 ease-out pointer-events-none"
          style={{
            left: ballPos ? `${ballPos.x}%` : '50%',
            top: ballPos ? `${ballPos.y}%` : '85%',
            transform: `translate(-50%, -50%) scale(${ballPos ? 0.75 : 1})`,
          }}
        >
          <div className="text-3xl filter drop-shadow-[0_0_10px_rgba(56,189,248,0.8)] animate-[spin_1.5s_linear_infinite]">
            ⚽
          </div>
        </div>

        {/* Result Callout Banner */}
        {lastShotResult && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-white/20 text-xs font-black uppercase tracking-wider text-white pointer-events-none animate-in zoom-in-95 duration-150 z-40">
            {lastShotResult === 'goal' ? (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                ⚽ ГОЛ В ДЕВЯТКУ!
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1.5">
                <XCircle className="w-4 h-4" />
                🧤 ВРАТАРЬ ПАРИРОВАЛ УДАР!
              </span>
            )}
          </div>
        )}

        {/* Guidance Prompt */}
        {isPlaying && !isShooting && (!round || !round.isFinished) && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/75 backdrop-blur-md rounded-full border border-sky-400/30 text-[10px] font-bold text-sky-300 pointer-events-none animate-bounce z-40">
            🎯 НАЖМИТЕ НА КВАДРАТ ВОРОТ ДЛЯ УДАРА
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Cashout or Launch Actions */}
      {isPlaying && round && round.currentStep > 0 && !round.isFinished ? (
        <div className="space-y-2">
          <button
            onClick={handleCashout}
            disabled={isShooting}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-black font-black text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Trophy className="w-4 h-4 fill-current" />
            <span>ЗАБРАТЬ ВЫИГРЫШ: +{formatTokens(currentPayout)} Т</span>
          </button>
          <div className="text-center text-[10px] text-slate-400">
            Или выберите следующий угол: шанс на <strong className="text-emerald-400">×{nextMultiplier.toFixed(2)}</strong> (+{formatTokens(round.bet * nextMultiplier)} Т)
          </div>
        </div>
      ) : (
        <>
          {/* Bet Controls */}
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3.5 shadow-md">
            <BetControls bet={bet} onBetChange={setBet} balance={balance} disabled={isPlaying} />
          </div>

          {/* Start Session Button */}
          <button
            onClick={handleStartRound}
            disabled={isPlaying || balance < bet}
            className="w-full py-3.5 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-sky-500/20 active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>{isPlaying ? 'МЯЧ НА ТОЧКЕ...' : `БИТЬ ПЕНАЛЬТИ (${bet} Т)`}</span>
          </button>
        </>
      )}

      {/* Rules Notice */}
      <div className="p-2.5 bg-slate-900/40 border border-white/5 rounded-xl flex items-center justify-between text-[10px] text-slate-400">
        <div>5 секторов • Вратарь угадывает угол • Забирайте банк в любой момент</div>
        <div className="font-mono text-emerald-400 font-bold">До ×30.72</div>
      </div>
    </div>
  );
};
