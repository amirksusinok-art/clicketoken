import React, { useState, useEffect, useRef } from 'react';
import { Rocket, AlertTriangle, Users, History } from 'lucide-react';
import { BetControls } from './BetControls.js';
import { apiRequest, API_BASE } from '../../lib/api.js';
import { formatTokens } from '../../lib/formatters.js';
import { useTelegram } from '../../hooks/useTelegram.js';

interface CrashGameProps {
  balance: number;
  userId: number;
  onBalanceUpdate: (newBalance: number) => void;
}

interface BetInfo {
  userId: number;
  username: string;
  bet: number;
  cashedOut: boolean;
  cashedOutMultiplier?: number;
  cashedOutPayout?: number;
}

interface CrashHistoryItem {
  crashPoint: number;
  timestamp: number;
}

export const CrashGame: React.FC<CrashGameProps> = ({
  balance,
  userId,
  onBalanceUpdate,
}) => {
  const [bet, setBet] = useState(5.0);
  const [state, setState] = useState<'BETTING' | 'RUNNING' | 'CRASHED'>('BETTING');
  const [currentMultiplier, setCurrentMultiplier] = useState(1.0);
  const [bettingTimeLeft, setBettingTimeLeft] = useState(5.0);
  const [bets, setBets] = useState<BetInfo[]>([]);
  const [history, setHistory] = useState<CrashHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { hapticImpact, hapticNotification } = useTelegram();

  // Check if current user has an active bet in this round
  const myBet = bets.find((b) => b.userId === userId);
  const hasPlacedBet = Boolean(myBet);
  const hasCashedOut = Boolean(myBet?.cashedOut);

  // Canvas ref for graphing curve
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Connect to SSE stream
  useEffect(() => {
    let eventSource: EventSource | null = null;

    try {
      eventSource = new EventSource(`${API_BASE}/api/games/crash/events`);

      eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'init' || data.type === 'new_round' || data.type === 'round_started') {
            setState(data.state);
            setCurrentMultiplier(data.currentMultiplier || 1.0);
            setBettingTimeLeft(data.bettingTimeLeft || 5.0);
            setBets(data.bets || []);
            if (data.history) setHistory(data.history);
            setError(null);
          } else if (data.type === 'betting_tick') {
            setBettingTimeLeft(data.bettingTimeLeft);
            setState('BETTING');
          } else if (data.type === 'multiplier_tick') {
            setCurrentMultiplier(data.multiplier);
            setState('RUNNING');
          } else if (data.type === 'crashed') {
            setState('CRASHED');
            setCurrentMultiplier(data.crashPoint);
            if (data.history) setHistory(data.history);
          } else if (data.type === 'bet_placed') {
            setBets((prev) => {
              const exists = prev.some((b) => b.userId === data.bet.userId);
              return exists ? prev : [...prev, data.bet];
            });
          } else if (data.type === 'cashed_out') {
            setBets((prev) =>
              prev.map((b) =>
                b.userId === data.userId
                  ? {
                      ...b,
                      cashedOut: true,
                      cashedOutMultiplier: data.multiplier,
                      cashedOutPayout: data.payout,
                    }
                  : b
              )
            );
          }
        } catch (err) {
          // ignore parse errors
        }
      };

      eventSource.onerror = () => {
        // SSE will auto-retry
      };
    } catch (err) {
      console.error('SSE connection error:', err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  // Draw chart on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (state === 'BETTING') {
      // Waiting phase text
      return;
    }

    // Draw curve with strictly forward-rising trajectory
    const startX = 20;
    const startY = height - 20;
    const progress = Math.min(1, Math.max(0, (currentMultiplier - 1) / 4.0));
    const endX = startX + (width - startX - 30) * progress;
    const endY = startY - (height - 50) * Math.pow(progress, 0.85);

    // Control point strictly between startX and endX
    const controlX = startX + (endX - startX) * 0.55;
    const controlY = startY;

    // Fill under curve
    const gradient = ctx.createLinearGradient(0, endY, 0, startY);
    if (state === 'CRASHED') {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0.0)');
    } else {
      gradient.addColorStop(0, 'rgba(56, 189, 248, 0.3)');
      gradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
    }

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(controlX, controlY, endX, endY);
    ctx.lineTo(endX, startY);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Stroke line
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(controlX, controlY, endX, endY);
    ctx.strokeStyle = state === 'CRASHED' ? '#ef4444' : '#38bdf8';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = state === 'CRASHED' ? '#ef4444' : '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw Rocket / Glowing Orb at head
    ctx.beginPath();
    ctx.arc(endX, endY, 6, 0, Math.PI * 2);
    ctx.fillStyle = state === 'CRASHED' ? '#ef4444' : '#38bdf8';
    ctx.shadowColor = state === 'CRASHED' ? '#ef4444' : '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;
  }, [currentMultiplier, state]);

  // Place bet action
  const handlePlaceBet = async () => {
    if (state !== 'BETTING' || loading || hasPlacedBet) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<{ success: boolean; balance: number }>('/api/games/crash/bet', {
        method: 'POST',
        body: JSON.stringify({ amount: bet }),
      });
      if (res.success) {
        hapticImpact('medium');
        onBalanceUpdate(res.balance);
      }
    } catch (err: any) {
      hapticNotification('error');
      setError(err.message || 'Ошибка ставки');
    } finally {
      setLoading(false);
    }
  };

  // Cash out action
  const handleCashOut = async () => {
    if (state !== 'RUNNING' || loading || !hasPlacedBet || hasCashedOut) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiRequest<{
        success: boolean;
        payout: number;
        multiplier: number;
        balance: number;
      }>('/api/games/crash/cashout', {
        method: 'POST',
      });
      if (res.success) {
        hapticNotification('success');
        onBalanceUpdate(res.balance);
      }
    } catch (err: any) {
      hapticNotification('error');
      setError(err.message || 'Не удалось забрать выигрыш');
    } finally {
      setLoading(false);
    }
  };

  const potentialWin = hasPlacedBet && myBet ? Math.round(myBet.bet * currentMultiplier * 1000) / 1000 : 0;

  return (
    <div className="space-y-4">
      {/* History multipliers pill row */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
        <span className="text-[10px] text-slate-500 uppercase font-bold shrink-0 flex items-center gap-1">
          <History className="w-3 h-3" />
          История:
        </span>
        {history.slice(0, 8).map((h, i) => (
          <span
            key={i}
            className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold shrink-0 ${
              h.crashPoint >= 2.0
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800/80 text-slate-400 border border-white/5'
            }`}
          >
            {h.crashPoint.toFixed(2)}x
          </span>
        ))}
      </div>

      {/* Main Crash Screen Canvas */}
      <div className="relative w-full h-56 rounded-2xl bg-gradient-to-b from-[#0e1422] to-[#0a0d16] border border-white/10 overflow-hidden flex flex-col items-center justify-center shadow-inner">
        {/* Ambient background glow */}
        <div
          className={`absolute inset-0 transition-opacity duration-300 pointer-events-none ${
            state === 'CRASHED'
              ? 'bg-red-950/20 opacity-100'
              : state === 'RUNNING'
              ? 'bg-sky-950/20 opacity-100'
              : 'opacity-0'
          }`}
        />

        <canvas
          ref={canvasRef}
          width={400}
          height={220}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Center Multiplier / Status Display */}
        <div className="relative z-10 flex flex-col items-center select-none">
          {state === 'BETTING' && (
            <div className="text-center animate-pulse">
              <span className="text-xs uppercase tracking-widest text-slate-400 font-bold">
                Приём ставок
              </span>
              <div className="text-4xl sm:text-5xl font-black text-amber-400 font-mono mt-1">
                {bettingTimeLeft.toFixed(1)}s
              </div>
            </div>
          )}

          {state === 'RUNNING' && (
            <div className="text-center">
              <div className="text-5xl sm:text-6xl font-black text-white font-mono tracking-tight drop-shadow-[0_0_20px_rgba(56,189,248,0.5)]">
                {currentMultiplier.toFixed(2)}x
              </div>
              {hasPlacedBet && !hasCashedOut && (
                <div className="text-xs font-bold text-emerald-400 mt-1 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-500/30">
                  Вы получите: +{formatTokens(potentialWin)} Т
                </div>
              )}
            </div>
          )}

          {state === 'CRASHED' && (
            <div className="text-center">
              <span className="text-xs uppercase tracking-widest text-red-400 font-bold flex items-center gap-1 justify-center">
                <AlertTriangle className="w-3.5 h-3.5" />
                Крушение
              </span>
              <div className="text-5xl sm:text-6xl font-black text-red-500 font-mono tracking-tight mt-1 drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]">
                {currentMultiplier.toFixed(2)}x
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
          {error}
        </div>
      )}

      {/* Action Button: Bet or Cash Out */}
      <div>
        {state === 'RUNNING' && hasPlacedBet && !hasCashedOut ? (
          <button
            onClick={handleCashOut}
            disabled={loading}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-lg shadow-xl shadow-emerald-500/30 transform active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer animate-pulse"
          >
            <span>ЗАБРАТЬ</span>
            <span className="font-mono text-emerald-100">
              +{formatTokens(potentialWin)} ТОКЕНОВ
            </span>
          </button>
        ) : hasPlacedBet && hasCashedOut ? (
          <div className="w-full py-3.5 px-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 font-bold text-center text-sm">
            ✓ Выигрыш забран: +{formatTokens(myBet?.cashedOutPayout || 0)} Токенов ({myBet?.cashedOutMultiplier?.toFixed(2)}x)
          </div>
        ) : state === 'BETTING' ? (
          <button
            onClick={handlePlaceBet}
            disabled={loading || hasPlacedBet || balance < bet}
            className={`w-full py-3.5 px-6 rounded-2xl font-bold text-sm transition flex items-center justify-center gap-2 ${
              hasPlacedBet
                ? 'bg-slate-800 text-slate-400 border border-white/5 cursor-default'
                : balance >= bet
                ? 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/20 active:scale-98 cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
            }`}
          >
            <Rocket className="w-4 h-4" />
            {hasPlacedBet
              ? `Ставка ${formatTokens(myBet?.bet || bet)} Т принята`
              : balance < bet
              ? 'Недостаточно токенов'
              : `Поставить ${formatTokens(bet)} Токенов`}
          </button>
        ) : (
          <button
            disabled
            className="w-full py-3.5 px-4 rounded-2xl bg-slate-800/80 text-slate-500 font-bold text-sm border border-white/5 cursor-not-allowed"
          >
            Ожидайте следующего раунда...
          </button>
        )}
      </div>

      {/* Bet Controls */}
      <BetControls
        bet={bet}
        onBetChange={setBet}
        balance={balance}
        disabled={state !== 'BETTING' || hasPlacedBet}
      />

      {/* Live Players List */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5 font-bold text-slate-300">
            <Users className="w-3.5 h-3.5 text-sky-400" />
            Участники раунда ({bets.length})
          </span>
        </div>

        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
          {bets.length === 0 ? (
            <div className="text-center py-2 text-[11px] text-slate-500">
              Пока нет ставок в этом раунде
            </div>
          ) : (
            bets.map((b, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 text-xs"
              >
                <span className="font-semibold text-slate-300 truncate max-w-[120px]">
                  {b.username}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-mono">{formatTokens(b.bet)} Т</span>
                  {b.cashedOut ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400">
                      {b.cashedOutMultiplier?.toFixed(2)}x
                    </span>
                  ) : state === 'CRASHED' ? (
                    <span className="text-[10px] text-red-400 font-bold">Проигрыш</span>
                  ) : (
                    <span className="text-[10px] text-sky-400 font-mono animate-pulse">В игре</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
