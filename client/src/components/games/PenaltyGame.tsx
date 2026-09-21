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
  const [bet, setBet] = useState(1.0);
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

// Progressive Save Chance per step: [40%, 48%, 58%, 68%, 75%]
const STEP_SAVE_RATES = ['40%', '48%', '58%', '68%', '75%'];

// Cyberpunk Goalkeeper Vector Graphic Component
const CyberKeeper: React.FC<{
  zone: number | null;
  isSave: boolean;
}> = ({ zone, isSave }) => {
  const isDiving = zone !== null;
  const isLeft = zone === 0 || zone === 3;
  const isRight = zone === 1 || zone === 4;

  let transform = 'translate(-50%, 0) scale(1)';
  if (zone === 0) transform = 'translate(-105px, -30px) rotate(-35deg) scale(1.05)';
  if (zone === 1) transform = 'translate(65px, -30px) rotate(35deg) scale(1.05)';
  if (zone === 2) transform = 'translate(-50%, -15px) scale(1.05)';
  if (zone === 3) transform = 'translate(-95px, 10px) rotate(-22deg) scale(1.02)';
  if (zone === 4) transform = 'translate(55px, 10px) rotate(22deg) scale(1.02)';

  return (
    <div
      className="absolute bottom-0 left-1/2 transition-all duration-500 ease-out pointer-events-none z-10"
      style={{ transform }}
    >
      {/* Dynamic Glow Aura */}
      <div
        className={`absolute inset-0 blur-xl rounded-full transition-all duration-300 ${
          isSave
            ? 'bg-rose-500/70 opacity-100 scale-125'
            : isDiving
            ? 'bg-cyan-400/50 opacity-90 scale-110'
            : 'bg-cyan-500/20 opacity-40'
        }`}
      />

      <div className="relative flex flex-col items-center">
        {/* Shield Impact Pulse on Save */}
        {isSave && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-20 h-20 rounded-full border-2 border-rose-400 bg-rose-500/30 blur-[2px] animate-ping pointer-events-none" />
        )}

        <svg
          width="76"
          height="92"
          viewBox="0 0 76 92"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`filter transition-transform duration-300 ${
            !isDiving ? 'animate-[bounce_2.5s_ease-in-out_infinite]' : ''
          }`}
        >
          {/* Cyber Armor Torso */}
          <path
            d="M26 34 L50 34 L54 62 L44 68 L32 68 L22 62 Z"
            fill="#0f172a"
            stroke={isSave ? '#f43f5e' : '#0284c7'}
            strokeWidth="1.5"
          />
          {/* Energy Core / Veins */}
          <circle cx="38" cy="46" r="5" fill="#0284c7" opacity="0.3" />
          <circle cx="38" cy="46" r="3" fill={isSave ? '#fb7185' : '#38bdf8'} />
          <line x1="38" y1="50" x2="38" y2="64" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="2 1" />
          <line x1="30" y1="42" x2="46" y2="42" stroke="#38bdf8" strokeWidth="1" opacity="0.6" />

          {/* Shoulders */}
          <rect x="16" y="32" width="10" height="7" rx="2" fill="#1e293b" stroke="#38bdf8" strokeWidth="1" />
          <rect x="50" y="32" width="10" height="7" rx="2" fill="#1e293b" stroke="#38bdf8" strokeWidth="1" />

          {/* Left Arm & Cyber Glove */}
          <path
            d={isLeft ? 'M18 34 L6 20 L2 24' : 'M18 36 L10 50 L8 56'}
            stroke="#334155"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <g transform={isLeft ? 'translate(0, 16)' : 'translate(5, 52)'}>
            <circle cx="6" cy="6" r="7" fill={isSave ? '#f43f5e' : '#0284c7'} stroke="#38bdf8" strokeWidth="1.5" />
            <circle cx="6" cy="6" r="4" fill="#38bdf8" className="animate-pulse" />
            <circle cx="6" cy="6" r="9" stroke="#67e8f9" strokeWidth="0.8" strokeDasharray="3 2" opacity="0.8" />
          </g>

          {/* Right Arm & Cyber Glove */}
          <path
            d={isRight ? 'M58 34 L70 20 L74 24' : 'M58 36 L66 50 L68 56'}
            stroke="#334155"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <g transform={isRight ? 'translate(64, 16)' : 'translate(63, 52)'}>
            <circle cx="6" cy="6" r="7" fill={isSave ? '#f43f5e' : '#0284c7'} stroke="#38bdf8" strokeWidth="1.5" />
            <circle cx="6" cy="6" r="4" fill="#38bdf8" className="animate-pulse" />
            <circle cx="6" cy="6" r="9" stroke="#67e8f9" strokeWidth="0.8" strokeDasharray="3 2" opacity="0.8" />
          </g>

          {/* Cyber Goalie Helmet */}
          <path
            d="M26 22 C26 12 30 8 38 8 C46 8 50 12 50 22 L48 28 L28 28 Z"
            fill="#090d16"
            stroke={isSave ? '#f43f5e' : '#0284c7'}
            strokeWidth="1.5"
          />
          <rect x="36.5" y="4" width="3" height="5" rx="1" fill="#f59e0b" />

          {/* Visor (Neon Scanner with Moving Beam) */}
          <rect x="28" y="16" width="20" height="7" rx="3.5" fill="#082f49" stroke="#38bdf8" strokeWidth="1" />
          <rect x="30" y="18" width="16" height="3" rx="1.5" fill="#38bdf8" opacity="0.4" />
          <circle cx="38" cy="19.5" r="2.5" fill="#22d3ee">
            <animate attributeName="cx" values="32;44;32" dur="1.8s" repeatCount="indefinite" />
          </circle>

          {/* Legs & Cleats */}
          <rect x="29" y="68" width="6" height="18" rx="2" fill="#0f172a" stroke="#334155" strokeWidth="1" />
          <rect x="41" y="68" width="6" height="18" rx="2" fill="#0f172a" stroke="#334155" strokeWidth="1" />
          <path d="M26 86 L36 86 L36 89 L25 89 Z" fill="#1e293b" />
          <line x1="26" y1="89" x2="36" y2="89" stroke="#38bdf8" strokeWidth="1.5" />
          <path d="M40 86 L50 86 L51 89 L40 89 Z" fill="#1e293b" />
          <line x1="40" y1="89" x2="50" y2="89" stroke="#38bdf8" strokeWidth="1.5" />
        </svg>

        {/* Status Tag */}
        <div
          className={`text-[8px] font-mono font-black tracking-wider uppercase px-2 py-0.5 rounded-full border shadow-sm -mt-1 flex items-center gap-1 ${
            isSave
              ? 'text-rose-300 bg-rose-950/80 border-rose-500/50'
              : 'text-cyan-300 bg-black/85 border-cyan-500/40'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isSave ? 'bg-rose-400' : 'bg-cyan-400 animate-ping'}`} />
          <span>{isSave ? 'СЕЙВ!' : 'ИИ ВРАТАРЬ'}</span>
        </div>
      </div>
    </div>
  );
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
                    ? 'bg-sky-500/20 border-sky-400 text-sky-300 ring-1 ring-sky-400/50'
                    : 'bg-slate-950/40 border-white/5 text-slate-500'
                }`}
              >
                <div className="text-[8px] uppercase font-bold text-slate-400">Удар {stepNum}</div>
                <div className="text-xs font-mono font-black mt-0.5">×{m.toFixed(2)}</div>
                <div className="text-[7.5px] font-mono text-slate-400/80 mt-0.5">{STEP_SAVE_RATES[idx]} сейв</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cyber Football Stadium & Interactive Goal */}
      <div
        className={`relative w-full h-72 rounded-2xl overflow-hidden border shadow-2xl transition-all duration-300 bg-gradient-to-b from-[#060c18] via-[#091326] to-[#040810] ${
          lastShotResult === 'save'
            ? 'border-rose-500/60 shadow-[0_0_25px_rgba(244,63,94,0.35)] animate-[wiggle_0.25s_ease-in-out]'
            : lastShotResult === 'goal'
            ? 'border-emerald-500/60 shadow-[0_0_30px_rgba(16,185,129,0.4)]'
            : 'border-white/10'
        }`}
      >
        {/* Stadium Background Atmosphere */}
        <div className="absolute inset-0 opacity-40 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-600/30 via-transparent to-black" />

        {/* Stadium Floodlights */}
        <div className="absolute top-2 left-4 w-12 h-6 bg-sky-400/20 blur-xl rounded-full pointer-events-none" />
        <div className="absolute top-2 right-4 w-12 h-6 bg-sky-400/20 blur-xl rounded-full pointer-events-none" />

        {/* Football Goal Frame (Neon Cyber Net) */}
        <div
          className={`absolute top-10 left-1/2 -translate-x-1/2 w-[84%] h-44 rounded-t-xl border-4 transition-all duration-500 bg-black/40 backdrop-blur-[2px] ${
            lastShotResult === 'goal'
              ? 'border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.7)]'
              : lastShotResult === 'save'
              ? 'border-rose-500/80 shadow-[0_0_25px_rgba(244,63,94,0.5)]'
              : 'border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.45)]'
          }`}
        >
          {/* Cyber Net Mesh Pattern */}
          <div
            className={`w-full h-full transition-opacity duration-300 ${
              lastShotResult === 'goal' ? 'opacity-40' : 'opacity-20'
            }`}
            style={{
              backgroundImage: `linear-gradient(to right, ${
                lastShotResult === 'goal' ? '#10b981' : '#06b6d4'
              } 1px, transparent 1px), linear-gradient(to bottom, ${
                lastShotResult === 'goal' ? '#10b981' : '#06b6d4'
              } 1px, transparent 1px)`,
              backgroundSize: '16px 16px',
            }}
          />

          {/* Goalkeeper (Cyborg Keeper Vector) */}
          <CyberKeeper zone={keeperZone} isSave={lastShotResult === 'save'} />

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
                    ? 'border-2 border-dashed border-sky-400 bg-sky-500/20 hover:bg-sky-500/40 hover:scale-110 active:scale-95 shadow-[0_0_14px_rgba(56,189,248,0.6)] animate-pulse'
                    : 'border border-white/10 bg-black/30 opacity-40'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-cyan-400/80 border border-white shadow-sm flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Grass Pitch Ground Line */}
        <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-emerald-950 via-emerald-950/60 to-transparent border-t border-emerald-500/20">
          {/* Penalty Spot Mark */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-4 h-2 rounded-full bg-white/60 shadow-md" />
        </div>

        {/* Animated Flying Ball with 3D Depth & Comet Tail */}
        <div
          className="absolute z-30 pointer-events-none transition-all duration-700 ease-out"
          style={{
            left: ballPos ? `${ballPos.x}%` : '50%',
            top: ballPos ? `${ballPos.y}%` : '84%',
            transform: `translate(-50%, -50%) scale(${ballPos ? 0.38 : 1})`,
          }}
        >
          {/* Comet Tail Trail when Flying */}
          {isShooting && (
            <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-t from-cyan-400/90 via-sky-300/50 to-transparent blur-[3px] scale-150 animate-pulse" />
          )}

          {/* Ground drop shadow when on penalty spot */}
          {!ballPos && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 rounded-full bg-black/60 blur-[1px] -z-10" />
          )}

          {/* 3D Spinning Ball */}
          <div
            className={`text-3xl filter drop-shadow-[0_0_12px_rgba(56,189,248,0.9)] ${
              isShooting ? 'animate-[spin_0.6s_linear_infinite]' : ''
            }`}
          >
            ⚽
          </div>
        </div>

        {/* Result Callout Banner */}
        {lastShotResult && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-xl bg-black/85 backdrop-blur-md border border-white/20 text-xs font-black uppercase tracking-wider text-white pointer-events-none animate-in zoom-in-95 duration-150 z-40 shadow-xl">
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
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/85 backdrop-blur-md rounded-full border border-sky-400/40 text-[10px] font-bold text-sky-300 pointer-events-none animate-bounce z-40 shadow-lg shadow-sky-500/20">
            🎯 НАЖМИТЕ НА СЕКТОР ВОРОТ ДЛЯ УДАРА
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
