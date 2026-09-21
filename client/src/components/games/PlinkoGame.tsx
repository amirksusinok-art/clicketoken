import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, History, User } from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiRequest } from '../../lib/api.js';
import { formatTokens } from '../../lib/formatters.js';
import { useTelegram } from '../../hooks/useTelegram.js';

interface PlinkoGameProps {
  balance: number;
  username: string;
  onBalanceUpdate: (newBalance: number) => void;
  onBack: () => void;
}

// Multiplier configurations matching screenshot 3
const PLINKO_TABLES: Record<number, Record<'low' | 'medium' | 'high', number[]>> = {
  8: {
    low: [5, 1.8, 0.8, 0.5, 0.42, 0.5, 0.8, 1.8, 5],
    medium: [13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13],
    high: [29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29],
  },
  9: {
    low: [5.6, 2, 1.1, 0.7, 0.45, 0.45, 0.7, 1.1, 2, 5.6],
    medium: [18, 4, 1.7, 0.9, 0.4, 0.4, 0.9, 1.7, 4, 18],
    high: [43, 7, 2, 0.6, 0.2, 0.2, 0.6, 2, 7, 43],
  },
  10: {
    low: [8.9, 3, 1.4, 0.9, 0.5, 0.4, 0.5, 0.9, 1.4, 3, 8.9],
    medium: [22, 5, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 5, 22],
    high: [76, 10, 3, 0.9, 0.3, 0.2, 0.3, 0.9, 3, 10, 76],
  },
  11: {
    low: [12, 4, 1.8, 1.1, 0.6, 0.4, 0.4, 0.6, 1.1, 1.8, 4, 12],
    medium: [30, 8, 3, 1.4, 0.7, 0.4, 0.4, 0.7, 1.4, 3, 8, 30],
    high: [120, 14, 4, 1.2, 0.4, 0.2, 0.2, 0.4, 1.2, 4, 14, 120],
  },
  12: {
    low: [16, 6, 2, 1.2, 0.7, 0.5, 0.4, 0.5, 0.7, 1.2, 2, 6, 16],
    medium: [42, 11, 4, 1.7, 0.9, 0.5, 0.3, 0.5, 0.9, 1.7, 4, 11, 42],
    high: [170, 24, 6, 1.7, 0.6, 0.3, 0.2, 0.3, 0.6, 1.7, 6, 24, 170],
  },
  13: {
    low: [22, 8, 2.5, 1.4, 0.8, 0.6, 0.45, 0.45, 0.6, 0.8, 1.4, 2.5, 8, 22],
    medium: [60, 16, 5, 2, 1.1, 0.6, 0.4, 0.4, 0.6, 1.1, 2, 5, 16, 60],
    high: [260, 37, 10, 2.5, 0.8, 0.4, 0.2, 0.2, 0.4, 0.8, 2.5, 10, 37, 260],
  },
  14: {
    low: [30, 10, 3, 1.6, 1, 0.7, 0.5, 0.4, 0.5, 0.7, 1, 1.6, 3, 10, 30],
    medium: [85, 22, 7, 2.5, 1.3, 0.7, 0.4, 0.3, 0.4, 0.7, 1.3, 2.5, 7, 22, 85],
    high: [420, 56, 15, 3.5, 1, 0.5, 0.3, 0.2, 0.3, 0.5, 1, 3.5, 15, 56, 420],
  },
  15: {
    low: [45, 15, 4, 2, 1.2, 0.8, 0.6, 0.45, 0.45, 0.6, 0.8, 1.2, 2, 4, 15, 45],
    medium: [130, 32, 10, 3, 1.5, 0.9, 0.5, 0.3, 0.3, 0.5, 0.9, 1.5, 3, 10, 32, 130],
    high: [620, 83, 25, 5, 1.5, 0.6, 0.3, 0.2, 0.2, 0.3, 0.6, 1.5, 5, 25, 83, 620],
  },
  16: {
    low: [60, 20, 5, 2.5, 1.5, 1, 0.7, 0.5, 0.4, 0.5, 0.7, 1, 1.5, 2.5, 5, 20, 60],
    medium: [200, 45, 15, 4, 2, 1.1, 0.6, 0.4, 0.3, 0.4, 0.6, 1.1, 2, 4, 15, 45, 200],
    high: [1000, 130, 40, 8, 2, 0.8, 0.4, 0.2, 0.2, 0.2, 0.4, 0.8, 2, 8, 40, 130, 1000],
  },
};

