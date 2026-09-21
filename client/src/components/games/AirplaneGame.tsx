import React, { useState, useEffect, useRef } from 'react';
import { Plane, AlertCircle, History, ShieldCheck } from 'lucide-react';
import confetti from 'canvas-confetti';
import { BetControls } from './BetControls.js';
import { Airplane3DScene } from './Airplane3DScene.js';
import { apiRequest } from '../../lib/api.js';
import { formatTokens } from '../../lib/formatters.js';
import { soundManager } from '../../lib/sound.js';
import { useTelegram } from '../../hooks/useTelegram.js';

interface AirplaneGameProps {
  balance: number;
  onBalanceUpdate: (newBalance: number) => void;
  planeSkin?: string;
}

interface Obstacle {
  id: string;
  type: 'ring' | 'rocket';
  timestampMs: number;
  multiplierFactor: number;
  position: { x: number; y: number; z: number };
}

interface RoundData {
  roundId: string;
  bet: number;
  status: string;
  obstacles: Obstacle[];
  flightDurationMs: number;
  landingSuccess: boolean;
  preLandingMultiplier: number;
  finalMultiplier: number;
  payout: number;
  serverSeedHash?: string;
}

export const AirplaneGame: React.FC<AirplaneGameProps> = ({ balance, onBalanceUpdate, planeSkin }) => {
  const [bet, setBet] = useState(0.01);
  const [isPlaying, setIsPlaying] = useState(false);
  const [flightPhase, setFlightPhase] = useState<'idle' | 'takeoff' | 'flying' | 'landing' | 'result'>('idle');
  const [displayMultiplier, setDisplayMultiplier] = useState(1.0);
  const [multiplierEffect, setMultiplierEffect] = useState<'up' | 'down' | null>(null);
  const [roundData, setRoundData] = useState<RoundData | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [payout, setPayout] = useState(0);
  const [history, setHistory] = useState<{ multiplier: number; win: boolean }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { hapticImpact, hapticNotification } = useTelegram();
  const animIntervalRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);

  // Clean up
  useEffect(() => {
    return () => {
      if (animIntervalRef.current) clearInterval(animIntervalRef.current);
    };
  }, []);

  const handleStartFlight = async () => {
    if (isPlaying || balance < bet) return;

    try {
      setIsPlaying(true);
      setError(null);
      setDisplayMultiplier(1.0);
      setRoundData(null);
      setFlightPhase('takeoff');
      setElapsedMs(0);
      hapticImpact('medium');

      // Deduct bet from local view
      onBalanceUpdate(balance - bet);

      // Start round on authoritative server
      const res = await apiRequest<{
        success: boolean;
        round: RoundData;
        balance: number;
      }>('/api/games/airplane/start-round', {
        method: 'POST',
        body: JSON.stringify({ bet }),
      });

      if (!res.success || !res.round) {
        throw new Error('Не удалось запустить полёт');
      }

      const round = res.round;
      setRoundData(round);
      startTimeRef.current = performance.now();

      // Flight Animation Timer loop (8000ms total)
      animIntervalRef.current = setInterval(() => {
        const elapsed = performance.now() - startTimeRef.current;
        setElapsedMs(elapsed);

        if (elapsed >= 1500 && elapsed < 6000) {
          setFlightPhase('flying');
        } else if (elapsed >= 6000 && elapsed < 8000) {
          setFlightPhase('landing');
        } else if (elapsed >= 8000) {
          clearInterval(animIntervalRef.current);
          handleFinishFlight(round.roundId);
        }
      }, 50);
    } catch (err: any) {
      hapticNotification('error');
      setError(err.message || 'Ошибка запуска игры');
      setIsPlaying(false);
      setFlightPhase('idle');
    }
  };

  // Triggered when plane collides/passes an obstacle in 3D
  const handleObstacleHit = (_obstacleId: string, type: 'ring' | 'rocket') => {
    if (type === 'ring') {
      setDisplayMultiplier((prev) => {
        const next = Math.round(prev * 1.5 * 100) / 100;
        return next;
      });
      setMultiplierEffect('up');
      hapticImpact('medium');
      soundManager.playRingPass();
    } else {
      setDisplayMultiplier((prev) => {
        const next = Math.max(1.0, Math.round((prev / 1.5) * 100) / 100);
        return next;
      });
      setMultiplierEffect('down');
      hapticImpact('heavy');
      soundManager.playRocketHit();
    }

    setTimeout(() => setMultiplierEffect(null), 700);
  };

  // Claim round from server
  const handleFinishFlight = async (roundId: string) => {
    try {
      const res = await apiRequest<{
        success: boolean;
        payout: number;
        finalMultiplier: number;
        isWin: boolean;
        balance: number;
      }>('/api/games/airplane/claim-round', {
        method: 'POST',
        body: JSON.stringify({ roundId }),
      });

      setFlightPhase('result');
      setIsPlaying(false);
      setDisplayMultiplier(res.finalMultiplier);
      setPayout(res.payout);
      onBalanceUpdate(res.balance);

      if (res.isWin) {
        hapticNotification('success');
        soundManager.playVictoryFanfare();
        confetti({
          particleCount: 65,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#38bdf8', '#0ea5e9', '#eab308', '#10b981'],
        });
      } else {
        hapticNotification('error');
      }

      setHistory((prev) => [{ multiplier: res.finalMultiplier, win: res.isWin }, ...prev.slice(0, 9)]);
    } catch (err: any) {
      setError(err.message || 'Ошибка подтверждения полёта');
      setIsPlaying(false);
      setFlightPhase('idle');
    }
  };

  const potentialWin = Math.round(bet * displayMultiplier * 1000) / 1000;

  return (
    <div className="space-y-3.5 select-none">
      {/* Flight History Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
        <span className="text-[10px] text-slate-500 uppercase font-bold shrink-0 flex items-center gap-1">
          <History className="w-3 h-3" />
          Полёты:
        </span>
        {history.map((h, i) => (
          <span
            key={i}
            className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold shrink-0 border ${
              h.win
                ? 'border-emerald-500/30 text-emerald-400 bg-emerald-950/30'
                : 'border-red-500/30 text-red-400 bg-red-950/30'
            }`}
          >
            ×{h.multiplier.toFixed(2)}
          </span>
        ))}
      </div>

      {/* 3D Flight Canvas Scene */}
      <div className="relative">
        <Airplane3DScene
          flightPhase={flightPhase}
          elapsedMs={elapsedMs}
          obstacles={roundData?.obstacles || []}
          landingSuccess={roundData?.landingSuccess ?? true}
          multiplier={displayMultiplier}
          planeSkin={planeSkin}
          onObstacleHit={handleObstacleHit}
        />

        {/* Floating Multiplier & Flight HUD Overlay */}
        <div className="absolute top-3 right-3 flex flex-col items-end pointer-events-none">
          <div
            className={`font-mono text-2xl sm:text-3xl font-black px-3 py-1 rounded-xl border backdrop-blur-md transition-transform duration-200 ${
              multiplierEffect === 'up'
                ? 'scale-125 bg-emerald-500/30 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.6)]'
                : multiplierEffect === 'down'
                ? 'scale-125 bg-rose-500/30 border-rose-400 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.6)]'
                : 'bg-black/60 border-white/10 text-sky-400'
            }`}
          >
            ×{displayMultiplier.toFixed(2)}
          </div>
          <div className="text-[10px] font-mono text-slate-300 font-bold bg-black/60 px-2 py-0.5 rounded-md border border-white/5 mt-1">
            Выигрыш: <strong className="text-emerald-400">{formatTokens(potentialWin)}</strong> Т
          </div>
        </div>

        {/* Center Flight Status Notification */}
        {flightPhase !== 'idle' && flightPhase !== 'result' && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 text-xs font-black uppercase tracking-wider text-white pointer-events-none animate-pulse whitespace-nowrap">
            {flightPhase === 'takeoff' && '🛫 ВЗЛЁТ С ПОЛОСЫ...'}
            {flightPhase === 'flying' && '✈️ СВЕРХЗВУКОВОЙ ПОЛЁТ'}
            {flightPhase === 'landing' &&
              (roundData?.landingSuccess
                ? '🛬 ЗАХОД В ЗЕЛЁНУЮ ЗОНУ (30%)...'
                : '⚠️ СНОС ВЕТРОМ ВНЕ ПОЛОСЫ (70%)...')}
          </div>
        )}
      </div>

      {/* Result Card */}
      {flightPhase === 'result' && (
        <div
          className={`p-4 rounded-2xl border text-center space-y-1.5 animate-in zoom-in-95 duration-200 shadow-xl ${
            payout > 0
              ? 'bg-gradient-to-b from-emerald-950/80 to-slate-900 border-emerald-500/30'
              : 'bg-gradient-to-b from-rose-950/80 to-slate-900 border-rose-500/30'
          }`}
        >
          <div className="text-3xl">{payout > 0 ? '🛬 🏆' : '💥 💀'}</div>
          <div className="text-sm font-black uppercase tracking-wider text-white">
            {payout > 0
              ? 'УСПЕШНАЯ ПОСАДКА В ЗОНУ!'
              : 'САМОЛЁТ НЕ СЕЛ НА ПОЛОСУ (СНОС 70%)'}
          </div>
          <div className="text-xl font-mono font-black text-white">
            {payout > 0 ? (
              <span className="text-emerald-400">+{formatTokens(payout)} ТОКЕН</span>
            ) : (
              <span className="text-rose-400">-{formatTokens(bet)} ТОКЕН</span>
            )}
          </div>
          <div className="text-[10px] text-slate-400">
            Итоговый множитель: <strong className="text-white font-mono">×{displayMultiplier.toFixed(2)}</strong>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Bet Controls */}
      <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3.5 shadow-md">
        <BetControls
          bet={bet}
          onBetChange={setBet}
          balance={balance}
          disabled={isPlaying}
        />
      </div>

      {/* Launch Flight Button */}
      <button
        onClick={handleStartFlight}
        disabled={isPlaying || balance < bet}
        className="w-full py-3.5 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-sky-500/20 active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plane className={`w-4 h-4 ${isPlaying ? 'animate-bounce' : ''}`} />
        <span>{isPlaying ? 'Самолёт в воздухе...' : `Запустить 3D-полёт (${bet} Т)`}</span>
      </button>

      {/* Rules Notice */}
      <div className="p-2.5 bg-slate-900/40 border border-white/5 rounded-xl flex items-center justify-between text-[10px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="text-sky-400 font-bold">Кольца: ×1.5</span>
          <span>•</span>
          <span className="text-rose-400 font-bold">Ракеты: ÷1.5</span>
        </div>
        <div className="flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Provably Fair 3D</span>
        </div>
      </div>
    </div>
  );
};