interface ActiveBall {
  id: number;
  path: number[];
  currentRow: number;
  progress: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  multiplier: number;
  bucketIndex: number;
  payout: number;
}

export const PlinkoGame: React.FC<PlinkoGameProps> = ({
  balance,
  username,
  onBalanceUpdate,
  onBack,
}) => {
  const [tab, setTab] = useState<'game' | 'history'>('game');
  const [rows, setRows] = useState(8);
  const [risk, setRisk] = useState<'low' | 'medium' | 'high'>('low');
  const [bet, setBet] = useState(5.0);
  const [isDropping, setIsDropping] = useState(false);
  const [ballsCount, setBallsCount] = useState(0);
  const [profit, setProfit] = useState(0);
  const [activeBucket, setActiveBucket] = useState<number | null>(null);
  const [history, setHistory] = useState<{ mult: number; payout: number; time: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeBallsRef = useRef<ActiveBall[]>([]);
  const ballIdCounter = useRef(0);
  const { hapticImpact, hapticNotification } = useTelegram();

  const currentMultipliers = PLINKO_TABLES[rows]?.[risk] || PLINKO_TABLES[8].low;

  // Render Plinko Board & Balls
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const startY = 30;
      const endY = height - 55;
      const rowGap = (endY - startY) / (rows + 1);

      // 1. Draw Pins (pyramid of glowing cyan dots)
      for (let r = 0; r <= rows; r++) {
        const pinCount = r + 3;
        const pinGap = Math.min(32, (width - 40) / (rows + 3));
        const rowWidth = (pinCount - 1) * pinGap;
        const rowStartX = (width - rowWidth) / 2;
        const y = startY + r * rowGap;

        for (let c = 0; c < pinCount; c++) {
          const x = rowStartX + c * pinGap;

          ctx.beginPath();
          ctx.arc(x, y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#38bdf8';
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // 2. Update and Draw Active Balls
      const remainingBalls: ActiveBall[] = [];

      for (const ball of activeBallsRef.current) {
        ball.progress += 0.085; // Speed of falling
        if (ball.progress >= 1) {
          ball.progress = 0;
          ball.currentRow += 1;
          hapticImpact('light');

          if (ball.currentRow >= rows) {
            // Ball landed in bucket!
            setActiveBucket(ball.bucketIndex);
            setTimeout(() => setActiveBucket(null), 400);

            if (ball.multiplier >= 1.5) {
              hapticNotification('success');
            } else if (ball.multiplier < 1.0) {
              hapticNotification('error');
            }
            continue; // Ball completed its path
          }
        }

        // Interpolate position
        const pinGap = Math.min(32, (width - 40) / (rows + 3));
        const currentR = ball.currentRow;
        const nextR = currentR + 1;

        // Current pin index based on path sum so far
        let curSum = 0;
        for (let i = 0; i < currentR; i++) {
          curSum += ball.path[i];
        }
        let nextSum = curSum + ball.path[currentR];

        const curRowStartX = (width - (currentR + 2) * pinGap) / 2;
        const nextRowStartX = (width - (nextR + 2) * pinGap) / 2;

        const curX = curRowStartX + (curSum + 1) * pinGap;
        const curY = startY + currentR * rowGap;
        const nxtX = nextRowStartX + (nextSum + 1) * pinGap;
        const nxtY = startY + nextR * rowGap;

        // Parabolic arc between pins
        const currentX = curX + (nxtX - curX) * ball.progress;
        const bounceOffset = Math.sin(ball.progress * Math.PI) * -8;
        const currentY = curY + (nxtY - curY) * ball.progress + bounceOffset;

        // Draw bright glowing ball
        ctx.beginPath();
        ctx.arc(currentX, currentY, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = '#f8fafc';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.shadowBlur = 0;

        remainingBalls.push(ball);
      }

      activeBallsRef.current = remainingBalls;
      if (remainingBalls.length === 0 && isDropping) {
        setIsDropping(false);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [rows, hapticImpact, hapticNotification, isDropping]);

  const handleDropBall = async () => {
    if (balance < bet) return;

    try {
      setError(null);
      setIsDropping(true);
      hapticImpact('medium');

      // Deduct bet locally
      onBalanceUpdate(balance - bet);
      setBallsCount((prev) => prev + 1);

      const res = await apiRequest<{
        success: boolean;
        path: number[];
        bucketIndex: number;
        multiplier: number;
        payout: number;
        balance: number;
      }>('/api/games/plinko/play', {
        method: 'POST',
        body: JSON.stringify({
          bet,
          rows,
          risk,
        }),
      });

      // Add to ball animation queue
      const newBall: ActiveBall = {
        id: ballIdCounter.current++,
        path: res.path,
        currentRow: 0,
        progress: 0,
        x: 0,
        y: 0,
        targetX: 0,
        targetY: 0,
        multiplier: res.multiplier,
        bucketIndex: res.bucketIndex,
        payout: res.payout,
      };
      activeBallsRef.current.push(newBall);

      // Calculate profit delta
      const netProfit = Math.round((res.payout - bet) * 1000) / 1000;
      setProfit((prev) => Math.round((prev + netProfit) * 1000) / 1000);

      // Record in history
      setHistory((prev) => [
        {
          mult: res.multiplier,
          payout: res.payout,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
        ...prev.slice(0, 14),
      ]);

      // When ball completes fall, sync balance
      setTimeout(() => {
        onBalanceUpdate(res.balance);
        if (res.multiplier >= 3.0) {
          confetti({ particleCount: 40, spread: 55, origin: { y: 0.5 } });
        }
      }, rows * 220 + 300);
    } catch (err: any) {
      hapticNotification('error');
      setError(err.message || 'Ошибка сброса шара');
      setIsDropping(false);
    }
  };

  // Helper function to color multiplier bucket
  const getBucketColor = (index: number, total: number) => {
    const half = (total - 1) / 2;
    const distFromCenter = Math.abs(index - half) / half; // 0 (center) to 1 (edges)

    if (distFromCenter > 0.8) {
      return 'bg-red-600 text-white shadow-red-500/40';
    } else if (distFromCenter > 0.5) {
      return 'bg-amber-600 text-white shadow-amber-500/30';
    } else if (distFromCenter > 0.25) {
      return 'bg-amber-500/80 text-white';
    } else {
      return 'bg-yellow-500/70 text-slate-900 font-black';
    }
  };

  return (
    <div className="space-y-3.5 select-none pb-4">
      {/* Top Header with Back Arrow & Title */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={onBack}
          className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <h1 className="text-base font-black tracking-widest text-white uppercase font-mono">
          PLINKO
        </h1>

        <div className="w-8" />
      </div>

      {/* Tabs: В игре | История */}
      <div className="flex border-b border-white/5 bg-slate-900/40 rounded-xl p-1 gap-1">
        <button
          onClick={() => setTab('game')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer relative ${
            tab === 'game' ? 'text-sky-400 bg-slate-800/80' : 'text-slate-400 hover:text-white'
          }`}
        >
          В игре
          {tab === 'game' && (
            <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-sky-400 rounded-full shadow-[0_0_8px_#38bdf8]" />
          )}
        </button>
        <button
          onClick={() => setTab('history')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
            tab === 'history' ? 'text-sky-400 bg-slate-800/80' : 'text-slate-400 hover:text-white'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          История
        </button>
      </div>

      {tab === 'game' ? (
        <>
          {/* Main Plinko Pyramid Viewport */}
          <div className="relative w-full rounded-2xl bg-gradient-to-b from-[#080d1a] to-[#0d1527] border border-white/10 overflow-hidden shadow-inner pt-2 pb-3">
            <canvas
              ref={canvasRef}
              width={380}
              height={260}
              className="w-full h-[240px] block"
            />

            {/* Bottom Multiplier Buckets */}
            <div className="px-2 flex items-center justify-between gap-1 overflow-x-hidden">
              {currentMultipliers.map((mult, idx) => {
                const isActive = activeBucket === idx;
                const total = currentMultipliers.length;
                const colorClass = getBucketColor(idx, total);

                return (
                  <div
                    key={idx}
                    className={`flex-1 py-1 px-0.5 rounded-md text-center text-[10px] sm:text-[11px] font-mono font-bold transition-all transform duration-150 ${colorClass} ${
                      isActive ? 'scale-125 ring-2 ring-white shadow-lg z-10' : ''
                    }`}
                  >
                    {mult >= 10 ? mult : mult.toFixed(mult % 1 === 0 ? 0 : mult < 1 ? 2 : 1)}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats Bar: Рядов | Шаров | Профит */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 flex flex-col items-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                РЯДОВ
              </span>
              <span className="text-base font-black text-white font-mono mt-0.5">{rows}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 flex flex-col items-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                ШАРОВ
              </span>
              <span className="text-base font-black text-sky-400 font-mono mt-0.5">
                {ballsCount}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 flex flex-col items-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                ПРОФИТ
              </span>
              <span
                className={`text-base font-black font-mono mt-0.5 ${
                  profit >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {profit >= 0 ? `+${profit}` : profit}
              </span>
            </div>
          </div>

          {/* Risk Level Selector */}
          <div className="flex bg-slate-900/70 p-1 rounded-xl border border-white/5 gap-1">
            {(['low', 'medium', 'high'] as const).map((lvl) => {
              const label = lvl === 'low' ? 'НИЗКИЙ' : lvl === 'medium' ? 'СРЕДНИЙ' : 'ВЫСОКИЙ';
              const isSelected = risk === lvl;
              return (
                <button
                  key={lvl}
                  onClick={() => setRisk(lvl)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition cursor-pointer uppercase ${
                    isSelected
                      ? 'bg-teal-950/80 text-teal-400 border border-teal-500/40 shadow-[0_0_10px_rgba(20,184,166,0.2)]'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Rows Slider (8 to 16) */}
          <div className="p-3 rounded-xl bg-slate-900/50 border border-white/5 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="font-semibold text-[11px] uppercase tracking-wider text-slate-400">
                Количество рядов
              </span>
              <span className="font-mono text-sky-400 font-bold">{rows}</span>
            </div>
            <input
              type="range"
              min="8"
              max="16"
              step="1"
              value={rows}
              onChange={(e) => setRows(parseInt(e.target.value, 10))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>8</span>
              <span>16</span>
            </div>
          </div>

          {/* Bet Input with /2, x2, MIN, MAX */}
          <div className="space-y-1.5">
            <div className="relative">
              <input
                type="number"
                min="5"
                step="1"
                value={bet || ''}
                onChange={(e) => setBet(Math.max(5, parseFloat(e.target.value) || 5))}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono font-bold focus:outline-none focus:border-sky-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">
                🪙
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setBet((b) => Math.max(5, Math.round((b / 2) * 10) / 10))}
                className="py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono font-bold transition cursor-pointer"
              >
                /2
              </button>
              <button
                type="button"
                onClick={() => setBet((b) => Math.min(balance, Math.round(b * 2 * 10) / 10))}
                className="py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono font-bold transition cursor-pointer"
              >
                x2
              </button>
              <button
                type="button"
                onClick={() => setBet(5)}
                className="py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono font-bold transition cursor-pointer"
              >
                MIN
              </button>
              <button
                type="button"
                onClick={() => setBet(Math.max(5, Math.floor(balance)))}
                className="py-2 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 rounded-xl text-xs font-mono font-bold transition cursor-pointer"
              >
                MAX
              </button>
            </div>
          </div>

          {error && (
            <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
              {error}
            </div>
          )}

          {/* Big Action Button: СБРОСИТЬ ШАР */}
          <button
            onClick={handleDropBall}
            disabled={balance < bet}
            className={`w-full py-4 rounded-2xl font-black text-base uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-xl ${
              balance >= bet
                ? 'bg-gradient-to-r from-sky-400 to-cyan-500 hover:from-sky-300 hover:to-cyan-400 text-slate-950 shadow-sky-500/30 active:scale-[0.98] cursor-pointer'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
            }`}
          >
            {balance < bet ? 'Недостаточно токенов' : 'СБРОСИТЬ ШАР'}
          </button>
        </>
      ) : (
        /* History View */
        <div className="space-y-2 p-1">
          {history.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              История раундов пока пуста
            </div>
          ) : (
            history.map((h, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-white/5 text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      h.mult >= 1.5
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : h.mult >= 1.0
                        ? 'bg-sky-500/20 text-sky-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    ×{h.mult}
                  </span>
                  <span className="text-slate-400 text-[10px]">{h.time}</span>
                </div>
                <div className="font-bold text-white">+{formatTokens(h.payout)} Т</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Persistent Bottom User Strip */}
      <div className="flex items-center justify-between pt-2 border-t border-white/5 px-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xs ring-1 ring-white/20">
            {username ? username[0].toUpperCase() : <User className="w-4 h-4" />}
          </div>
          <div>
            <div className="text-xs font-bold text-white leading-tight">
              {username || 'Игрок'}
            </div>
            <div className="text-[9px] uppercase tracking-wider text-slate-500">БАЛАНС</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-sm font-black text-white">
          <span>{formatTokens(balance)}</span>
          <span className="text-amber-400 text-base">🪙</span>
        </div>
      </div>
    </div>
  );
};
